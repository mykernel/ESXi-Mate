from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db import get_db
from app.schemas import TaskBase, TaskListResponse
from app.services.task_service import task_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=TaskListResponse)
def list_tasks(
    status: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None),
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    data = task_service.list_tasks(db, status=status, type=type, page=page, page_size=page_size)
    return {"total": data["total"], "items": data["items"]}


@router.get("/{task_id}", response_model=TaskBase)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = task_service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
