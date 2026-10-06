import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import resolve_codex_default


def test_explicit_codex_executable_takes_precedence(monkeypatch):
    monkeypatch.setenv("CODEX_EXECUTABLE", "missing-yomi-test-codex")
    assert resolve_codex_default() == "missing-yomi-test-codex"


def test_desktop_api_requires_its_ephemeral_token(monkeypatch):
    monkeypatch.setenv("YOMI_DESKTOP_TOKEN", "test-token")
    with TestClient(app) as client:
        assert client.get("/api/game/new").status_code == 403
        assert client.get("/api/game/new", headers={"x-yomi-token": "wrong"}).status_code == 403
        assert client.get("/api/game/new", headers={"x-yomi-token": "test-token"}).status_code == 200


def test_owned_backend_announces_loopback_and_exits_when_parent_closes():
    process = subprocess.Popen(
        [sys.executable, "-u", "-m", "app.desktop"],
        env={**os.environ, "YOMI_DESKTOP_TOKEN": "lifecycle-test", "CODEX_EXECUTABLE": "missing-test-codex"},
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    try:
        line = process.stdout.readline()
        assert line.startswith("YOMI_BACKEND "), line
        port = json.loads(line.removeprefix("YOMI_BACKEND "))["port"]
        request = urllib.request.Request(f"http://127.0.0.1:{port}/api/game/new", headers={"x-yomi-token": "lifecycle-test"})
        for attempt in range(50):
            try:
                with urllib.request.urlopen(request, timeout=1) as response:
                    assert len(json.load(response)["legal_moves"]) == 20
                break
            except urllib.error.URLError:
                if attempt == 49:
                    raise
                time.sleep(0.05)
        with pytest.raises(urllib.error.HTTPError) as denied:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/api/game/new", timeout=1)
        assert denied.value.code == 403
        process.stdin.close()
        assert process.wait(timeout=5) == 0
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
