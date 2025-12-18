import uuid
from typing import Optional, Any, List, Dict
from sqlalchemy.orm import Session
from app.models.task import Task


class AsyncTaskService:
    def create_task(self, db: Session, type: str, target_id: Optional[str] = None, message: str = "") -> Task:
        task = Task(
            id=str(uuid.uuid4()),
            type=type,
            target_id=target_id,
            status="pending",
            progress=0,
            message=message,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    def update_task(
        self,
        db: Session,
        task_id: str,
        status: Optional[str] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        result: Optional[Any] = None,
    ) -> Optional[Task]:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None
        if status:
            task.status = status
        if progress is not None:
            task.progress = progress
        if message is not None:
            task.message = message
        if result is not None:
            task.result = result
        db.commit()
        db.refresh(task)
        return task

    def get_task(self, db: Session, task_id: str) -> Optional[Task]:
        return db.query(Task).filter(Task.id == task_id).first()

    def list_tasks(
        self,
        db: Session,
        status: Optional[str] = None,
        type: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        query = db.query(Task)
        if status:
            query = query.filter(Task.status == status)
        if type:
            query = query.filter(Task.type == type)
        total = query.count()
        items = query.order_by(Task.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return {"total": total, "items": items}


task_service = AsyncTaskService()
