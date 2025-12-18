"""
数据库连接和会话管理
"""
from sqlalchemy import inspect, text
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from typing import Generator
import os
from dotenv import load_dotenv

load_dotenv()

DEFAULT_SQLITE_URL = "sqlite:///./esxi_mate.db"

# 优先使用 DATABASE_URL（便于 Docker/MySQL 可选支持），否则默认 SQLite 零配置启动
DATABASE_URL = os.getenv("DATABASE_URL") or DEFAULT_SQLITE_URL

DEBUG_SQL = os.getenv("DEBUG", "False") == "True"

engine_kwargs = {"echo": DEBUG_SQL}
if DATABASE_URL.startswith("sqlite"):
    # SQLite 多线程（FastAPI）需要关闭同线程检查
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # 非 SQLite（例如 MySQL）启用连接池参数
    engine_kwargs.update(
        {
            "pool_pre_ping": True,
            "pool_recycle": 3600,
            "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
            "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "20")),
        }
    )

engine = create_engine(DATABASE_URL, **engine_kwargs)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 声明基类
Base = declarative_base()


def get_db() -> Generator:
    """
    获取数据库会话
    用于依赖注入
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    初始化数据库（创建所有表）
    """
    # 确保模型已注册到元数据
    try:
        import app.models.task  # noqa: F401
        import app.models.credential  # noqa: F401
        import app.models.virtualization  # noqa: F401
    except Exception as e:
        print(f"[init_db] import task model failed: {e}")
    Base.metadata.create_all(bind=engine)

    # 兼容旧表结构：如果新增列不存在则自动补齐
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        dialect = engine.dialect.name

        def _add_column_sql(table: str, ddl: str):
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))

        if "virtual_machines" in tables:
            columns = {col["name"] for col in inspector.get_columns("virtual_machines")}
            if "description" not in columns:
                if dialect == "mysql":
                    _add_column_sql("virtual_machines", "description TEXT NULL COMMENT 'VM 备注/Annotation'")
                else:
                    _add_column_sql("virtual_machines", "description TEXT")
                print("[init_db] added column virtual_machines.description")
        if "esxi_hosts" in tables:
            columns = {col["name"] for col in inspector.get_columns("esxi_hosts")}
            if "description" not in columns:
                if dialect == "mysql":
                    _add_column_sql("esxi_hosts", "description VARCHAR(255) NULL COMMENT '主机备注'")
                else:
                    _add_column_sql("esxi_hosts", "description VARCHAR(255)")
                print("[init_db] added column esxi_hosts.description")
            if "sort_order" not in columns:
                if dialect == "mysql":
                    _add_column_sql(
                        "esxi_hosts",
                        "sort_order INT NOT NULL DEFAULT 0 COMMENT '显示排序权重，值越小越靠前'",
                    )
                else:
                    _add_column_sql("esxi_hosts", "sort_order INTEGER NOT NULL DEFAULT 0")
                print("[init_db] added column esxi_hosts.sort_order")
            try:
                idx_names = {idx.get("name") for idx in inspector.get_indexes("esxi_hosts")}
                if "idx_esxi_hosts_sort_order" not in idx_names:
                    with engine.begin() as conn:
                        conn.execute(text("CREATE INDEX idx_esxi_hosts_sort_order ON esxi_hosts(sort_order)"))
                    print("[init_db] added index idx_esxi_hosts_sort_order")
            except Exception as e:
                print(f"[init_db] ensure index esxi_hosts.sort_order failed: {e}")
    except Exception as e:
        print(f"[init_db] ensure schema failed: {e}")
