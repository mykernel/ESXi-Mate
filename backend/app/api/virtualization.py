from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import os

from app.db import get_db, SessionLocal
from app.models.virtualization import EsxiHost, VirtualMachine, Datastore
from app.models.credential import Credential
from app.schemas.virtualization import (
    EsxiHostCreate,
    EsxiHostResponse,
    HostReorderRequest,
    SuccessResponse,
    VirtualMachineListResponse,
    VirtualMachineInfo,
    PowerActionRequest,
    VMUpdateRequest,
    AsyncTaskResponse,
    VMCloneRequest,
    VMCloneResponse,
    VMInstallToolsRequest,
    DatastoreStatsResponse,
)
from app.services.task_service import task_service
from app.services.virtualization_service import virtualization_service

router = APIRouter(prefix="/virtualization", tags=["virtualization"])


@router.post("/hosts", response_model=EsxiHostResponse, status_code=status.HTTP_201_CREATED)
def add_host(data: EsxiHostCreate, db: Session = Depends(get_db)):
    """添加或测试 ESXi 主机；probe_only=true 时仅探测不落库"""
    pwd = data.password or os.getenv("ESXI_PASSWORD")
    if not pwd:
        raise HTTPException(status_code=400, detail="缺少 ESXi 密码")

    probe_result = virtualization_service.probe_host(data.ip, data.username, pwd, data.port)
    if not probe_result.get("success"):
        raise HTTPException(status_code=502, detail=f"Connection failed: {probe_result.get('message')}")

    if data.probe_only:
        return EsxiHostResponse(
            id=0,
            ip=data.ip,
            port=data.port,
            username=data.username,
            description=data.description,
            status="online",
            hostname=probe_result.get("info", {}).get("hostname"),
            version=probe_result.get("info", {}).get("version"),
        )

    host = db.query(EsxiHost).filter(EsxiHost.ip == data.ip).first()
    if host:
        host.username = data.username
        host.port = data.port
        host.password = pwd
        if data.description is not None:
            host.description = data.description
        host.version = probe_result.get("info", {}).get("version")
        host.hostname = probe_result.get("info", {}).get("hostname")
        host.status = "online"
    else:
        max_sort_order = db.query(func.max(EsxiHost.sort_order)).scalar()
        next_sort_order = (max_sort_order + 1) if max_sort_order is not None else 0
        host = EsxiHost(
            ip=data.ip,
            port=data.port,
            username=data.username,
            password=pwd,
            description=data.description,
            sort_order=next_sort_order,
            version=probe_result.get("info", {}).get("version"),
            hostname=probe_result.get("info", {}).get("hostname"),
            status="online",
        )
        db.add(host)
    db.commit()
    db.refresh(host)
    try:
        virtualization_service.sync_host_vms(db, host, user_override=data.username, pwd_override=pwd)
    except Exception:
        pass
    return host


@router.get("/hosts", response_model=List[EsxiHostResponse])
def get_hosts(db: Session = Depends(get_db)):
    hosts = db.query(EsxiHost).order_by(EsxiHost.sort_order.asc(), EsxiHost.id.asc()).all()
    
    # 获取 VM 统计
    vm_stats = {}
    vms = db.query(VirtualMachine.host_ip, VirtualMachine.status).all()
    for row in vms:
        host_ip = row.host_ip
        status = row.status
        if host_ip not in vm_stats:
            vm_stats[host_ip] = {"total": 0, "running": 0}
        
        vm_stats[host_ip]["total"] += 1
        if status == "poweredOn":
            vm_stats[host_ip]["running"] += 1

    for h in hosts:
        stats = vm_stats.get(h.ip, {"total": 0, "running": 0})
        h.vm_count = stats["total"]
        h.vms_running = stats["running"]
        
    return hosts


@router.post("/hosts/reorder", response_model=SuccessResponse)
def reorder_hosts(body: HostReorderRequest, db: Session = Depends(get_db)):
    """批量更新主机排序；数组顺序即最终显示顺序。"""
    host_ids = body.host_ids or []
    if not host_ids:
        raise HTTPException(status_code=400, detail="host_ids 不能为空")
    if len(host_ids) != len(set(host_ids)):
        raise HTTPException(status_code=400, detail="host_ids 存在重复项")

    existing_ids = [
        row[0]
        for row in db.query(EsxiHost.id)
        .order_by(EsxiHost.sort_order.asc(), EsxiHost.id.asc())
        .all()
    ]
    existing_id_set = set(existing_ids)
    missing = [hid for hid in host_ids if hid not in existing_id_set]
    if missing:
        raise HTTPException(status_code=404, detail=f"Host not found: {missing}")

    # 若请求未包含所有主机，则将未包含的主机保持原相对顺序并追加到末尾
    pinned_id_set = set(host_ids)
    final_order = host_ids + [hid for hid in existing_ids if hid not in pinned_id_set]

    hosts = db.query(EsxiHost).filter(EsxiHost.id.in_(final_order)).all()
    host_map = {h.id: h for h in hosts}
    for idx, hid in enumerate(final_order):
        host_map[hid].sort_order = idx

    db.commit()
    return SuccessResponse(success=True)


@router.put("/hosts/{host_id}", response_model=EsxiHostResponse)
def update_host(host_id: int, data: EsxiHostCreate, db: Session = Depends(get_db)):
    host = db.query(EsxiHost).filter(EsxiHost.id == host_id).first()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")
    if data.ip:
        host.ip = data.ip
    host.port = data.port or host.port
    host.username = data.username or host.username
    if data.password:
        host.password = data.password
    if data.description is not None:
        host.description = data.description
    db.commit()
    db.refresh(host)
    return host


@router.delete("/hosts/{host_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_host(host_id: int, db: Session = Depends(get_db)):
    host = db.query(EsxiHost).filter(EsxiHost.id == host_id).first()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")
    db.query(VirtualMachine).filter(VirtualMachine.host_ip == host.ip).delete()
    db.delete(host)
    db.commit()
    return None


@router.get("/vms", response_model=VirtualMachineListResponse)
def get_vms(
    host_id: Optional[int] = None,
    keyword: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    page: int = 1,
    page_size: int = 20,
    refresh: bool = False,
    db: Session = Depends(get_db),
):
    """获取虚拟机列表；refresh=true 且 host_id 指定时会强制同步"""
    if refresh and host_id:
        host = db.query(EsxiHost).filter(EsxiHost.id == host_id).first()
        if host:
            virtualization_service.sync_host_vms(db, host)

    query = db.query(VirtualMachine)
    host_ip = None
    if host_id:
        host = db.query(EsxiHost).filter(EsxiHost.id == host_id).first()
        if host:
            host_ip = host.ip
            query = query.filter(VirtualMachine.host_ip == host.ip)

    if keyword:
        query = query.filter(
            (VirtualMachine.name.contains(keyword)) | (VirtualMachine.ip_address.contains(keyword))
        )
    if status_filter:
        query = query.filter(VirtualMachine.status == status_filter)

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    host_map = {h.ip: h.id for h in db.query(EsxiHost).all()}

    res_items = []
    for vm in items:
        res_items.append(
            VirtualMachineInfo(
                id=str(vm.id),
                name=vm.name,
                power_state=vm.status or "unknown",
                guest_os=vm.os_name,
                ip_address=vm.ip_address,
                description=vm.description,
                instance_uuid=vm.uuid,
                host_ip=vm.host_ip,
                host_id=host_map.get(vm.host_ip),
                cpu_count=vm.cpu_count,
                memory_mb=vm.memory_mb,
                cpu_usage_mhz=vm.cpu_usage_mhz,
                memory_usage_mb=vm.memory_usage_mb,
                uptime_seconds=vm.uptime_seconds,
                disk_used_gb=vm.disk_used_gb,
                disk_provisioned_gb=vm.disk_provisioned_gb,
                tools_status=vm.tools_status,
            )
        )

    return {"total": total, "items": res_items}


@router.patch("/vms/{vm_id}", response_model=VirtualMachineInfo)
def update_vm(vm_id: str, body: VMUpdateRequest, db: Session = Depends(get_db)):
    vm = db.query(VirtualMachine).filter(VirtualMachine.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")

    host = db.query(EsxiHost).filter(EsxiHost.ip == vm.host_ip).first()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    payload = body.model_dump(exclude_unset=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        updated_vm = virtualization_service.update_vm_basic_info(
            db,
            host,
            vm,
            new_name=payload.get("name"),
            new_description=payload.get("description"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    host_map = {h.ip: h.id for h in db.query(EsxiHost).all()}
    return VirtualMachineInfo(
        id=str(updated_vm.id),
        name=updated_vm.name,
        power_state=updated_vm.status or "unknown",
        guest_os=updated_vm.os_name,
        ip_address=updated_vm.ip_address,
        description=updated_vm.description,
        instance_uuid=updated_vm.uuid,
        host_ip=updated_vm.host_ip,
        host_id=host_map.get(updated_vm.host_ip),
        cpu_count=updated_vm.cpu_count,
        memory_mb=updated_vm.memory_mb,
        cpu_usage_mhz=updated_vm.cpu_usage_mhz,
        memory_usage_mb=updated_vm.memory_usage_mb,
        uptime_seconds=updated_vm.uptime_seconds,
        disk_used_gb=updated_vm.disk_used_gb,
        disk_provisioned_gb=updated_vm.disk_provisioned_gb,
        tools_status=updated_vm.tools_status,
    )


@router.post("/vms/{vm_id}/power", response_model=AsyncTaskResponse)
def power_action(vm_id: str, body: PowerActionRequest, db: Session = Depends(get_db)):
    vm = db.query(VirtualMachine).filter(VirtualMachine.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    host = db.query(EsxiHost).filter(EsxiHost.ip == vm.host_ip).first()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")
    try:
        return virtualization_service.power_vm(db, host, vm, body.action)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


def bg_clone_task(
    task_id: str,
    host_id: int,
    vm_id: str,
    new_name: str,
    target_datastore: Optional[str],
    power_on: bool,
    source_ip: Optional[str],
    auto_config_ip: bool,
    guest_username: Optional[str],
    guest_password: Optional[str],
    new_ip: Optional[str],
    netmask: Optional[str],
    gateway: Optional[str],
    dns: Optional[List[str]],
    nic_name: Optional[str],
    disconnect_nic_first: bool,
):
    print(f"[BG Task] ========== 后台克隆任务启动 ==========")
    print(f"[BG Task] task_id: {task_id}")
    print(f"[BG Task] new_name: {new_name}")
    print(f"[BG Task] auto_config_ip: {auto_config_ip}")
    if auto_config_ip:
        print(f"[BG Task] IP配置参数: nic={nic_name}, ip={new_ip}, netmask={netmask}, gw={gateway}, dns={dns}")
    db = SessionLocal()
    try:
        host = db.query(EsxiHost).filter(EsxiHost.id == host_id).first()
        vm = db.query(VirtualMachine).filter(VirtualMachine.id == vm_id).first()
        
        start_msg = "准备克隆"
        metadata = {}
        if vm:
            start_msg = f"正在克隆: {vm.name} -> {new_name}"
            metadata = {"source": vm.name, "target": new_name}
            
        task_service.update_task(db, task_id, status="running", progress=5, message=start_msg, result=metadata)
        
        if host and vm:
            print(f"[BG Task] Starting clone for {vm.name} -> {new_name}")
            res = virtualization_service.clone_vm(
                db=db,
                host=host,
                vm=vm,
                new_name=new_name,
                target_datastore=target_datastore,
                power_on=power_on,
                source_ip=source_ip,
                auto_config_ip=auto_config_ip,
                guest_username=guest_username,
                guest_password=guest_password,
                new_ip=new_ip,
                netmask=netmask,
                gateway=gateway,
                dns=dns,
                nic_name=nic_name,
                disconnect_nic_first=disconnect_nic_first,
                task_id=task_id,
                task_service=task_service,
            )
            ip_msg = res.get("ip_message")
            final_msg = res.get("message")
            ip_configured = res.get("ip_configured")

            print(f"[BG Task] ========== 克隆结果 ==========")
            print(f"[BG Task] success: {res.get('success')}")
            print(f"[BG Task] new_vm_moref: {res.get('new_vm_moref')}")
            print(f"[BG Task] ip_configured: {ip_configured}")
            print(f"[BG Task] ip_message: {ip_msg}")

            if ip_msg and not ip_configured:
                final_msg += f" [IP配置失败: {ip_msg}]"
                print(f"[BG Task] ⚠️ IP 配置失败，但克隆任务标记为成功")

            task_service.update_task(
                db,
                task_id,
                status="success",
                progress=100,
                message=final_msg,
                result={
                    "source": vm.name,
                    "target": new_name,
                    "new_vm_moref": res.get("new_vm_moref"),
                    "new_vmx_path": res.get("new_vmx_path"),
                    "ip_configured": ip_configured,
                    "ip_message": ip_msg,
                },
            )
            print(f"[BG Task] ✅ 克隆任务完成: {new_name}")
        else:
            print(f"[BG Task] ❌ 未找到 Host 或 VM: host_id={host_id}, vm_id={vm_id}")
            task_service.update_task(db, task_id, status="failed", message="未找到 Host 或 VM")
    except Exception as e:
        print(f"[BG Task] ❌ 克隆失败: {e}")
        import traceback
        print(f"[BG Task] 异常堆栈: {traceback.format_exc()}")
        task_service.update_task(db, task_id, status="failed", message=str(e), progress=100)
    finally:
        db.close()

@router.post("/vms/{vm_id}/clone", response_model=AsyncTaskResponse)
def clone_vm(vm_id: str, body: VMCloneRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    print(f"[API] ========== 收到克隆请求 ==========")
    print(f"[API] vm_id: {vm_id}")
    print(f"[API] 请求参数:")
    print(f"[API]   new_name: {body.new_name}")
    print(f"[API]   target_datastore: {body.target_datastore}")
    print(f"[API]   power_on: {body.power_on}")
    print(f"[API]   source_ip: {body.source_ip}")
    print(f"[API]   auto_config_ip: {body.auto_config_ip}")
    print(f"[API]   guest_username: {body.guest_username}")
    print(f"[API]   guest_password: {'*' * len(body.guest_password) if body.guest_password else '(空)'}")
    print(f"[API]   new_ip: {body.new_ip}")
    print(f"[API]   netmask: {body.netmask}")
    print(f"[API]   gateway: {body.gateway}")
    print(f"[API]   dns: {body.dns}")
    print(f"[API]   nic_name: {body.nic_name}")
    print(f"[API]   disconnect_nic_first: {body.disconnect_nic_first}")

    vm = db.query(VirtualMachine).filter(VirtualMachine.id == vm_id).first()
    if not vm:
        print(f"[API] ❌ VM not found: {vm_id}")
        raise HTTPException(status_code=404, detail="VM not found")
    print(f"[API] 源 VM: {vm.name} (uuid={vm.uuid}, ip={vm.ip_address})")

    host = db.query(EsxiHost).filter(EsxiHost.ip == vm.host_ip).first()
    if not host:
        print(f"[API] ❌ Host not found: {vm.host_ip}")
        raise HTTPException(status_code=404, detail="Host not found")
    print(f"[API] 宿主机: {host.ip} ({host.hostname})")

    # 创建任务记录
    task = task_service.create_task(db, type="clone_vm", target_id=vm.id, message="等待开始")
    print(f"[API] ✅ 创建任务: task_id={task.id}")

    # 立即返回，后台执行
    background_tasks.add_task(
        bg_clone_task, 
        task.id,
        host.id, 
        vm.id, 
        body.new_name, 
        body.target_datastore, 
        body.power_on,
        body.source_ip,
        body.auto_config_ip,
        body.guest_username,
        body.guest_password,
        body.new_ip,
        body.netmask,
        body.gateway,
        body.dns,
        body.nic_name,
        body.disconnect_nic_first,
    )
    
    return AsyncTaskResponse(task_id=task.id, status=task.status, message="克隆任务已提交后台运行")


@router.get("/vms/{vm_id}/console")
def get_console(vm_id: str):
    return {
        "type": "webmks",
        "url": "wss://mock-proxy/ticket/123",
        "ticket": "mock-ticket",
    }


@router.post("/sync")
def sync_hosts(body: dict = None, db: Session = Depends(get_db)):
    host_id = (body or {}).get("host_id")
    if host_id:
        host = db.query(EsxiHost).filter(EsxiHost.id == host_id).first()
        if not host:
            raise HTTPException(status_code=404, detail="Host not found")
        virtualization_service.sync_host_vms(db, host)
        return {"success": True, "message": f"Sync started for {host.ip}"}
    virtualization_service.sync_all_hosts(db)
    return {"success": True, "message": "Sync started for all hosts"}


@router.post("/vms/{vm_id}/install-tools", response_model=AsyncTaskResponse)
def install_tools(vm_id: str, body: VMInstallToolsRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    vm = db.query(VirtualMachine).filter(VirtualMachine.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
        
    username = body.username
    password = body.password
    
    if body.credential_id:
        cred = db.query(Credential).filter(Credential.id == body.credential_id).first()
        if not cred:
            raise HTTPException(status_code=400, detail="Credential not found")
        username = cred.username
        password = cred.password
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required (directly or via credential_id)")

    task = task_service.create_task(db, type="install_tools", target_id=vm.id, message="准备安装 Tools")
    
    def bg_install(task_id, ip, user, pwd):
        db_inner = SessionLocal()
        try:
            task_service.update_task(db_inner, task_id, status="running", progress=10, message=f"正在连接 SSH: {ip}")
            virtualization_service.install_tools_ssh(ip, user, pwd)
            task_service.update_task(db_inner, task_id, status="success", progress=100, message="Tools 安装命令执行成功，请稍候同步")
        except Exception as e:
            task_service.update_task(db_inner, task_id, status="failed", progress=100, message=str(e))
        finally:
            db_inner.close()

    background_tasks.add_task(bg_install, task.id, body.ip, username, password)
    
    return AsyncTaskResponse(task_id=task.id, status=task.status, message="后台安装任务已启动")


@router.get("/datastores/stats", response_model=DatastoreStatsResponse)
def get_datastore_stats(db: Session = Depends(get_db)):
    count = db.query(Datastore).count()
    # Calculate sum of capacity and free
    stats = db.query(
        func.sum(Datastore.capacity_gb).label("total_capacity"),
        func.sum(Datastore.free_gb).label("total_free")
    ).first()
    
    return DatastoreStatsResponse(
        total_count=count,
        total_capacity_gb=stats.total_capacity or 0.0,
        total_free_gb=stats.total_free or 0.0
    )
