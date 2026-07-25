"""Regression tests for the security fixes on the Corgi Hop backend.

Covers:
- Basic /api health.
- Status CRUD (existing endpoints).
- CORS whitelist (whitelisted origins receive ACAO, random origins do NOT).
- generate_assets.py fails cleanly when EMERGENT_LLM_KEY is missing.
- .gitignore ignores both /app/backend/.env and /app/frontend/.env.
"""
import os
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://hop-mobile-game.preview.emergentagent.com").rstrip("/")
LOCAL_URL = "http://localhost:8001"

WHITELISTED = [
    "https://hop-mobile-game.preview.emergentagent.com",
    "http://localhost:3000",
    "http://localhost:5173",
    "capacitor://localhost",
    "http://localhost",
]
EVIL_ORIGIN = "https://evil.example.com"


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Health ----
class TestHealth:
    def test_api_root_public(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("message") == "Hello World"

    def test_api_root_local(self, api_client):
        r = api_client.get(f"{LOCAL_URL}/api/")
        assert r.status_code == 200


# ---- Status CRUD (persistence check) ----
class TestStatusCRUD:
    def test_create_and_list_status(self, api_client):
        payload = {"client_name": "TEST_regression_corgihop"}
        r = api_client.post(f"{BASE_URL}/api/status", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["client_name"] == payload["client_name"]
        assert "id" in data and "timestamp" in data

        # GET-verify persistence
        r2 = api_client.get(f"{BASE_URL}/api/status")
        assert r2.status_code == 200
        names = [x["client_name"] for x in r2.json()]
        assert payload["client_name"] in names


# ---- CORS whitelist (main security fix under test) ----
class TestCORS:
    @pytest.mark.parametrize("origin", WHITELISTED)
    def test_whitelisted_origin_receives_acao(self, api_client, origin):
        # Preflight
        r = api_client.options(
            f"{LOCAL_URL}/api/status",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        acao = r.headers.get("access-control-allow-origin")
        assert acao == origin, f"Preflight ACAO mismatch for {origin}: got {acao!r}"
        acac = r.headers.get("access-control-allow-credentials")
        assert acac == "true"

        # Simple GET with Origin
        r2 = api_client.get(f"{LOCAL_URL}/api/", headers={"Origin": origin})
        assert r2.headers.get("access-control-allow-origin") == origin

    def test_evil_origin_does_not_receive_acao(self, api_client):
        r = api_client.options(
            f"{LOCAL_URL}/api/status",
            headers={
                "Origin": EVIL_ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        # Starlette CORS silently drops the header when origin not allowed
        assert "access-control-allow-origin" not in {k.lower() for k in r.headers.keys()}, (
            f"evil origin got ACAO header: {dict(r.headers)}"
        )

        r2 = api_client.get(f"{LOCAL_URL}/api/", headers={"Origin": EVIL_ORIGIN})
        assert r2.headers.get("access-control-allow-origin") is None

    def test_no_origin_no_acao(self, api_client):
        # Without any Origin header, plain requests should still work (no CORS involvement)
        r = api_client.get(f"{LOCAL_URL}/api/")
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") is None


# ---- generate_assets.py env-key security fix ----
class TestGenerateAssetsEnvGuard:
    def test_missing_emergent_llm_key_exits_cleanly(self):
        env = {k: v for k, v in os.environ.items() if k != "EMERGENT_LLM_KEY"}
        # Prevent the .env in /app/backend from being read to inject a real key
        env["EMERGENT_LLM_KEY"] = ""  # empty so os.getenv returns "" which is falsy
        proc = subprocess.run(
            ["python3", "/app/frontend/scripts/generate_assets.py", "corgi_idle"],
            capture_output=True,
            text=True,
            env=env,
            timeout=15,
        )
        assert proc.returncode != 0, f"Expected non-zero exit. stdout={proc.stdout} stderr={proc.stderr}"
        combined = (proc.stdout + proc.stderr).lower()
        assert "emergent_llm_key" in combined, (
            f"Expected an EMERGENT_LLM_KEY error message. Got: {proc.stdout} / {proc.stderr}"
        )


# ---- .gitignore protects .env files ----
class TestGitignore:
    def test_backend_env_ignored(self):
        proc = subprocess.run(
            ["git", "check-ignore", "-v", "backend/.env"],
            cwd="/app",
            capture_output=True,
            text=True,
        )
        assert proc.returncode == 0, f"backend/.env not ignored: {proc.stdout} {proc.stderr}"
        assert "backend/.env" in proc.stdout

    def test_frontend_env_ignored(self):
        proc = subprocess.run(
            ["git", "check-ignore", "-v", "frontend/.env"],
            cwd="/app",
            capture_output=True,
            text=True,
        )
        assert proc.returncode == 0, f"frontend/.env not ignored: {proc.stdout} {proc.stderr}"
        assert "frontend/.env" in proc.stdout
