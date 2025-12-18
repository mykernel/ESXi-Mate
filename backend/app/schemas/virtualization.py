"""虚拟化相关 Schema。"""
from __future__ import annotations

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class EsxiHostBase(BaseModel):
    ip: str
    port: int = 443
    username: str = "root"
    password: Optional[str] = Field(
        default=None, description="可选；为空时回退到环境变量 ESXI_PASSWORD"
    )
    description: Optional[str] = None


class EsxiHostCreate(EsxiHostBase):
    probe_only: bool = False


class EsxiHostResponse(EsxiHostBase):
    id: int
    hostname: Optional[str] = None
    status: Optional[str] = None
    version: Optional[str] = None
    model: Optional[str] = None
    sort_order: Optional[int] = None
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    cpu_cores: Optional[int] = None
    memory_total_gb: Optional[float] = None
    storage_total_gb: Optional[float] = None
    storage_free_gb: Optional[float] = None
    vm_count: Optional[int] = None
    vms_running: Optional[int] = None
    last_sync_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VirtualMachineInfo(BaseModel):
    id: Optional[str] = None
    name: str
    power_state: str = Field(description="poweredOn/poweredOff/suspended 等")
    guest_os: Optional[str] = None
    ip_address: Optional[str] = None
    description: Optional[str] = None
    instance_uuid: Optional[str] = None
    moref: Optional[str] = Field(default=None, description="Managed Object Reference (moId)")
    host_id: Optional[int] = None
    host_ip: Optional[str] = None
    cpu_count: Optional[int] = None
    memory_mb: Optional[int] = None
    cpu_usage_mhz: Optional[int] = None
    memory_usage_mb: Optional[int] = None
    uptime_seconds: Optional[int] = None
    disk_used_gb: Optional[float] = None
    disk_provisioned_gb: Optional[float] = None
    tools_status: Optional[str] = None


class VirtualMachineListResponse(BaseModel):
    total: int
    items: List[VirtualMachineInfo]


# 兼容旧设计的响应/请求，可继续复用
class VirtualMachineResponse(BaseModel):
    id: str
    uuid: str
    name: str
    host_ip: str
    status: str
    ip_address: Optional[str] = None
    os_name: Optional[str] = None
    description: Optional[str] = None
    cpu_count: int
    memory_mb: int
    tools_status: Optional[str] = None

    class Config:
        from_attributes = True


class VmListResponse(BaseModel):
    total: int
    items: List[VirtualMachineResponse]


class PowerActionRequest(BaseModel):
    action: str  # powerOn, reboot, etc.


class VMUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, description="新名称")
    description: Optional[str] = Field(default=None, description="备注/Annotation")


class AsyncTaskResponse(BaseModel):
    task_id: str
    status: str
    message: Optional[str] = None


class VMCloneRequest(BaseModel):
    new_name: str
    target_datastore: Optional[str] = None
    power_on: bool = False
    source_ip: Optional[str] = Field(default=None, description="源虚机当前 IP，仅用于记录/日志")
    auto_config_ip: bool = Field(default=False, description="克隆后自动修改 IP（需要 Guest 凭据与 VMware Tools）")
    guest_username: Optional[str] = Field(default="root", description="Guest OS 登录账号")
    guest_password: Optional[str] = Field(default=None, description="Guest OS 登录密码")
    new_ip: Optional[str] = None
    netmask: Optional[str] = None
    gateway: Optional[str] = None
    dns: Optional[List[str]] = None
    nic_name: Optional[str] = Field(default="eth0", description="在 Guest 内的网卡名，默认 eth0；若不同需显式指定")
    disconnect_nic_first: bool = Field(default=True, description="克隆后开机前先断开网卡，避免 IP 冲突")


class VMCloneResponse(BaseModel):
    success: bool
    message: str
    new_vm_moref: Optional[str] = None
    new_vmx_path: Optional[str] = None
    ip_configured: Optional[bool] = None
    ip_message: Optional[str] = None


class VMInstallToolsRequest(BaseModel):
    ip: str = Field(..., description="SSH IP Address")
    username: Optional[str] = Field(default="root")
    password: Optional[str] = None
    credential_id: Optional[int] = None


class DatastoreStatsResponse(BaseModel):
    total_count: int
    total_capacity_gb: float
    total_free_gb: float


class HostReorderRequest(BaseModel):
    host_ids: List[int] = Field(..., description="ESXi Host ID 列表（数组顺序即最终显示顺序）")


class SuccessResponse(BaseModel):
    success: bool = True
