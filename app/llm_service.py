from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from app.models import ChatRequest


COACH_INSTRUCTIONS = """Sei Yomi Sensei, un coach di scacchi paziente e concreto.
Rispondi in italiano, a meno che l'utente chieda un'altra lingua.
La posizione FEN, lo storico PGN e l'analisi Stockfish forniti sono la fonte di verità.
Non inventare mosse legali o valutazioni: quando citi una variante, usa quelle fornite
oppure chiarisci che è un'idea da verificare. Spiega piani, tattiche, errori e alternative
in modo comprensibile. Distingui sempre la valutazione del motore dalla tua spiegazione.
Non usare strumenti, non leggere file e non tentare di modificare il computer.
Sii conciso per domande semplici e più didattico quando l'utente chiede analisi.
Concludi entro circa 500 parole."""


class CodexUnavailable(RuntimeError):
    pass


FALLBACK_MODELS = [
    {
        "slug": "gpt-5.6-sol",
        "display_name": "GPT-5.6-Sol",
        "default_reasoning_level": "low",
        "supported_reasoning_levels": ["low", "medium", "high", "xhigh", "max"],
    },
    {
        "slug": "gpt-5.6-terra",
        "display_name": "GPT-5.6-Terra",
        "default_reasoning_level": "medium",
        "supported_reasoning_levels": ["low", "medium", "high", "xhigh", "max"],
    },
    {
        "slug": "gpt-5.6-luna",
        "display_name": "GPT-5.6-Luna",
        "default_reasoning_level": "medium",
        "supported_reasoning_levels": ["low", "medium", "high", "xhigh", "max"],
    },
]
ALLOWED_REASONING_LEVELS = {"minimal", "low", "medium", "high", "xhigh", "max", "ultra"}
MODEL_SLUG_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$")


class CodexCliService:
    def __init__(
        self,
        executable: str = "codex",
        model: str | None = None,
        timeout_seconds: int = 120,
    ) -> None:
        self.requested_executable = executable
        self.executable = self._resolve_executable(executable)
        self.model = model
        self.timeout_seconds = timeout_seconds
        self._status_cache: tuple[float, dict[str, object]] | None = None
        self._model_catalog_cache: tuple[float, list[dict[str, object]], bool] | None = None

    @staticmethod
    def _resolve_executable(executable: str) -> str | None:
        resolved = shutil.which(executable)
        if resolved:
            return resolved
        candidate = Path(executable)
        return str(candidate) if candidate.is_file() else None

    @property
    def available(self) -> bool:
        return self.executable is not None

    @property
    def model_label(self) -> str:
        return self.model or "modello account"

    def model_label_for(
        self,
        model: str | None = None,
        reasoning_effort: str | None = None,
    ) -> str:
        label = model or self.model_label
        return f"{label} · {reasoning_effort}" if reasoning_effort else label

    def _base_arguments(
        self,
        model: str | None = None,
        reasoning_effort: str | None = None,
    ) -> list[str]:
        if self.executable is None:
            raise CodexUnavailable(
                "Codex CLI non è installato o non è nel PATH del container."
            )

        arguments = [
            self.executable,
            "exec",
            "--ephemeral",
            "--ignore-user-config",
            "--ignore-rules",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "--cd",
            tempfile.gettempdir(),
            "--color",
            "never",
            "-c",
            "project_doc_max_bytes=0",
            "-c",
            "features.shell_tool=false",
            "-c",
            "tools.web_search=false",
            "-c",
            "tools.view_image=false",
        ]
        effective_model = model or self.model
        if effective_model:
            arguments.extend(["--model", effective_model])
        if reasoning_effort:
            arguments.extend(["-c", f'model_reasoning_effort="{reasoning_effort}"'])
        arguments.append("-")
        return arguments

    @staticmethod
    def _prompt(request: ChatRequest) -> str:
        engine_lines = []
        for candidate in request.candidates:
            line = " ".join(candidate.principal_variation)
            engine_lines.append(
                f"{candidate.rank}. {candidate.san} ({candidate.uci}) | "
                f"esito atteso {candidate.expected_score_percent:.1f}% | "
                f"W/D/L {candidate.win_percent:.1f}/{candidate.draw_percent:.1f}/"
                f"{candidate.loss_percent:.1f} | valutazione {candidate.evaluation} | "
                f"linea: {line}"
            )
        engine_context = "\n".join(engine_lines) or "Analisi Stockfish non disponibile."

        opponent_lines = []
        for candidate in request.opponent_candidates:
            line = " ".join(candidate.principal_variation)
            opponent_lines.append(
                f"{candidate.rank}. {candidate.san} ({candidate.uci}) | "
                f"esito atteso {candidate.expected_score_percent:.1f}% | "
                f"W/D/L {candidate.win_percent:.1f}/{candidate.draw_percent:.1f}/"
                f"{candidate.loss_percent:.1f} | valutazione {candidate.evaluation} | "
                f"linea: {line}"
            )
        opponent_context = "\n".join(opponent_lines) or "Risposte avversarie non disponibili."

        history_lines = [
            f"{item.role.upper()}: {item.content}" for item in request.history
        ]
        history = "\n".join(history_lines) or "Nessun messaggio precedente."

        return (
            f"{COACH_INSTRUCTIONS}\n\n"
            "CONTESTO AFFIDABILE DELLA SCACCHIERA\n"
            f"FEN: {request.fen}\n"
            f"PGN/storico: {request.pgn or '(partita appena iniziata)'}\n"
            f"Top mosse Stockfish:\n{engine_context}\n\n"
            f"Top risposte avversarie dopo {request.opponent_after_san or 'la prima scelta'}:\n"
            f"{opponent_context}\n\n"
            "CONVERSAZIONE RECENTE\n"
            f"{history}\n\n"
            "DOMANDA ATTUALE DELL'UTENTE\n"
            f"{request.message}\n\n"
            "Rispondi soltanto con il messaggio destinato all'utente."
        )

    def _run_chat(
        self,
        prompt: str,
        model: str | None = None,
        reasoning_effort: str | None = None,
    ) -> str:
        creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        try:
            completed = subprocess.run(
                self._base_arguments(model, reasoning_effort),
                input=prompt,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=self.timeout_seconds,
                check=False,
                creationflags=creation_flags,
            )
        except subprocess.TimeoutExpired as exc:
            raise CodexUnavailable(
                f"Codex CLI non ha risposto entro {self.timeout_seconds} secondi."
            ) from exc
        except OSError as exc:
            raise CodexUnavailable(f"Impossibile avviare Codex CLI: {exc}") from exc

        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout).strip()
            if "login" in detail.lower() or "auth" in detail.lower():
                raise CodexUnavailable(
                    "Codex CLI non è autenticato. Esegui il login ChatGPT descritto nel README."
                )
            compact_detail = " ".join(detail.split())[:500]
            raise CodexUnavailable(
                f"Codex CLI è terminato con codice {completed.returncode}: "
                f"{compact_detail or 'nessun dettaglio disponibile'}"
            )

        answer = completed.stdout.strip()
        if not answer:
            raise CodexUnavailable("Codex CLI non ha restituito una risposta testuale.")
        return answer

    async def chat(self, request: ChatRequest) -> str:
        if not self.available:
            raise CodexUnavailable(
                "Codex CLI non è disponibile. Installalo oppure usa l'immagine Docker inclusa."
            )
        if request.model and not MODEL_SLUG_PATTERN.fullmatch(request.model):
            raise CodexUnavailable("Il modello Codex selezionato non è valido.")
        if (
            request.reasoning_effort
            and request.reasoning_effort not in ALLOWED_REASONING_LEVELS
        ):
            raise CodexUnavailable("Il livello di reasoning selezionato non è valido.")
        return await asyncio.to_thread(
            self._run_chat,
            self._prompt(request),
            request.model,
            request.reasoning_effort,
        )

    def _read_model_catalog(self) -> tuple[list[dict[str, object]], bool]:
        if self.executable is None:
            return FALLBACK_MODELS, False
        creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        try:
            completed = subprocess.run(
                [self.executable, "debug", "models"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=20,
                check=False,
                creationflags=creation_flags,
            )
            payload = json.loads(completed.stdout) if completed.returncode == 0 else {}
            models: list[dict[str, object]] = []
            for item in payload.get("models", []):
                if item.get("visibility") != "list" or not item.get("slug"):
                    continue
                levels = [
                    level.get("effort")
                    for level in item.get("supported_reasoning_levels", [])
                    if level.get("effort") in ALLOWED_REASONING_LEVELS
                ]
                models.append(
                    {
                        "slug": item["slug"],
                        "display_name": item.get("display_name") or item["slug"],
                        "default_reasoning_level": item.get("default_reasoning_level") or "medium",
                        "supported_reasoning_levels": levels or ["medium"],
                    }
                )
            if models:
                return models, True
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError, TypeError):
            pass
        return FALLBACK_MODELS, False

    async def model_options(self) -> dict[str, object]:
        now = time.monotonic()
        if self._model_catalog_cache and now - self._model_catalog_cache[0] < 300:
            models, dynamic = self._model_catalog_cache[1:]
        else:
            models, dynamic = await asyncio.to_thread(self._read_model_catalog)
            self._model_catalog_cache = (now, models, dynamic)
        return {
            "models": models,
            "configured_model": self.model,
            "default_reasoning_level": "medium",
            "catalog_source": "codex-cli" if dynamic else "fallback",
        }

    def _read_status(self) -> dict[str, object]:
        if self.executable is None:
            return {
                "available": False,
                "authenticated": False,
                "auth_mode": "non disponibile",
            }

        creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        try:
            completed = subprocess.run(
                [self.executable, "login", "status"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=8,
                check=False,
                creationflags=creation_flags,
            )
        except (OSError, subprocess.TimeoutExpired):
            return {
                "available": True,
                "authenticated": False,
                "auth_mode": "stato sconosciuto",
            }

        output = f"{completed.stdout}\n{completed.stderr}".strip()
        authenticated = completed.returncode == 0 and "logged in" in output.lower()
        if "chatgpt" in output.lower():
            auth_mode = "ChatGPT"
        elif authenticated:
            auth_mode = "autenticato"
        else:
            auth_mode = "login richiesto"
        return {
            "available": True,
            "authenticated": authenticated,
            "auth_mode": auth_mode,
        }

    async def status(self) -> dict[str, object]:
        now = time.monotonic()
        if self._status_cache and now - self._status_cache[0] < 60:
            return self._status_cache[1]
        result = await asyncio.to_thread(self._read_status)
        self._status_cache = (now, result)
        return result
