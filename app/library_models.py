from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models import MaiaProfile, MoveClassificationResponse, UciMove


GameId = str


class BoardMark(BaseModel):
    from_square: str = Field(alias="from", pattern=r"^[a-h][1-8]$")
    to: str = Field(pattern=r"^[a-h][1-8]$")


class ClockState(BaseModel):
    base_ms: int = Field(ge=0, le=10800000)
    increment_ms: int = Field(default=0, ge=0, le=60000)
    white_ms: int = Field(ge=0, le=86400000)
    black_ms: int = Field(ge=0, le=86400000)
    paused: bool = True


class GameOptions(BaseModel):
    mode: Literal["free", "computer"] = "free"
    engine: Literal["maia", "stockfish"] = "maia"
    difficulty: Literal["easy", "medium", "hard", "expert"] = "medium"
    player_color: Literal["white", "black"] = "white"
    profile: MaiaProfile = Field(default_factory=MaiaProfile)
    training: bool = False
    clock: ClockState | None = None


class SavedMove(BaseModel):
    uci: UciMove
    computer: bool = False
    engine: Literal["maia", "stockfish"] | None = None
    classification: MoveClassificationResponse | None = None


class SavedMessage(BaseModel):
    id: int
    role: Literal["user", "assistant"]
    content: str = Field(max_length=12000)
    fen: str = Field(max_length=120)
    error: bool = False


class Variation(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9-]{1,80}$")
    title: str = Field(default="Variante", max_length=80)
    root_ply: int = Field(ge=0, le=2000)
    moves_uci: list[UciMove] = Field(default_factory=list, max_length=200)


class GameSnapshot(BaseModel):
    title: str = Field(default="", max_length=100)
    initial_fen: str = Field(max_length=120)
    moves: list[SavedMove] = Field(default_factory=list, max_length=2000)
    options: GameOptions = Field(default_factory=GameOptions)
    chat: list[SavedMessage] = Field(default_factory=list, max_length=100)
    comments: dict[str, str] = Field(default_factory=dict, max_length=2200)
    marks: dict[str, list[BoardMark]] = Field(default_factory=dict, max_length=2200)
    variations: list[Variation] = Field(default_factory=list, max_length=100)
    tags: dict[str, str] = Field(default_factory=dict, max_length=30)

    @field_validator("comments", "tags")
    @classmethod
    def bounded_text(cls, value: dict[str, str]) -> dict[str, str]:
        if any(len(key) > 100 or len(text) > 4000 for key, text in value.items()):
            raise ValueError("Commento o etichetta troppo lungo.")
        return value

    @field_validator("marks")
    @classmethod
    def bounded_marks(cls, value: dict[str, list[BoardMark]]) -> dict[str, list[BoardMark]]:
        if any(len(key) > 100 or len(marks) > 64 for key, marks in value.items()):
            raise ValueError("Troppe annotazioni per posizione.")
        return value


class SaveGameRequest(BaseModel):
    game_id: str | None = Field(default=None, pattern=r"^[a-f0-9-]{36}$")
    revision: int = Field(ge=1, le=2147483647)
    snapshot: GameSnapshot


class GameRequest(BaseModel):
    game_id: str = Field(pattern=r"^[a-f0-9-]{36}$")


class FinishGameRequest(GameRequest):
    reason: Literal["resignation", "draw", "timeout"]
    color: Literal["white", "black"]


class ImportGamesRequest(BaseModel):
    pgn: str = Field(default="", max_length=250000)
    fen: str | None = Field(default=None, max_length=120)


class ReviewRequest(GameRequest):
    run_agent: bool = False


class ExerciseAttempt(BaseModel):
    exercise_id: str = Field(pattern=r"^[a-f0-9-]{36}:\d{1,4}$")
    move_uci: UciMove


class LibraryQuery(BaseModel):
    query: str = Field(default="", max_length=100)
