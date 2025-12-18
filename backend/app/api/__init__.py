from .virtualization import router as virtualization_router
from .tasks import router as tasks_router
from .credentials import router as credentials_router

__all__ = [
    "virtualization_router",
    "tasks_router",
    "credentials_router",
]
