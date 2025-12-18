from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, BigInteger
from sqlalchemy.sql import func
from app.db import Base

class EsxiHost(Base):
    __tablename__ = "esxi_hosts"

    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String(50), unique=True, nullable=False, comment="ESXi IP")
    port = Column(Integer, default=443)
    username = Column(String(50), nullable=False)
    # TODO: 生产环境应加密存储
    password = Column(String(200), nullable=False)
    
    hostname = Column(String(100), nullable=True, comment="ESXi Hostname")
    version = Column(String(100), nullable=True, comment="ESXi Version")
    model = Column(String(100), nullable=True, comment="Hardware Model")
    description = Column(String(255), nullable=True, comment="主机备注")
    sort_order = Column(Integer, default=0, index=True, comment="显示排序权重，值越小越靠前")
    cpu_usage = Column(Float, default=0.0, comment="CPU Usage %")
    memory_usage = Column(Float, default=0.0, comment="Memory Usage %")
    cpu_cores = Column(Integer, nullable=True, comment="Total CPU cores")
    memory_total_gb = Column(Float, nullable=True, comment="Total memory in GB")
    storage_total_gb = Column(Float, nullable=True, comment="Total storage in GB (sum of datastores)")
    storage_free_gb = Column(Float, nullable=True, comment="Free storage in GB (sum of datastores)")
    status = Column(String(20), default="offline", comment="online/offline/auth_error")
    last_sync_at = Column(DateTime(timezone=True), comment="Last sync time")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class VirtualMachine(Base):
    __tablename__ = "virtual_machines"

    id = Column(String(50), primary_key=True, comment="Local ID (e.g. host_ip-vm_uuid)")
    uuid = Column(String(100), index=True)
    name = Column(String(200), index=True)
    
    host_ip = Column(String(50), index=True, comment="Belongs to which host")
    
    status = Column(String(20), comment="poweredOn/poweredOff/suspended")
    ip_address = Column(String(50), comment="Primary IP")
    os_name = Column(String(100))
    description = Column(Text, nullable=True, comment="VM 备注/Annotation")
    
    cpu_count = Column(Integer, default=1)
    memory_mb = Column(BigInteger, default=1024)
    cpu_usage_mhz = Column(Integer, nullable=True, comment="当前 CPU 使用 (MHz)")
    memory_usage_mb = Column(Integer, nullable=True, comment="当前内存使用 (MB)")
    uptime_seconds = Column(BigInteger, nullable=True, comment="运行时长（秒）")
    disk_used_gb = Column(Float, nullable=True, comment="已占用磁盘 (GB)")
    disk_provisioned_gb = Column(Float, nullable=True, comment="已分配磁盘 (GB)")
    tools_status = Column(String(50), nullable=True, comment="VMware Tools 状态（toolsOk/toolsNotInstalled/toolsNotRunning/toolsOld 等）")
    
    datastore = Column(String(200))
    vmx_path = Column(String(500))
    
    last_sync = Column(DateTime(timezone=True))

class Datastore(Base):
    __tablename__ = "datastores"

    id = Column(String(200), primary_key=True, comment="UUID/URL")
    name = Column(String(100), index=True)
    type = Column(String(50))
    capacity_gb = Column(Float, default=0.0)
    free_gb = Column(Float, default=0.0)
    last_sync = Column(DateTime(timezone=True))
