from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.chess_service import (
    ChessRuleError,
    StockfishService,
    apply_move,
    new_game,
    parse_board,
    position_state,
)
from app.config import settings
from app.llm_service import CodexCliService, CodexUnavailable
from app.models import (
    AnalyzeRequest,
    AnalyzeResponse,
    ChatRequest,
    ChatResponse,
    ComputerMoveRequest,
    MoveClassificationRequest,
    MoveClassificationResponse,
    MoveRequest,
    PositionState,
)


stockfish = StockfishService(settings.stockfish_path, settings.stockfish_depth)
codex = CodexCliService(
    settings.codex_executable,
    settings.codex_model,
    settings.codex_timeout_seconds,
)
static_dir = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await stockfish.close()


app = FastAPI(
    title="Yomi Sensei",
    description="Scacchiera locale con analisi Stockfish e coach Codex CLI.",
    version="0.3.0",
    lifespan=lifespan,
)


@app.get("/api/health")
async def health() -> dict[str, object]:
    codex_status = await codex.status()
    return {
        "status": "ok",
        "stockfish": stockfish.available,
        "codex": codex_status["available"],
        "codex_authenticated": codex_status["authenticated"],
        "auth_mode": codex_status["auth_mode"],
        "model": codex.model_label,
    }


@app.get("/api/game/new", response_model=PositionState)
async def game_new() -> PositionState:
    return new_game()


@app.get("/api/codex/options")
async def codex_options() -> dict[str, object]:
    return await codex.model_options()


@app.post("/api/game/move", response_model=PositionState)
async def game_move(request: MoveRequest) -> PositionState:
    try:
        return apply_move(
            request.fen,
            request.from_square,
            request.to_square,
            request.promotion,
        )
    except ChessRuleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/game/computer-move", response_model=PositionState)
async def game_computer_move(request: ComputerMoveRequest) -> PositionState:
    try:
        return await stockfish.computer_move(request.fen, request.difficulty)
    except ChessRuleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/classify-move", response_model=MoveClassificationResponse)
async def classify_move(request: MoveClassificationRequest) -> MoveClassificationResponse:
    try:
        return await stockfish.classify_move(request.fen, request.move_uci, request.depth)
    except ChessRuleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/position", response_model=PositionState)
async def validate_position(request: AnalyzeRequest) -> PositionState:
    try:
        return position_state(parse_board(request.fen))
    except ChessRuleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    try:
        return await stockfish.analyze(
            request.fen,
            request.depth,
            request.include_replies,
        )
    except ChessRuleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    try:
        parse_board(request.fen)
        answer = await codex.chat(request)
        return ChatResponse(
            answer=answer,
            model=codex.model_label_for(request.model, request.reasoning_effort),
        )
    except ChessRuleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except CodexUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Il modello non ha risposto correttamente: {exc}",
        ) from exc


app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(static_dir / "index.html")


@app.get("/manifest.webmanifest", include_in_schema=False)
async def manifest() -> FileResponse:
    return FileResponse(
        static_dir / "manifest.webmanifest",
        media_type="application/manifest+json",
    )


@app.get("/sw.js", include_in_schema=False)
async def service_worker() -> FileResponse:
    return FileResponse(
        static_dir / "sw.js",
        media_type="application/javascript",
        headers={"Service-Worker-Allowed": "/"},
    )
