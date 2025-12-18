import uuid
from sqlalchemy import Column, String, Integer, Text, DateTime, JSON
from sqlalchemy.sql import func
from app.db import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    type = Column(String(50), nullable=False, comment="任务类型：clone_vm/power_ops/sync_host")
    target_id = Column(String(100), nullable=True, comment="目标 ID（VM 或 Host）")
    status = Column(String(20), default="pending", comment="pending/running/success/failed")
    progress = Column(Integer, default=0)
    message = Column(Text, nullable=True)
    result = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
