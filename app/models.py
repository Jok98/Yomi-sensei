from __future__ import annotations

from typing import Annotated, Literal

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
    result: Literal["1-0", "0-1", "1/2-1/2"] | None = None
    last_move_san: str | None = None
    last_move_uci: str | None = None


UciMove = Annotated[str, Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")]


class GameContext(BaseModel):
    fen: str = Field(max_length=120)
    initial_fen: str | None = Field(default=None, max_length=120)
    moves_uci: list[UciMove] = Field(default_factory=list, max_length=2000)


class MaiaProfile(BaseModel):
    maia_model: Literal["5m", "79m"] = "79m"
    white_elo: int = Field(default=1500, ge=600, le=2900)
    black_elo: int = Field(default=1500, ge=600, le=2900)


class MoveRequest(GameContext):
    from_square: str = Field(pattern=r"^[a-h][1-8]$")
    to_square: str = Field(pattern=r"^[a-h][1-8]$")
    promotion: Literal["q", "r", "b", "n"] | None = None


class AnalyzeRequest(GameContext, MaiaProfile):
    depth: int | None = Field(default=None, ge=8, le=24)
    include_replies: bool = True
    include_human: bool = True


class ComputerMoveRequest(GameContext, MaiaProfile):
    engine: Literal["maia", "stockfish"] = "maia"
    difficulty: Literal["easy", "medium", "hard", "expert"] = "medium"


class MoveClassificationRequest(GameContext):
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


class HumanCandidate(BaseModel):
    rank: int
    uci: str
    san: str
    move_probability_percent: float = Field(ge=0, le=100)
    win_percent: float = Field(ge=0, le=100)
    draw_percent: float = Field(ge=0, le=100)
    loss_percent: float = Field(ge=0, le=100)
    stockfish: CandidateMove | None = None


class HumanReply(BaseModel):
    after_uci: str
    after_san: str
    side_to_move: Literal["white", "black"]
    candidates: list[HumanCandidate] = Field(max_length=3)


class HumanAnalysis(BaseModel):
    fen: str
    model: Literal["5m", "79m"]
    white_elo: int
    black_elo: int
    device: str
    candidates: list[HumanCandidate] = Field(max_length=3)
    replies: list[HumanReply] = Field(default_factory=list, max_length=3)


class AnalyzeResponse(BaseModel):
    fen: str
    side_to_move: Literal["white", "black"]
    depth: int
    candidates: list[CandidateMove]
    replies: list[ReplyAnalysis] = Field(default_factory=list)
    human: HumanAnalysis | None = None
    human_error: str | None = None
    stockfish_error: str | None = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(GameContext):
    pgn: str = Field(default="", max_length=20000)
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)
    candidates: list[CandidateMove] = Field(default_factory=list, max_length=3)
    opponent_candidates: list[CandidateMove] = Field(default_factory=list, max_length=3)
    opponent_after_san: str | None = Field(default=None, max_length=32)
    human_analysis: HumanAnalysis | None = None
    selected_move_uci: str | None = Field(default=None, max_length=5)
    model: str | None = Field(default=None, max_length=100)
    reasoning_effort: str | None = Field(default=None, max_length=20)

    @field_validator("history")
    @classmethod
    def keep_recent_history(cls, value: list[ChatMessage]) -> list[ChatMessage]:
        return value[-12:]


class ChatResponse(BaseModel):
    answer: str
    model: str
