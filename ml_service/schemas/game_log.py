from pydantic import BaseModel, Field, validator
from typing import List


class GameLog(BaseModel):
    """
    Schema for logging completed games into live_games.jsonl

    Attributes:
        moves: Sequence of moves represented as column indices (0-6) in play order.
        outcome: Game result: 1 for AI win, 0 for draw, -1 for AI loss.
        timestamp: Unix timestamp (seconds since epoch, with fractional part).
    """
    moves: List[int] = Field(..., description="List of column indices in play order")
    outcome: int = Field(..., description="1 for AI win, 0 for draw, -1 for AI loss")
    timestamp: float = Field(..., description="Unix timestamp in seconds, can be fractional")
    
    @validator('outcome')
    def validate_outcome(cls, v: int) -> int:
        if v not in (-1, 0, 1):
            raise ValueError('outcome must be one of -1 (AI loss), 0 (draw), or 1 (AI win)')
        return v
