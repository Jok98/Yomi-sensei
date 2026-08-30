from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class LegalMove(BaseModel):
    uci: str
    from_square: str
    to_square: str
    promotion: str | None = None


class PositionState(BaseModel):
    fen: str
    legal_moves: list[LegalMove]
    turn: Literal["white", "black"]
    status: str
    is_game_over: bool
    last_move_san: str | None = None
    last_move_uci: str | None = None


class MoveRequest(BaseModel):
    fen: str
    from_square: str = Field(pattern=r"^[a-h][1-8]$")
    to_square: str = Field(pattern=r"^[a-h][1-8]$")
    promotion: Literal["q", "r", "b", "n"] | None = None


class AnalyzeRequest(BaseModel):
    fen: str
    depth: int | None = Field(default=None, ge=8, le=24)
    include_replies: bool = True


class ComputerMoveRequest(BaseModel):
    fen: str
    difficulty: Literal["easy", "medium", "hard", "expert"] = "medium"


class MoveClassificationRequest(BaseModel):
    fen: str
    move_uci: str = Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")
    depth: int | None = Field(default=None, ge=8, le=24)


class MoveClassificationResponse(BaseModel):
    code: Literal[
        "book",
        "best",
        "excellent",
        "good",
        "inaccuracy",
        "mistake",
        "blunder",
    ]
    label: str
    marker: str
    expected_points_loss: float
    best_move_san: str | None = None
    played_move_san: str


class CandidateMove(BaseModel):
    rank: int
    uci: str
    san: str
    evaluation: str
    expected_score_percent: float
    win_percent: float
    draw_percent: float
    loss_percent: float
    principal_variation: list[str]


class ReplyAnalysis(BaseModel):
    after_uci: str
    after_san: str
    side_to_move: Literal["white", "black"]
    candidates: list[CandidateMove]


class AnalyzeResponse(BaseModel):
    fen: str
    side_to_move: Literal["white", "black"]
    depth: int
    candidates: list[CandidateMove]
    replies: list[ReplyAnalysis] = Field(default_factory=list)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    fen: str
    pgn: str = Field(default="", max_length=20000)
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)
    candidates: list[CandidateMove] = Field(default_factory=list, max_length=3)
    opponent_candidates: list[CandidateMove] = Field(default_factory=list, max_length=3)
    opponent_after_san: str | None = Field(default=None, max_length=32)
    model: str | None = Field(default=None, max_length=100)
    reasoning_effort: str | None = Field(default=None, max_length=20)

    @field_validator("history")
    @classmethod
    def keep_recent_history(cls, value: list[ChatMessage]) -> list[ChatMessage]:
        return value[-12:]


class ChatResponse(BaseModel):
    answer: str
    model: str
