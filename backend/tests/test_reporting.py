from attest.normalize import normalize_answer
from attest.probes import BATTERY
from attest.service import baseline_quality, create_run, get_report, insert_sample, sample_analysis, update_run


def test_normalization_requires_the_requested_short_answer():
    assert normalize_answer(BATTERY[0], "7").valid is True
    result = normalize_answer(BATTERY[0], "The answer is 7")
    assert result.valid is False
    assert result.reason == "expected_single_number"


def test_report_explains_invalid_samples_with_preview():
    run_id = create_run("enrollment", "reporting-test", {"sample_count": 10})
    insert_sample(run_id, "reference", BATTERY[0].id, "Choose a number", None, "hash", 120, False, response_preview="The answer is 7", normalization_reason="expected_single_number")
    insert_sample(run_id, "reference", BATTERY[1].id, "Choose a number", None, None, None, False, "rate limited", http_status=429, error_category="rate_limited")
    summary = sample_analysis(run_id, "reference")
    quality = baseline_quality(summary, 10)
    update_run(run_id, status="completed", result_json={"decision": {"status": "BASELINE_REJECTED", "title": "参考基线未通过质量检查", "summary": "无有效样本", "reasons": quality["reasons"], "recommended_actions": []}, "quality": quality}, finished_at="2026-01-01T00:00:00+00:00")

    report = get_report(run_id)
    first_cell = report["evidence"]["cells"][0]
    second_cell = report["evidence"]["cells"][1]
    assert report["decision"]["status"] == "BASELINE_REJECTED"
    assert first_cell["normalization_failures"][0]["code"] == "expected_single_number"
    assert first_cell["response_examples"][0]["response_preview"] == "The answer is 7"
    assert second_cell["transport_failure_summary"][0]["http_status"] == 429
