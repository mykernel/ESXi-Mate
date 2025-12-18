"""
架构拓扑 API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.flow_topology import (
    FlowNodeCapacityResponse,
    FlowNodeCapacityUpdateRequest,
    FlowTopologyOverviewResponse,
    FlowTopologyLayoutRequest,
    DomainCheckResponse,
)
from app.services.flow_topology import (
    build_flow_topology_overview,
    get_flow_node_capacity,
    upsert_flow_node_capacity,
    save_topology_layout,
    get_topology_layout,
    check_domain_status,
)

router = APIRouter(prefix="/flow-topology", tags=["flow-topology"])


@router.get("/overview", response_model=FlowTopologyOverviewResponse)
def get_flow_topology(db: Session = Depends(get_db)):
    """
    聚合 nginx 配置 + 服务全景，生成拓扑结构
    """
    return build_flow_topology_overview(db)


@router.get("/layout", response_model=dict[str, list[str]] | None)
def get_layout(db: Session = Depends(get_db)):
    """
    获取用户保存的自定义布局
    """
    return get_topology_layout(db)


@router.put("/layout")
def save_layout(payload: FlowTopologyLayoutRequest, db: Session = Depends(get_db)):
    """
    保存用户自定义布局
    """
    return save_topology_layout(db, payload.layout)


@router.get("/domain-check", response_model=DomainCheckResponse)
def domain_check(url: str):
    """
    检测域名可访问性 & 证书到期
    """
    if not url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="url 不能为空")
    return check_domain_status(url)


@router.get("/capacity/{entity_key}", response_model=FlowNodeCapacityResponse)
def get_capacity(entity_key: str, db: Session = Depends(get_db)):
    """
    获取单个节点的容量配置
    """
    record = get_flow_node_capacity(db, entity_key)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未配置容量")
    return record


@router.put("/capacity/{entity_key}", response_model=FlowNodeCapacityResponse)
def update_capacity(
    entity_key: str,
    payload: FlowNodeCapacityUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    新增或更新节点容量
    """
    if not entity_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="entity_key 不能为空")
    return upsert_flow_node_capacity(db, entity_key, payload)
