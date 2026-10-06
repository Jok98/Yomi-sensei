from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from pathlib import Path


def resolve_codex_default() -> str:
    configured = os.getenv("CODEX_EXECUTABLE", "").strip()
    if configured:
        return configured
    on_path = shutil.which("codex")
    if on_path:
        return on_path
    local_app_data = os.getenv("LOCALAPPDATA")
    if os.name == "nt" and local_app_data:
        binaries = Path(local_app_data) / "OpenAI" / "Codex" / "bin"
        if binaries.is_dir():
            candidates = list(binaries.glob("*/codex.exe"))
            if candidates:
                return str(max(candidates, key=lambda file: file.stat().st_mtime))
    return "codex"


@dataclass(frozen=True, slots=True)
class Settings:
    codex_executable: str
    codex_model: str | None
    codex_timeout_seconds: int
    stockfish_path: str
    stockfish_depth: int
    maia_runtime: str
    maia_command: tuple[str, ...]

    @classmethod
    def from_environment(cls) -> "Settings":
        configured_path = os.getenv("STOCKFISH_PATH", "").strip()
        stockfish_path = (
            configured_path
            or shutil.which("stockfish")
            or "/usr/games/stockfish"
        )

        raw_depth = os.getenv("STOCKFISH_DEPTH", "16")
        try:
            depth = max(8, min(24, int(raw_depth)))
        except ValueError:
            depth = 16

        raw_timeout = os.getenv("CODEX_TIMEOUT_SECONDS", "120")
        try:
            timeout = max(15, min(600, int(raw_timeout)))
        except ValueError:
            timeout = 120

        project = Path(__file__).resolve().parent.parent
        maia_runtime = os.getenv("MAIA_RUNTIME_DIR") or str(project / ".runtime" / "maia")
        worker = os.getenv("MAIA_WORKER_PATH", "").strip()
        maia_python = os.getenv("MAIA_PYTHON_PATH") or str(
            project / ".venv-maia" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        )
        maia_command = (worker,) if worker else (maia_python, "-u", str(project / "app" / "maia_worker.py"))

        return cls(
            codex_executable=resolve_codex_default(),
            codex_model=os.getenv("CODEX_MODEL", "").strip() or None,
            codex_timeout_seconds=timeout,
            stockfish_path=stockfish_path,
            stockfish_depth=depth,
            maia_runtime=maia_runtime,
            maia_command=maia_command,
        )


settings = Settings.from_environment()
