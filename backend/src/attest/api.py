from __future__ import annotations

import json
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response, status
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, HttpUrl

from .auth import create_session, delete_session, require_session, verify_password
from .catalog import MODEL_CATALOG, get_model
from .config import settings
from .storage import init_db, json_dumps, json_loads, session, utc_now
from .storage.models import GatewayConnection as GatewayRow, Profile as ProfileRow, Run as RunRow, Sample as SampleRow
from .service import create_run, get_profile, get_report, get_run, list_profiles, list_runs, profile_is_auditable, run_audit, run_enrollment, start, update_run

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Attest", version="0.1.0", lifespan=lifespan)


class LoginRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class GatewayRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_url: HttpUrl
    api_key: str = Field(min_length=1, max_length=512)
    routes: dict[str, dict[str, str]] = Field(default_factory=dict)


class EnrollmentRequest(BaseModel):
    model_id: str
    protocol: str
    gateway_id: str
    sample_count: int = Field(default=10, ge=2, le=500)


class AuditRequest(BaseModel):
    profile_id: str
    suspect_base_url: HttpUrl
    suspect_api_key: str = Field(min_length=1, max_length=512)
    suspect_model_id: str | None = None
    suspect_path: str | None = None
    label: str | None = Field(default=None, max_length=100)
    sample_count: int = Field(default=10, ge=2, le=500)


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok", "data_dir": str(settings.data_dir)}


@app.post("/api/auth/login")
async def login(payload: LoginRequest, response: Response) -> dict:
    if not verify_password(payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")
    token = create_session()
    response.set_cookie("attest_session", token, httponly=True, samesite="lax", max_age=settings.session_hours * 3600, secure=settings.cookie_secure, path="/")
    return {"authenticated": True}


@app.post("/api/auth/logout")
async def logout(response: Response, attest_session: str | None = Cookie(default=None)) -> dict:
    delete_session(attest_session)
    response.delete_cookie("attest_session", path="/")
    return {"authenticated": False}


@app.get("/api/auth/me")
async def me(_: str = Depends(require_session)) -> dict:
    return {"authenticated": True}


@app.get("/api/models")
async def models(_: str = Depends(require_session)) -> list[dict]:
    return MODEL_CATALOG


def _gateway_to_dict(row: GatewayRow) -> dict:
    return {
        "id": row.id, "name": row.name, "base_url": row.base_url,
        "routes": json_loads(row.routes_json, {}), "created_at": row.created_at,
    }


@app.get("/api/gateways")
async def gateways(_: str = Depends(require_session)) -> list[dict]:
    with session() as db:
        rows = db.query(GatewayRow).order_by(GatewayRow.created_at.desc()).all()
    return [_gateway_to_dict(row) for row in rows]


@app.post("/api/gateways")
async def add_gateway(payload: GatewayRequest, _: str = Depends(require_session)) -> dict:
    gateway_id = "gw_" + re.sub(r"[^a-z0-9]", "", payload.name.lower())[:16] + "_" + utc_now().replace("-", "").replace(":", "").replace("+", "")[-8:]
    routes = payload.routes or {
        "openai_responses": {"path": "/v1/responses"},
        "openai_chat_completions": {"path": "/v1/chat/completions"},
        "anthropic_messages": {"path": "/v1/messages"},
    }
    with session() as db:
        db.add(GatewayRow(id=gateway_id, name=payload.name, base_url=str(payload.base_url), api_key=payload.api_key, routes_json=json_dumps(routes), created_at=utc_now()))
    return {"id": gateway_id, "name": payload.name, "base_url": str(payload.base_url), "routes": routes}


def gateway_by_id(gateway_id: str) -> dict:
    with session() as db:
        row = db.get(GatewayRow, gateway_id)
        if not row:
            raise HTTPException(status_code=404, detail="gateway not found")
        data = {column: getattr(row, column) for column in row.__table__.columns.keys()}
    data["routes"] = json_loads(data.pop("routes_json"), {})
    return data


class GatewayUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    base_url: HttpUrl | None = None
    api_key: str | None = Field(default=None, min_length=1, max_length=512)
    routes: dict[str, dict[str, str]] | None = None


@app.put("/api/gateways/{gateway_id}")
async def update_gateway(gateway_id: str, payload: GatewayUpdateRequest, _: str = Depends(require_session)) -> dict:
    existing = gateway_by_id(gateway_id)
    name = payload.name if payload.name is not None else existing["name"]
    base_url = str(payload.base_url) if payload.base_url is not None else existing["base_url"]
    api_key = payload.api_key if payload.api_key is not None else existing["api_key"]
    routes = payload.routes if payload.routes is not None else existing["routes"]
    with session() as db:
        db.query(GatewayRow).filter_by(id=gateway_id).update({"name": name, "base_url": base_url, "api_key": api_key, "routes_json": json_dumps(routes)})
    return {"id": gateway_id, "name": name, "base_url": base_url, "routes": routes, "created_at": existing.get("created_at")}


@app.delete("/api/gateways/{gateway_id}")
async def delete_gateway(gateway_id: str, _: str = Depends(require_session)) -> dict:
    gateway_by_id(gateway_id)
    with session() as db:
        db.query(GatewayRow).filter_by(id=gateway_id).delete()
    return {"deleted": gateway_id}


@app.get("/api/profiles")
async def profiles(_: str = Depends(require_session)) -> list[dict]:
    return list_profiles()


@app.post("/api/enrollments")
async def enroll(payload: EnrollmentRequest, _: str = Depends(require_session)) -> dict:
    model = get_model(payload.model_id)
    if payload.protocol not in model["protocols"]:
        raise HTTPException(status_code=400, detail="protocol is not enabled for this model")
    gateway = gateway_by_id(payload.gateway_id)
    run_id = create_run("enrollment", f"{payload.model_id}.{payload.protocol}", payload.model_dump())
    start(run_enrollment(run_id, payload.model_id, payload.protocol, gateway, payload.sample_count))
    return {"run_id": run_id}


@app.post("/api/audits")
async def audit(payload: AuditRequest, _: str = Depends(require_session)) -> dict:
    profile = get_profile(payload.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="profile not found")
    if not profile_is_auditable(profile):
        raise HTTPException(status_code=409, detail="reference profile is not calibrated with a complete valid baseline; review its enrollment report and collect a new baseline")
    with session() as db:
        gateway_row = db.get(GatewayRow, profile["gateway_id"])
    if not gateway_row:
        raise HTTPException(status_code=409, detail="reference gateway not found")
    suspect = {"base_url": str(payload.suspect_base_url), "api_key": payload.suspect_api_key, "model_id": payload.suspect_model_id, "path": payload.suspect_path}
    # HttpUrl is a Pydantic value object; persist its JSON representation rather
    # than passing it through the stdlib JSON encoder unchanged.
    request = payload.model_dump(mode="json", exclude={"suspect_api_key"})
    run_id = create_run("audit", payload.profile_id, {**request, "suspect_api_key": "[redacted]"})
    start(run_audit(run_id, profile, suspect, payload.sample_count))
    return {"run_id": run_id}


@app.get("/api/runs")
async def runs(_: str = Depends(require_session)) -> list[dict]:
    return list_runs()


@app.get("/api/runs/{run_id}")
async def run_detail(run_id: str, _: str = Depends(require_session)) -> dict:
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    return run


@app.post("/api/runs/{run_id}/cancel")
async def cancel_run(run_id: str, _: str = Depends(require_session)) -> dict:
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    if run["status"] not in ("queued", "running"):
        raise HTTPException(status_code=409, detail="run is not active")
    update_run(run_id, status="cancelled", finished_at=utc_now())
    return {"run_id": run_id, "status": "cancelled"}


@app.delete("/api/runs/{run_id}")
async def remove_run(run_id: str, _: str = Depends(require_session)) -> dict:
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    if run["status"] in ("queued", "running"):
        update_run(run_id, status="cancelled", finished_at=utc_now())
    profile_deleted = False
    if run["kind"] == "enrollment":
        profile_id = (run.get("result") or {}).get("profile_id")
        if profile_id:
            others = [
                other for other in list_runs()
                if other["kind"] == "enrollment" and other["id"] != run_id
                and other["status"] == "completed"
                and (other.get("result") or {}).get("profile_id") == profile_id
            ]
            if not others:
                with session() as db:
                    db.query(ProfileRow).filter_by(id=profile_id).delete()
                profile_deleted = True
    with session() as db:
        db.query(SampleRow).filter_by(run_id=run_id).delete()
        db.query(RunRow).filter_by(id=run_id).delete()
    return {"deleted": run_id, "profile_deleted": profile_deleted}


@app.get("/api/reports/{run_id}")
async def report(run_id: str, _: str = Depends(require_session)) -> dict:
    report_data = get_report(run_id)
    if not report_data:
        raise HTTPException(status_code=404, detail="run not found")
    return report_data


def _static_dir() -> Path | None:
    # pip 安装后 __file__ 位于 site-packages，不能依赖相对路径；按优先级取第一个存在的目录：
    # 1. ATTEST_STATIC_DIR 显式指定；2. 源码仓库根目录的 static/（本地开发）；3. 容器约定的 /app/static
    override = os.getenv("ATTEST_STATIC_DIR")
    candidates = ([Path(override)] if override else []) + [
        Path(__file__).resolve().parents[2] / "static",
        Path("/app/static"),
    ]
    return next((candidate for candidate in candidates if candidate.is_dir()), None)


static_dir = _static_dir()
if static_dir:
    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        if path.startswith("api/"):
            return JSONResponse({"detail": "not found"}, status_code=404)
        requested = static_dir / path
        if requested.is_file() and static_dir in requested.parents:
            return FileResponse(requested)
        return FileResponse(static_dir / "index.html")
