from __future__ import annotations

import asyncio
import math
import uuid
from collections import Counter, defaultdict
from typing import Any

import httpx

from .adapters import generate
from .catalog import get_model
from .config import settings
from .normalize import NORMALIZATION_LABELS, normalize_answer
from .statistics import bootstrap_jsd, distribution, jsd
from .storage import json_dumps, json_loads, session, utc_now
from .storage.models import Profile as ProfileRow, Run as RunRow, Sample as SampleRow
from .probes import BATTERY, ProbeCell, choose_probe


MIN_VALID_RATE = 0.8
MAX_RESPONSE_PREVIEW = 400


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def create_run(kind: str, profile_id: str, request: dict) -> str:
    run_id = new_id(kind)
    with session() as db:
        db.add(RunRow(id=run_id, kind=kind, profile_id=profile_id, status="queued", request_json=json_dumps(request), created_at=utc_now()))
    return run_id


def update_run(run_id: str, **fields: str | dict | None) -> None:
    allowed = {"status", "result_json", "error", "started_at", "finished_at"}
    updates = {field: (json_dumps(value) if isinstance(value, dict) else value) for field, value in fields.items() if field in allowed}
    if not updates:
        return
    with session() as db:
        db.query(RunRow).filter_by(id=run_id).update(updates)


def _profile_to_dict(row: ProfileRow) -> dict:
    data = {column: getattr(row, column) for column in row.__table__.columns.keys()}
    for field in ("sampling_json", "capabilities_json", "baseline_json", "threshold_json", "quality_json"):
        data[field.removesuffix("_json")] = json_loads(data.pop(field), {})
    return data


def get_profile(profile_id: str) -> dict | None:
    with session() as db:
        row = db.get(ProfileRow, profile_id)
    return _profile_to_dict(row) if row else None


def list_profiles() -> list[dict]:
    with session() as db:
        rows = db.query(ProfileRow).order_by(ProfileRow.updated_at.desc()).all()
    return [_profile_to_dict(row) for row in rows]


def _run_to_dict(row: RunRow) -> dict:
    data = {column: getattr(row, column) for column in row.__table__.columns.keys()}
    data["request"] = json_loads(data.pop("request_json"), {})
    data["result"] = json_loads(data.pop("result_json"), None)
    return data


def list_runs() -> list[dict]:
    with session() as db:
        rows = db.query(RunRow).order_by(RunRow.created_at.desc()).limit(100).all()
    return [_run_to_dict(row) for row in rows]


def get_run(run_id: str) -> dict | None:
    with session() as db:
        row = db.get(RunRow, run_id)
    return _run_to_dict(row) if row else None


def _preview(text: str) -> str:
    return " ".join(text.replace("\x00", " ").split())[:MAX_RESPONSE_PREVIEW]


def _error_details(exc: Exception) -> tuple[str, int | None, str]:
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 429:
            category = "rate_limited"
        elif 500 <= status <= 599:
            category = "upstream_server_error"
        elif 400 <= status <= 499:
            category = "request_rejected"
        else:
            category = "http_error"
        return str(exc)[:500], status, category
    if isinstance(exc, httpx.TimeoutException):
        return str(exc)[:500], None, "timeout"
    if isinstance(exc, httpx.TransportError):
        return str(exc)[:500], None, "transport_error"
    return str(exc)[:500], None, "unexpected_error"


def insert_sample(
    run_id: str,
    side: str,
    cell_id: str,
    prompt: str,
    answer: str | None,
    raw_hash: str | None,
    latency_ms: int | None,
    valid: bool,
    error: str | None = None,
    response_preview: str | None = None,
    normalization_reason: str | None = None,
    http_status: int | None = None,
    error_category: str | None = None,
) -> None:
    with session() as db:
        db.add(SampleRow(
            run_id=run_id, side=side, cell_id=cell_id, prompt=prompt, answer=answer, raw_hash=raw_hash,
            latency_ms=latency_ms, valid=int(valid), error=error, response_preview=response_preview,
            normalization_reason=normalization_reason, http_status=http_status, error_category=error_category,
            created_at=utc_now(),
        ))


def _profile_id(model_id: str, protocol: str) -> str:
    return f"{model_id}.{protocol}.reference-gateway.v1"


def _minimum_valid_samples(sample_count: int) -> int:
    return max(2, math.ceil(sample_count * MIN_VALID_RATE))


def _empty_cell_analysis(cell: ProbeCell) -> dict[str, Any]:
    return {
        "cell_id": cell.id,
        "category": cell.category,
        "attempted": 0,
        "transport_success": 0,
        "transport_failures": 0,
        "valid": 0,
        "invalid": 0,
        "valid_rate": 0.0,
        "average_latency_ms": None,
        "answer_distribution": {},
        "normalization_failures": [],
        "transport_failure_summary": [],
        "response_examples": [],
    }


def sample_analysis(run_id: str, side: str | None = None) -> dict[str, Any]:
    with session() as db:
        query = db.query(SampleRow).filter_by(run_id=run_id)
        if side:
            query = query.filter_by(side=side)
        rows = [
            {column: getattr(row, column) for column in row.__table__.columns.keys()}
            for row in query.order_by(SampleRow.id).all()
        ]

    cells = {cell.id: _empty_cell_analysis(cell) for cell in BATTERY}
    answer_values: dict[str, list[str]] = defaultdict(list)
    normalization_reasons: dict[str, Counter[str]] = defaultdict(Counter)
    transport_errors: dict[str, Counter[tuple[str, int | None, str]]] = defaultdict(Counter)
    latencies: dict[str, list[int]] = defaultdict(list)

    for row in rows:
        cell = cells.get(row["cell_id"])
        if not cell:
            continue
        cell["attempted"] += 1
        if row["latency_ms"] is not None:
            latencies[row["cell_id"]].append(row["latency_ms"])
        if row["error"]:
            cell["transport_failures"] += 1
            category = row.get("error_category") or "transport_error"
            transport_errors[row["cell_id"]][(category, row.get("http_status"), row["error"])] += 1
        else:
            cell["transport_success"] += 1
            if row["valid"]:
                cell["valid"] += 1
                if row["answer"]:
                    answer_values[row["cell_id"]].append(row["answer"])
            else:
                cell["invalid"] += 1
                normalization_reasons[row["cell_id"]][row.get("normalization_reason") or "unknown_normalization_failure"] += 1

        preview = row.get("response_preview")
        if preview and len(cell["response_examples"]) < 3:
            cell["response_examples"].append(
                {
                    "prompt": row["prompt"],
                    "response_preview": preview,
                    "outcome": "valid" if row["valid"] else ("transport_failure" if row["error"] else "invalid_format"),
                    "reason": row.get("error_category") if row["error"] else row.get("normalization_reason"),
                }
            )

    for cell in cells.values():
        cell_id = cell["cell_id"]
        cell["valid_rate"] = round(cell["valid"] / cell["attempted"], 3) if cell["attempted"] else 0.0
        cell["average_latency_ms"] = round(sum(latencies[cell_id]) / len(latencies[cell_id])) if latencies[cell_id] else None
        cell["answer_distribution"] = distribution(answer_values[cell_id]) if answer_values[cell_id] else {}
        cell["normalization_failures"] = [
            {"code": code, "label": NORMALIZATION_LABELS.get(code, code), "count": count}
            for code, count in normalization_reasons[cell_id].most_common()
        ]
        cell["transport_failure_summary"] = [
            {"category": category, "http_status": status, "message": message, "count": count}
            for (category, status, message), count in transport_errors[cell_id].most_common()
        ]

    values = list(cells.values())
    attempted = sum(cell["attempted"] for cell in values)
    valid = sum(cell["valid"] for cell in values)
    transport_failures = sum(cell["transport_failures"] for cell in values)
    all_latencies = [latency for group in latencies.values() for latency in group]
    return {
        "attempted": attempted,
        "transport_success": attempted - transport_failures,
        "transport_failures": transport_failures,
        "valid": valid,
        "invalid": attempted - transport_failures - valid,
        "valid_rate": round(valid / attempted, 3) if attempted else 0.0,
        "average_latency_ms": round(sum(all_latencies) / len(all_latencies)) if all_latencies else None,
        "cells": values,
        "historical_detail_notice": "早于报告增强版本的运行可能没有 response_examples。" if rows and not any(row.get("response_preview") for row in rows) else None,
    }


def baseline_quality(summary: dict[str, Any], sample_count: int) -> dict[str, Any]:
    required_per_cell = _minimum_valid_samples(sample_count)
    missing_cells = [cell["cell_id"] for cell in summary["cells"] if cell["valid"] < required_per_cell]
    reasons: list[dict[str, Any]] = []
    if summary["transport_failures"]:
        reasons.append({"code": "reference_transport_failures", "message": f"参考端有 {summary['transport_failures']} 次请求未成功完成。"})
    if missing_cells:
        reasons.append({"code": "insufficient_valid_samples", "message": f"{len(missing_cells)} 个 Probe Cell 未达到每格至少 {required_per_cell} 条有效样本的要求。", "cells": missing_cells})
    if summary["valid_rate"] < MIN_VALID_RATE:
        reasons.append({"code": "valid_rate_below_threshold", "message": f"有效样本率为 {summary['valid_rate']:.1%}，低于 {MIN_VALID_RATE:.0%} 的基线质量门槛。"})
    ready = not reasons
    return {
        "ready": ready,
        "minimum_valid_per_cell": required_per_cell,
        "minimum_valid_rate": MIN_VALID_RATE,
        "observed_valid_rate": summary["valid_rate"],
        "missing_cells": missing_cells,
        "reasons": reasons,
        "recommended_actions": [] if ready else ["检查参考网关的限流和服务端错误后重新采集。", "确认网关返回体符合所选协议，并让模型严格只输出要求的短答案。"],
    }


def profile_is_auditable(profile: dict) -> bool:
    if profile["state"] != "calibrated":
        return False
    baseline = profile.get("baseline") or {}
    if any(not baseline.get(cell.id) for cell in BATTERY):
        return False
    quality = profile.get("quality") or {}
    return quality.get("ready", True)


async def run_enrollment(run_id: str, model_id: str, protocol: str, gateway: dict, sample_count: int) -> None:
    update_run(run_id, status="running", started_at=utc_now())
    model = get_model(model_id)
    grouped: dict[str, list[str]] = defaultdict(list)
    try:
        for index in range(sample_count * len(BATTERY)):
            current = get_run(run_id)
            if current and current["status"] == "cancelled":
                return
            # 请求间隔，避免触发上游 RPM 限流
            if index and settings.request_interval_seconds > 0:
                await asyncio.sleep(settings.request_interval_seconds)
            cell, prompt = choose_probe(index)
            try:
                response = await generate(protocol, gateway["base_url"], gateway["api_key"], model["api_model_id"], prompt, "只输出最终答案。" if protocol != "openai_responses" else None, gateway["routes"].get(protocol, {}).get("path"))
                normalized = normalize_answer(cell, response.text)
                insert_sample(run_id, "reference", cell.id, prompt, normalized.answer, response.raw_hash, response.latency_ms, normalized.valid, response_preview=_preview(response.text), normalization_reason=normalized.reason)
                if normalized.valid and normalized.answer:
                    grouped[cell.id].append(normalized.answer)
            except Exception as exc:  # noqa: BLE001
                message, http_status, category = _error_details(exc)
                insert_sample(run_id, "reference", cell.id, prompt, None, None, None, False, message, http_status=http_status, error_category=category)

        summary = sample_analysis(run_id, "reference")
        quality = baseline_quality(summary, sample_count)
        baseline = {cell_id: distribution(values) for cell_id, values in grouped.items()}
        profile_id = _profile_id(model_id, protocol)
        state = "calibrated" if quality["ready"] and sample_count >= 10 else "baseline_ready" if quality["ready"] else "failed"
        decision = {
            "status": "BASELINE_READY" if quality["ready"] else "BASELINE_REJECTED",
            "title": "参考基线已校准" if quality["ready"] else "参考基线未通过质量检查",
            "summary": "该基线可用于后续站点检验。" if state == "calibrated" else "样本不足或回答质量不符合要求，不能作为检验的基准。",
            "reasons": quality["reasons"],
            "recommended_actions": quality["recommended_actions"],
        }
        now = utc_now()
        with session() as db:
            existing = db.get(ProfileRow, profile_id)
            values = {
                "gateway_id": gateway["id"],
                "state": state,
                "sampling_json": json_dumps({"sample_count": sample_count, "temperature": 1.0, "top_p": 1.0, "max_output_tokens": 32}),
                "capabilities_json": json_dumps({"accepted_parameters": ["temperature", "top_p", "max_tokens", "stream"], "probe_revision": "protocol-capabilities/v2"}),
                "baseline_json": json_dumps(baseline),
                "threshold_json": json_dumps({"match_threshold": 0.10, "mismatch_threshold": 0.22}),
                "quality_json": json_dumps(quality),
                "updated_at": now,
            }
            if existing:
                for field, value in values.items():
                    setattr(existing, field, value)
            else:
                db.add(ProfileRow(id=profile_id, model_id=model_id, provider=model["provider"], api_model_id=model["api_model_id"], protocol=protocol, created_at=now, **values))
        update_run(run_id, status="completed", result_json={"profile_id": profile_id, "profile_state": state, "decision": decision, "sample_summary": summary, "quality": quality}, finished_at=utc_now())
    except Exception as exc:  # noqa: BLE001
        update_run(run_id, status="failed", error=str(exc)[:1000], finished_at=utc_now())


async def run_audit(run_id: str, profile: dict, suspect: dict, sample_count: int) -> None:
    update_run(run_id, status="running", started_at=utc_now())
    model = get_model(profile["model_id"])
    baseline = profile["baseline"]
    suspect_values: dict[str, list[str]] = defaultdict(list)
    try:
        for index in range(sample_count * len(BATTERY)):
            current = get_run(run_id)
            if current and current["status"] == "cancelled":
                return
            # 请求间隔，避免触发上游 RPM 限流
            if index and settings.request_interval_seconds > 0:
                await asyncio.sleep(settings.request_interval_seconds)
            cell, prompt = choose_probe(index)
            try:
                response = await generate(profile["protocol"], suspect["base_url"], suspect["api_key"], suspect.get("model_id") or model["api_model_id"], prompt, "只输出最终答案。" if profile["protocol"] != "openai_responses" else None, suspect.get("path"))
                normalized = normalize_answer(cell, response.text)
                insert_sample(run_id, "suspect", cell.id, prompt, normalized.answer, response.raw_hash, response.latency_ms, normalized.valid, response_preview=_preview(response.text), normalization_reason=normalized.reason)
                if normalized.valid and normalized.answer:
                    suspect_values[cell.id].append(normalized.answer)
            except Exception as exc:  # noqa: BLE001
                message, http_status, category = _error_details(exc)
                insert_sample(run_id, "suspect", cell.id, prompt, None, None, None, False, message, http_status=http_status, error_category=category)

        summary = sample_analysis(run_id, "suspect")
        by_cell = {cell["cell_id"]: cell for cell in summary["cells"]}
        required_per_cell = _minimum_valid_samples(sample_count)
        cell_results = []
        distances: list[float] = []
        unavailable_cells: list[str] = []
        for cell in BATTERY:
            evidence = by_cell[cell.id]
            ref = baseline.get(cell.id, {})
            if not ref:
                unavailable_cells.append(cell.id)
                cell_results.append({"cell_id": cell.id, "status": "reference_baseline_missing", "reference_distribution": {}, "suspect_distribution": evidence["answer_distribution"], "valid_samples": evidence["valid"], "required_valid_samples": required_per_cell})
                continue
            if evidence["valid"] < required_per_cell:
                unavailable_cells.append(cell.id)
                cell_results.append({"cell_id": cell.id, "status": "insufficient_suspect_evidence", "reference_distribution": ref, "suspect_distribution": evidence["answer_distribution"], "valid_samples": evidence["valid"], "required_valid_samples": required_per_cell})
                continue
            categories = list(ref.keys())
            current = distribution(suspect_values[cell.id], categories)
            distance = jsd(ref, current)
            ci = bootstrap_jsd([key for key, count in ref.items() for _ in range(max(1, round(count * 100)))], suspect_values[cell.id], categories, run_id)
            distances.append(distance)
            cell_results.append({"cell_id": cell.id, "status": "comparable", "reference_distribution": ref, "suspect_distribution": current, "jsd": distance, "ci_95": ci, "valid_samples": evidence["valid"], "required_valid_samples": required_per_cell})

        aggregate = round(sum(distances) / len(distances), 6) if len(distances) == len(BATTERY) else None
        threshold = profile["threshold"]
        reasons: list[dict[str, Any]] = []
        if unavailable_cells:
            reasons.append({"code": "insufficient_comparable_cells", "message": f"{len(unavailable_cells)} 个 Probe Cell 没有足够的可比较样本。", "cells": unavailable_cells})
        if sample_count < 10:
            reasons.append({"code": "audit_budget_below_recommended", "message": "每个 Probe Cell 至少需要 10 个样本才能形成一致性结论。"})
        if summary["transport_failures"]:
            reasons.append({"code": "suspect_transport_failures", "message": f"待测端有 {summary['transport_failures']} 次请求未成功完成。"})

        if reasons:
            verdict = "INCONCLUSIVE"
            title = "证据不足，无法比较"
            conclusion = "待测响应、参考基线或请求预算不满足统计比较条件。"
        elif aggregate is not None and aggregate <= threshold["match_threshold"]:
            verdict = "CONSISTENT_WITH_REFERENCE"
            title = "行为分布与参考基线一致"
            conclusion = "在当前 Probe Battery、协议与样本预算下，未发现待测端点与参考基线的统计不一致。"
        elif aggregate is not None and aggregate >= threshold["mismatch_threshold"]:
            verdict = "INCOMPATIBLE_WITH_REFERENCE"
            title = "行为分布与参考基线不兼容"
            conclusion = "在当前 Probe Battery、协议与样本预算下，待测端点与参考基线存在显著统计差异。"
        else:
            verdict = "INCONCLUSIVE"
            title = "统计距离处于不确定区间"
            conclusion = "已获得可比较样本，但聚合距离没有达到一致或不兼容阈值。"

        result = {
            "verdict": verdict,
            "decision": {"status": verdict, "title": title, "summary": conclusion, "reasons": reasons, "recommended_actions": ["查看每个检查项的回答摘要与失败分类。", "若结果处于不确定区间，增加采样次数后重新检验。"] if verdict == "INCONCLUSIVE" else []},
            "aggregate_jsd": aggregate,
            "threshold": threshold,
            "comparison": {"required_valid_samples_per_cell": required_per_cell, "comparable_cells": len(distances), "total_cells": len(BATTERY), "cells": cell_results},
            "sample_summary": summary,
            "reference_profile": {"id": profile["id"], "state": profile["state"], "quality": profile.get("quality", {})},
            "sample_count": sample_count,
            "reference_source_type": "gateway",
            "limitations": ["基线来自参考网关，不是厂商直连证明。", "黑盒比较只能说明当前采样条件下的行为统计关系。"],
        }
        update_run(run_id, status="completed", result_json=result, finished_at=utc_now())
    except Exception as exc:  # noqa: BLE001
        update_run(run_id, status="failed", error=str(exc)[:1000], finished_at=utc_now())


def get_report(run_id: str) -> dict | None:
    run = get_run(run_id)
    if not run:
        return None
    result = run.get("result") or {}
    fallback = {"status": run["status"].upper(), "title": "运行尚未产生分析结果", "summary": run.get("error") or "任务仍在执行或尚未写入报告。", "reasons": [], "recommended_actions": []}
    if run["status"] == "cancelled":
        fallback = {"status": "CANCELLED", "title": "任务已取消", "summary": "报告仅包含取消前已采集的部分样本，不能作为结论依据。", "reasons": [], "recommended_actions": []}
    side = "reference" if run["kind"] == "enrollment" else "suspect" if run["kind"] == "audit" else None
    evidence = sample_analysis(run_id, side)
    profile_id = result.get("profile_id") if run["kind"] == "enrollment" else run["profile_id"]
    profile = get_profile(profile_id) if profile_id else None
    return {
        "run": run,
        "decision": result.get("decision") or fallback,
        "evidence": evidence,
        "comparison": result.get("comparison"),
        "quality": result.get("quality") or (profile or {}).get("quality"),
        "result": result,
        "profile": profile,
    }


def start(coro) -> None:
    asyncio.create_task(coro)
