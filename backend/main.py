"""
FastAPI 主应用入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# 提前加载 .env
load_dotenv()

from app.db import init_db
from app.api import virtualization_router, tasks_router, credentials_router

# 创建 FastAPI 应用
app = FastAPI(
    title="ESXi-Mate API",
    description="ESXi 主机与虚拟机管理 API（当前验证版本：VMware ESXi 7.0.0）",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS 配置
origins = os.getenv("CORS_ORIGINS", "http://localhost:9528,http://127.0.0.1:9528").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """
    应用启动事件
    """
    print("🚀 Starting ESXi-Mate API Server...")
    # 初始化数据库
    init_db()
    print("✅ Database initialized")


@app.on_event("shutdown")
async def shutdown_event():
    """
    应用关闭事件
    """
    print("👋 Shutting down OpsNav API Server...")


@app.get("/")
async def root():
    """
    健康检查接口
    """
    return {
        "message": "ESXi-Mate API is running",
        "version": "0.1.0",
        "status": "healthy"
    }


@app.get("/health")
async def health_check():
    """
    健康检查
    """
    return {
        "status": "healthy",
        "database": "connected"
    }


# 注册路由
app.include_router(virtualization_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(credentials_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("APP_HOST", "0.0.0.0")
    port = int(os.getenv("APP_PORT", "9601"))
    debug = os.getenv("DEBUG", "True") == "True"

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug
    )
