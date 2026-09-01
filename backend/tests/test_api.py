import os

os.environ["ATTEST_DATA_DIR"] = "/tmp/attest-test-api"
os.environ["ATTEST_AUTH_PASSWORD"] = "dev-password"

from fastapi.testclient import TestClient

from attest import api
from attest.api import app
from attest.storage import json_dumps, session, utc_now
from attest.storage.models import GatewayConnection, Profile, Run
from attest.probes import BATTERY


def test_auth_boundary():
    with TestClient(app) as client:
        assert client.get("/api/models").status_code == 401
        login = client.post("/api/auth/login", json={"password": "dev-password"})
        assert login.status_code == 200
        assert len(client.get("/api/models").json()) == 14
        client.post("/api/auth/logout")
        assert client.get("/api/models").status_code == 401


def test_audit_accepts_url_payload_and_queues_run(monkeypatch):
    def discard_background_task(coro):
        coro.close()

    monkeypatch.setattr(api, "start", discard_background_task)
    gateway_id = "gw_audit_test"
    profile_id = "gpt-5.6-sol.openai_responses.reference-gateway.v1"
    now = utc_now()
    with session() as db:
        db.query(Run).filter_by(profile_id=profile_id).delete()
        db.query(Profile).filter_by(id=profile_id).delete()
        db.query(GatewayConnection).filter_by(id=gateway_id).delete()
        db.add(GatewayConnection(id=gateway_id, name="Audit test gateway", base_url="https://reference.example/v1", api_key="reference-key", routes_json="{}", created_at=now))
        db.add(Profile(
            id=profile_id, model_id="gpt-5.6-sol", provider="OpenAI", api_model_id="gpt-5.6-sol",
            protocol="openai_responses", gateway_id=gateway_id, state="calibrated",
            sampling_json=json_dumps({"sample_count": 10}), capabilities_json=json_dumps({}),
            baseline_json=json_dumps({cell.id: {cell.answers[0]: 1.0} for cell in BATTERY}),
            threshold_json=json_dumps({"match_threshold": 0.1, "mismatch_threshold": 0.22}),
            quality_json=json_dumps({"ready": True}), created_at=now, updated_at=now,
        ))

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"password": "dev-password"})
        response = client.post(
            "/api/audits",
            json={
                "profile_id": profile_id,
                "suspect_base_url": "https://suspect.example/v1",
                "suspect_api_key": "suspect-key",
                "sample_count": 10,
            },
        )
        assert response.status_code == 200
        run = client.get(f"/api/runs/{response.json()['run_id']}").json()
        assert run["request"]["suspect_base_url"] == "https://suspect.example/v1"
        assert run["request"]["suspect_api_key"] == "[redacted]"


def test_audit_rejects_profile_without_a_valid_baseline():
    gateway_id = "gw_invalid_baseline"
    profile_id = "gpt-5.6-terra.openai_responses.reference-gateway.v1"
    now = utc_now()
    with session() as db:
        db.query(Profile).filter_by(id=profile_id).delete()
        db.query(GatewayConnection).filter_by(id=gateway_id).delete()
        db.add(GatewayConnection(id=gateway_id, name="Invalid baseline gateway", base_url="https://reference.example/v1", api_key="reference-key", routes_json="{}", created_at=now))
        db.add(Profile(
            id=profile_id, model_id="openai.gpt-5.6-terra", provider="openai", api_model_id="gpt-5.6-terra",
            protocol="openai_responses", gateway_id=gateway_id, state="failed",
            sampling_json=json_dumps({"sample_count": 10}), capabilities_json=json_dumps({}),
            baseline_json=json_dumps({}), threshold_json=json_dumps({"match_threshold": 0.1, "mismatch_threshold": 0.22}),
            quality_json=json_dumps({"ready": False}), created_at=now, updated_at=now,
        ))

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"password": "dev-password"})
        response = client.post("/api/audits", json={"profile_id": profile_id, "suspect_base_url": "https://suspect.example/v1", "suspect_api_key": "suspect-key", "sample_count": 10})
        assert response.status_code == 409
        assert "valid baseline" in response.json()["detail"]
