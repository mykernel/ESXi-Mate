from typing import Optional, Any, List
from datetime import datetime
from pydantic import BaseModel


class TaskBase(BaseModel):
    id: str
    type: str
    target_id: Optional[str] = None
    status: str
    progress: int = 0
    message: Optional[str] = None
    result: Optional[Any] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    total: int
    items: List[TaskBase]
