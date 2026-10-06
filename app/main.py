from __future__ import annotations

from contextlib import asynccontextmanager
import asyncio
import os
import secrets

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

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
from app.maia_service import MaiaService
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
maia = MaiaService(settings.maia_runtime, list(settings.maia_command))
codex = CodexCliService(
    settings.codex_executable,
    settings.codex_model,
    settings.codex_timeout_seconds,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await asyncio.gather(stockfish.close(), maia.close())


app = FastAPI(
    title="Yomi Sensei",
    description="Scacchiera locale con Maia-3, analisi Stockfish e coach Codex CLI.",
    version="0.5.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def desktop_access(request: Request, call_next):
    token = os.environ.get("YOMI_DESKTOP_TOKEN")
    if token and not secrets.compare_digest(request.headers.get("x-yomi-token", ""), token):
        return JSONResponse(status_code=403, content={"detail": "Accesso riservato al desktop Yomi."})
    return await call_next(request)


@app.get("/api/health")
async def health() -> dict[str, object]:
    codex_status = await codex.status()
    return {
        "status": "ok",
        "stockfish": stockfish.available,
        "maia": maia.available,
        "maia_models": ["5m", "79m"] if maia.available else [],
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
            request.initial_fen,
            request.moves_uci,
        )
    except ChessRuleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/game/computer-move", response_model=PositionState)
async def game_computer_move(request: ComputerMoveRequest) -> PositionState:
    try:
        board = parse_board(request.fen, request.initial_fen, request.moves_uci)
        if request.engine == "maia":
            return await maia.play(board, request)
        return await stockfish.computer_move(
            request.fen, request.difficulty, request.initial_fen, request.moves_uci,
        )
    except ChessRuleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/classify-move", response_model=MoveClassificationResponse)
async def classify_move(request: MoveClassificationRequest) -> MoveClassificationResponse:
    try:
        return await stockfish.classify_move(
            request.fen, request.move_uci, request.depth, request.initial_fen, request.moves_uci,
        )
    except ChessRuleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/position", response_model=PositionState)
async def validate_position(request: AnalyzeRequest) -> PositionState:
    try:
        return position_state(parse_board(request.fen, request.initial_fen, request.moves_uci))
    except ChessRuleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    try:
        board = parse_board(request.fen, request.initial_fen, request.moves_uci)
    except ChessRuleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    jobs = [stockfish.analyze(
        request.fen, request.depth, request.include_replies, request.initial_fen, request.moves_uci,
    )]
    if request.include_human and not board.is_game_over(claim_draw=True):
        jobs.append(maia.analyze(board, request, request.include_replies))
    results = await asyncio.gather(*jobs, return_exceptions=True)
    result = results[0]
    if isinstance(result, BaseException):
        result = AnalyzeResponse(
            fen=board.fen(), side_to_move="white" if board.turn else "black",
            depth=request.depth or settings.stockfish_depth, candidates=[], stockfish_error=str(result),
        )
    if len(results) > 1:
        human = results[1]
        if isinstance(human, BaseException):
            result.human_error = str(human)
        else:
            result.human = human
            evaluations = {candidate.uci: candidate for candidate in result.candidates}
            missing = [candidate.uci for candidate in human.candidates if candidate.uci not in evaluations]
            if missing and not result.stockfish_error:
                try:
                    evaluations.update(await stockfish.evaluate_moves(board, missing, request.depth))
                except RuntimeError as exc:
                    result.stockfish_error = str(exc)
            for candidate in human.candidates:
                candidate.stockfish = evaluations.get(candidate.uci)
    return result


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    try:
        parse_board(request.fen, request.initial_fen, request.moves_uci)
        if request.human_analysis is not None and request.human_analysis.fen != request.fen:
            raise ChessRuleError("L'analisi Maia non corrisponde alla posizione della chat.")
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


@app.get("/", include_in_schema=False)
async def index() -> dict[str, str]:
    return {"app": "Yomi Sensei", "interface": "desktop", "version": "0.5.0"}
