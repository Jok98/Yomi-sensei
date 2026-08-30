from __future__ import annotations

import os
import shutil
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Settings:
    codex_executable: str
    codex_model: str | None
    codex_timeout_seconds: int
    stockfish_path: str
    stockfish_depth: int

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

        return cls(
            codex_executable=os.getenv("CODEX_EXECUTABLE", "codex").strip() or "codex",
            codex_model=os.getenv("CODEX_MODEL", "").strip() or None,
            codex_timeout_seconds=timeout,
            stockfish_path=stockfish_path,
            stockfish_depth=depth,
        )


settings = Settings.from_environment()
