import ssl
import atexit
import os
import time
import ipaddress
from typing import List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from pyVim.connect import SmartConnect, Disconnect
from pyVmomi import vim

from app.models.virtualization import EsxiHost, VirtualMachine, Datastore

class VirtualizationService:
    def __init__(self):
        # 忽略 SSL 警告
        self.ssl_context = ssl._create_unverified_context()

    def _get_connection(self, ip, user, pwd, port=443):
        try:
            print(f"[Debug] Connecting to {ip} port {port} user {user}")
            si = SmartConnect(host=ip, user=user, pwd=pwd, port=port, sslContext=self.ssl_context)
            atexit.register(Disconnect, si)
            print(f"[Debug] Connected to {ip}")
            return si
        except Exception as e:
            print(f"[Error] Failed to connect to {ip}: {e}")
            return None

    def _resolve_credentials(self, host: EsxiHost, user_override: Optional[str] = None, pwd_override: Optional[str] = None):
        user = user_override or host.username or os.getenv("ESXI_USER", "root")
        pwd = pwd_override or host.password or os.getenv("ESXI_PASSWORD")
        if not pwd:
            print(f"[Error] Missing password for {host.ip}")
            raise ValueError("缺少 ESXi 密码，请传递 password 或配置 ESXI_PASSWORD")
        return user, pwd

    def _wait_task(self, task, task_name: str, timeout: int = 1800):
        """轮询等待 vSphere 任务完成"""
        start = time.time()
        while task.info.state in [vim.TaskInfo.State.queued, vim.TaskInfo.State.running]:
            if time.time() - start > timeout:
                raise TimeoutError(f"{task_name} 超时")
            time.sleep(2)
        if task.info.state == vim.TaskInfo.State.success:
            return task.info.result
        err = getattr(task.info, "error", None)
        detail = str(err) if err else "unknown error"
        raise Exception(f"{task_name} 失败: {detail}")

    def _parse_datastore_path(self, path: str) -> Tuple[str, str]:
        """解析形如 '[datastore1] folder/file.vmx' 的路径"""
        if not path or "[" not in path or "]" not in path:
            raise ValueError(f"无法解析存储路径: {path}")
        ds = path[path.find("[") + 1 : path.find("]")]
        rel = path[path.find("]") + 1 :].strip()
        return ds, rel

    def _find_vm(self, content, dc, vm: VirtualMachine):
        """在 ESXi 中查找 VM 对象，尝试 instanceUuid/Bios UUID/IP/name 多种方式"""
        search_index = content.searchIndex
        target = None
        # 先按 instanceUuid
        try:
            target = search_index.FindByUuid(dc, vm.uuid, True, True)
        except Exception:
            target = None
        # 再按 bios uuid
        if not target:
            try:
                target = search_index.FindByUuid(dc, vm.uuid, True, False)
            except Exception:
                target = None
        # 再按 IP
        if not target and vm.ip_address:
            try:
                target = search_index.FindByIp(dc, vm.ip_address, True)
            except Exception:
                target = None
        # 最后按名称模糊匹配
        if not target and vm.name:
            try:
                target = search_index.FindByDnsName(dc, vm.name, True)
            except Exception:
                target = None
        return target

    def _reset_identity_and_nic(self, vm_obj, new_name: str, disconnect_nic: bool = True):
        """重置 UUID / MAC，避免“移动/复制”弹窗，必要时先断开网卡"""
        device_changes = []
        for dev in vm_obj.config.hardware.device:
            if isinstance(dev, vim.vm.device.VirtualEthernetCard):
                nic_spec = vim.vm.device.VirtualDeviceSpec()
                nic_spec.operation = vim.vm.device.VirtualDeviceSpec.Operation.edit
                nic_spec.device = dev
                nic_spec.device.addressType = "generated"
                nic_spec.device.macAddress = None
                if disconnect_nic and nic_spec.device.connectable:
                    nic_spec.device.connectable.connected = False
                    nic_spec.device.connectable.startConnected = False
                device_changes.append(nic_spec)

        extra = [
            vim.option.OptionValue(key="uuid.action", value="create"),
            vim.option.OptionValue(key="uuid.bios", value=""),
            vim.option.OptionValue(key="uuid.location", value=""),
        ]
        spec = vim.vm.ConfigSpec(name=new_name, deviceChange=device_changes, extraConfig=extra)
        task = vm_obj.ReconfigVM_Task(spec)
        self._wait_task(task, "reset-uuid-mac", timeout=180)

    def _ensure_tools_ready(self, vm_obj, timeout: int = 180):
        """等待 VMware Tools 就绪"""
        start = time.time()
        while time.time() - start < timeout:
            status = vm_obj.guest.toolsRunningStatus
            if status in ("guestToolsRunning", "guestToolsExecutingScripts"):
                return
            time.sleep(5)
        raise TimeoutError("VMware Tools 未就绪，无法在 Guest 内执行命令")

    def _run_guest_ip_config(self, content, vm_obj, username: str, password: str, nic: str, ip: str, netmask: str, gateway: Optional[str], dns: Optional[List[str]], host_ip: str = None):
        """在 Guest 内执行改 IP 脚本（Linux 假设有 nmcli）；容忍 link down 的 con up 失败"""
        print(f"[GuestOps] ========== 开始配置 IP ==========")
        print(f"[GuestOps] VM: {vm_obj.name}")
        print(f"[GuestOps] ESXi Host: {host_ip}")
        print(f"[GuestOps] 参数: nic={nic}, ip={ip}, netmask={netmask}, gateway={gateway}, dns={dns}")
        print(f"[GuestOps] Guest 用户: {username}, 密码长度: {len(password) if password else 0}")

        # 仅支持 Linux/有工具的环境；前提：VMware Tools 已就绪
        gom = content.guestOperationsManager
        auth = vim.NamePasswordAuthentication(username=username, password=password, interactiveSession=False)
        pm = gom.processManager

        # 转换掩码为 CIDR
        try:
            prefix = ipaddress.IPv4Network(f"0.0.0.0/{netmask}").prefixlen
            print(f"[GuestOps] 掩码转换: {netmask} -> /{prefix}")
        except Exception as e:
            print(f"[GuestOps] ❌ 掩码格式错误: {netmask}, error: {e}")
            raise ValueError(f"网关/掩码格式错误: {netmask}")

        dns_str = ""
        if dns:
            dns_str = " ".join(dns)

        # 使用 nmcli 进行持久化配置 (适用于 RHEL/CentOS/Rocky 7+)
        # 逻辑：删旧 profile -> 建新 profile -> 配置 -> reload -> down/up（link down 时允许失败）
        # 将执行日志写入 /tmp/opsnav-ip-{nic}.log 便于排障

        prefix_len = prefix 
        con_name = f"opsnav-{nic}"

        # 构造 DNS 列表字符串 "8.8.8.8 8.8.4.4"
        dns_list_str = " ".join(dns) if dns else ""

        # Python f-string 中，awk 的 { } 需要双写转义
        script = (
            f"NIC='{nic}';"
            f"CON='{con_name}';"
            f"LOG=\"/tmp/opsnav-ip-$NIC.log\";"
            f"echo \"[opsnav] start $(date)\" > \"$LOG\";"
            # 0. 确保 NetworkManager 已启动（不使用 set -e，避免启动命令失败导致脚本退出）
            f"echo \"[opsnav] 检查 NetworkManager...\" >> \"$LOG\";"
            f"if ! systemctl is-active NetworkManager >>\"$LOG\" 2>&1; then echo \"[opsnav] 启动 NetworkManager...\" >> \"$LOG\"; systemctl start NetworkManager >>\"$LOG\" 2>&1 || true; sleep 3; fi;"
            f"echo \"[opsnav] NetworkManager 状态: $(systemctl is-active NetworkManager 2>&1)\" >> \"$LOG\";"
            # 启用严格模式（从这里开始）
            f"set -e;"
            # 1. 删旧连接
            f"nmcli -t -f NAME,DEVICE con show | awk -F: -v nic=\"$NIC\" '$2==nic{{print $1}}' | while read -r c; do [ -n \"$c\" ] && nmcli con del \"$c\" >>\"$LOG\" 2>&1 || true; done;"
            # 2. 建新连接（不使用 autoconnect-priority，某些旧版本不支持）
            f"nmcli con add type ethernet ifname \"$NIC\" con-name \"$CON\" autoconnect yes >>\"$LOG\" 2>&1;"
            # 3. 配置
            f"nmcli con mod \"$CON\" ipv4.addresses {ip}/{prefix_len} ipv4.method manual >>\"$LOG\" 2>&1;"
            f"if [ -n '{gateway}' ]; then nmcli con mod \"$CON\" ipv4.gateway '{gateway}' >>\"$LOG\" 2>&1; fi;"
            f"if [ -n '{dns_list_str}' ]; then nmcli con mod \"$CON\" ipv4.dns '{dns_list_str}' ipv4.ignore-auto-dns yes >>\"$LOG\" 2>&1; fi;"
            f"nmcli con mod \"$CON\" connection.autoconnect yes >>\"$LOG\" 2>&1;"
            f"nmcli con reload >>\"$LOG\" 2>&1;"
            # 4. 尝试激活 (允许失败)
            f"nmcli con down \"$CON\" >>\"$LOG\" 2>&1 || true;"
            f"nmcli con up \"$CON\" >>\"$LOG\" 2>&1 || true;"
            f"echo \"[opsnav] end $(date)\" >> \"$LOG\";"
            f"exit 0;"
        )

        # 打印完整脚本便于排障
        print(f"[GuestOps] 生成的脚本内容:")
        print(f"[GuestOps] -------- SCRIPT START --------")
        for line in script.split(';'):
            if line.strip():
                print(f"[GuestOps]   {line.strip()}")
        print(f"[GuestOps] -------- SCRIPT END --------")

        # 方案：先写脚本文件到 VM，再执行（避免复杂转义问题）
        script_path = f"/tmp/opsnav-setup-{nic}.sh"
        fm = gom.fileManager

        # 1. 将脚本内容写入 VM 的临时文件
        print(f"[GuestOps] 写入脚本文件到 VM: {script_path}")
        try:
            # 将 ; 分隔的命令转换为换行符分隔，更清晰
            script_content = script.replace(';', '\n')
            script_bytes = script_content.encode('utf-8')

            # 创建文件属性
            file_attr = vim.vm.guest.FileManager.FileAttributes()

            # 获取上传 URL
            upload_url = fm.InitiateFileTransferToGuest(
                vm=vm_obj,
                auth=auth,
                guestFilePath=script_path,
                fileAttributes=file_attr,
                fileSize=len(script_bytes),
                overwrite=True
            )
            print(f"[GuestOps] 原始上传 URL: {upload_url[:80]}...")

            # VMware 返回的 URL 可能包含 * 作为主机名，需要替换为实际的 ESXi IP
            if host_ip and '*' in upload_url:
                upload_url = upload_url.replace('https://*', f'https://{host_ip}')
                print(f"[GuestOps] 修正后 URL: {upload_url[:80]}...")

            # 上传脚本内容
            import requests
            resp = requests.put(upload_url, data=script_bytes, verify=False)
            if resp.status_code not in (200, 201):
                raise Exception(f"上传脚本失败: HTTP {resp.status_code}")
            print(f"[GuestOps] ✅ 脚本文件上传成功")
        except Exception as e:
            print(f"[GuestOps] ❌ 写入脚本文件失败: {e}")
            raise

        # 2. 执行脚本文件
        spec = vim.vm.guest.ProcessManager.ProgramSpec(
            programPath="/bin/sh",
            arguments=script_path
        )
        print(f"[GuestOps] 开始执行脚本: /bin/sh {script_path}")
        try:
            pid = pm.StartProgramInGuest(vm=vm_obj, auth=auth, spec=spec)
            print(f"[GuestOps] ✅ 脚本已启动，PID: {pid}")
        except Exception as e:
            print(f"[GuestOps] ❌ StartProgramInGuest 失败: {e}")
            raise

        # 等待命令结束（增加时间，因为可能需要启动 NetworkManager）
        wait_seconds = 20
        print(f"[GuestOps] 等待脚本执行 {wait_seconds} 秒...")
        time.sleep(wait_seconds)

        # 查询进程状态
        print(f"[GuestOps] 查询进程 {pid} 状态...")
        try:
            procs = pm.ListProcessesInGuest(vm=vm_obj, auth=auth, pids=[pid])
            if procs:
                proc = procs[0]
                print(f"[GuestOps] 进程状态: name={proc.name}, exitCode={proc.exitCode}, endTime={proc.endTime}")
            else:
                print(f"[GuestOps] ⚠️ 未找到进程 {pid}")
        except Exception as e:
            print(f"[GuestOps] ⚠️ 查询进程状态失败: {e}")
            procs = None

        if procs and procs[0].exitCode not in (0, None):
            exit_code = procs[0].exitCode
            # nmcli con up 在链路 down 时可能返回 8（Activation failed），此时仍算成功落盘
            if exit_code == 8:
                print(f"[GuestOps] ⚠️ nmcli 返回 8 (link down)，配置已落盘，视为成功")
                print(f"[GuestOps] 提示: 请登录 VM 查看 /tmp/opsnav-ip-{nic}.log")
                return
            print(f"[GuestOps] ❌ 脚本执行失败，退出码: {exit_code}")
            print(f"[GuestOps] 提示: 请登录 VM 查看 /tmp/opsnav-ip-{nic}.log 和 {script_path}")
            raise Exception(f"改 IP 失败，退出码 {exit_code}")

        print(f"[GuestOps] ✅ IP 配置脚本执行完成")
        print(f"[GuestOps] 提示: 可登录 VM 查看 /tmp/opsnav-ip-{nic}.log 确认详情")

    def probe_host(self, ip, user, pwd, port=443) -> dict:
        """测试连接并返回基本信息"""
        si = self._get_connection(ip, user, pwd, port)
        if not si:
            return {"success": False, "message": "Connection failed"}
        
        try:
            content = si.RetrieveContent()
            about = content.about
            return {
                "success": True,
                "message": "Connected",
                "info": {
                    "hostname": about.name or "localhost",
                    "vendor": about.vendor,
                    "model": about.osType,
                    "version": about.fullName,
                },
            }
        except Exception as e:
            print(f"[Error] Probe failed: {e}")
            return {"success": False, "message": str(e)}
        finally:
            Disconnect(si)

    def sync_host_vms(self, db: Session, host: EsxiHost, user_override: Optional[str] = None, pwd_override: Optional[str] = None) -> List[VirtualMachine]:
        """同步指定宿主机的 VM 到数据库，同时采集宿主机资源信息"""
        print(f"[Sync] Start syncing host {host.ip}...")
        try:
            username, pwd = self._resolve_credentials(host, user_override, pwd_override)
        except ValueError as e:
            print(f"[Sync] Credential error: {e}")
            return []
            
        si = self._get_connection(host.ip, username, pwd, host.port)
        if not si:
            print(f"[Sync] Connection failed for {host.ip}, marking offline")
            host.status = "offline"
            db.commit()
            return []

        host.status = "online"
        host.last_sync_at = datetime.now(timezone.utc)

        content = si.RetrieveContent()

        # 宿主机资源信息
        try:
            h_view = content.viewManager.CreateContainerView(content.rootFolder, [vim.HostSystem], True)
            host_obj = h_view.view[0] if h_view.view else None
            if host_obj and host_obj.summary:
                hw = host_obj.summary.hardware
                quick = host_obj.summary.quickStats
                
                print(f"[Debug] Host HW: Cores={hw.numCpuCores}, Mem={hw.memorySize}")
                
                total_cpu_mhz = (hw.cpuMhz or 0) * (hw.numCpuCores or 0)
                used_cpu_mhz = quick.overallCpuUsage or 0
                host.cpu_usage = round(used_cpu_mhz / total_cpu_mhz * 100, 2) if total_cpu_mhz > 0 else 0
                host.cpu_cores = hw.numCpuCores

                mem_total_bytes = hw.memorySize or 0
                mem_used_bytes = (quick.overallMemoryUsage or 0) * 1024 * 1024
                host.memory_usage = round(mem_used_bytes / mem_total_bytes * 100, 2) if mem_total_bytes > 0 else 0
                host.memory_total_gb = round(mem_total_bytes / (1024**3), 2) if mem_total_bytes else None

                host.hostname = host_obj.name
                host.model = hw.model
                if host_obj.summary.config:
                    host.version = host_obj.summary.config.product.fullName

                total_cap = 0
                total_free = 0
                for ds in host_obj.datastore:
                    s = getattr(ds, "summary", None)
                    if not s:
                        continue
                    print(f"[Debug] Datastore: {s.name}, Cap={s.capacity}, Free={s.freeSpace}")
                    total_cap += getattr(s, "capacity", 0) or 0
                    total_free += getattr(s, "freeSpace", 0) or 0
                if total_cap:
                    host.storage_total_gb = round(total_cap / (1024**3), 2)
                    host.storage_free_gb = round(total_free / (1024**3), 2)
                
                print(f"[Sync] Stats updated: CPU={host.cpu_usage}%, Mem={host.memory_usage}%, Storage={host.storage_free_gb}/{host.storage_total_gb}GB")

                # Sync Datastores
                for ds in host_obj.datastore:
                    try:
                        summary = getattr(ds, "summary", None)
                        if not summary: continue
                        
                        ds_url = summary.url
                        ds_name = summary.name
                        ds_type = summary.type
                        ds_capacity = round(summary.capacity / (1024**3), 2)
                        ds_free = round(summary.freeSpace / (1024**3), 2)
                        
                        # Upsert
                        db_ds = db.query(Datastore).filter(Datastore.id == ds_url).first()
                        if not db_ds:
                            db_ds = Datastore(id=ds_url)
                            db.add(db_ds)
                        
                        db_ds.name = ds_name
                        db_ds.type = ds_type
                        db_ds.capacity_gb = ds_capacity
                        db_ds.free_gb = ds_free
                        db_ds.last_sync = datetime.now(timezone.utc)
                        print(f"[Sync] Datastore updated: {ds_name}")
                        
                    except Exception as e:
                        print(f"[Sync] Error syncing datastore: {e}")

            h_view.Destroy()
        except Exception as e:
            print(f"[Sync] host stats fetch failed for {host.ip}: {e}")
            import traceback
            traceback.print_exc()

        # 获取虚拟机
        print(f"[Sync] Retrieving VM list from {host.ip}...")
        container = content.viewManager.CreateContainerView(content.rootFolder, [vim.VirtualMachine], True)
        vms_data = []

        vm_list = container.view
        print(f"[Sync] Found {len(vm_list)} VMs on {host.ip}")
        try:
            print(f"[Sync] VM List: {[v.name for v in vm_list]}")
        except:
            pass

        for vm in vm_list:
            try:
                summary = vm.summary
                config = summary.config
                
                # 尝试获取基本信息，即使 config 为空（如果是新注册 VM，config 可能尚未就绪，但 summary.config 应该有）
                # 注意：如果 config 为 None，vm.summary.config 也是 None
                if not config:
                    # 尝试直接从 vm.config 获取
                    config = vm.config
                
                if not config:
                    print(f"[Sync] Warning: Skipping VM '{vm.name}' because config is None. State: {vm.runtime.powerState}")
                    continue
                    
                guest = summary.guest
                runtime = summary.runtime

                vm_id = f"{host.ip}-{config.uuid}"
                print(f"[Sync] Processing VM: {config.name} (UUID: {config.uuid})")

                status_map = {
                    "poweredOn": "poweredOn",
                    "poweredOff": "poweredOff",
                    "suspended": "suspended",
                }
                status = status_map.get(runtime.powerState, "unknown")

                quick = summary.quickStats
                storage = summary.storage
                cpu_usage_mhz = getattr(quick, "overallCpuUsage", None)
                mem_usage_mb = getattr(quick, "guestMemoryUsage", None)
                uptime_seconds = getattr(quick, "uptimeSeconds", None)
                tools_status = getattr(guest, "toolsStatus", None)
                annotation = getattr(config, "annotation", None)
                committed = getattr(storage, "committed", None) if storage else None
                uncommitted = getattr(storage, "uncommitted", None) if storage else None
                disk_used_gb = round(committed / (1024**3), 2) if committed else None
                if committed is not None and uncommitted is not None:
                    disk_provisioned_gb = round((committed + uncommitted) / (1024**3), 2)
                else:
                    disk_provisioned_gb = None

                vm_obj = VirtualMachine(
                    id=vm_id,
                    uuid=config.uuid,
                    name=config.name,
                    host_ip=host.ip,
                    status=status,
                    ip_address=getattr(guest, "ipAddress", None),
                    os_name=getattr(guest, "guestFullName", None) or getattr(config, "guestFullName", None),
                    description=annotation,
                    cpu_count=config.numCpu,
                    memory_mb=config.memorySizeMB,
                    cpu_usage_mhz=cpu_usage_mhz,
                    memory_usage_mb=mem_usage_mb,
                    uptime_seconds=uptime_seconds,
                    disk_used_gb=disk_used_gb,
                    disk_provisioned_gb=disk_provisioned_gb,
                    tools_status=tools_status,
                    last_sync=datetime.now(timezone.utc),
                )

                # Update or Insert
                existing = db.query(VirtualMachine).filter(VirtualMachine.id == vm_id).first()
                if existing:
                    existing.name = vm_obj.name
                    existing.status = vm_obj.status
                    existing.ip_address = vm_obj.ip_address
                    existing.os_name = vm_obj.os_name
                    existing.description = vm_obj.description
                    existing.cpu_count = vm_obj.cpu_count
                    existing.memory_mb = vm_obj.memory_mb
                    existing.cpu_usage_mhz = vm_obj.cpu_usage_mhz
                    existing.memory_usage_mb = vm_obj.memory_usage_mb
                    existing.uptime_seconds = vm_obj.uptime_seconds
                    existing.disk_used_gb = vm_obj.disk_used_gb
                    existing.disk_provisioned_gb = vm_obj.disk_provisioned_gb
                    existing.tools_status = vm_obj.tools_status
                    existing.last_sync = vm_obj.last_sync
                    print(f"[Sync] Updated VM {vm_obj.name}")
                else:
                    db.add(vm_obj)
                    print(f"[Sync] Added new VM {vm_obj.name}")

                vms_data.append(vm_obj)
            except Exception as e:
                print(f"[Sync] Error parsing VM: {e}")
                continue

        # 清理已删除的 VM
        if vms_data:
            current_ids = [vm.id for vm in vms_data]
            deleted = db.query(VirtualMachine).filter(
                VirtualMachine.host_ip == host.ip,
                VirtualMachine.id.notin_(current_ids)
            ).delete(synchronize_session=False)
            if deleted > 0:
                print(f"[Sync] Removed {deleted} stale VMs from DB")
        else:
            # 如果没抓到任何 VM（但也连接成功了），说明该主机下所有 VM 都没了
            deleted = db.query(VirtualMachine).filter(
                VirtualMachine.host_ip == host.ip
            ).delete(synchronize_session=False)
            if deleted > 0:
                print(f"[Sync] Removed all {deleted} stale VMs from DB (Host empty)")

        print(f"[Sync] Committing to DB...")
        db.commit()
        print(f"[Sync] Sync complete for {host.ip}")
        Disconnect(si)
        return vms_data

    def list_vms_direct(self, host_ip, user, pwd) -> List[dict]:
        """不通过数据库，直接连 ESXi 列出 VM (用于调试)"""
        si = self._get_connection(host_ip, user, pwd)
        if not si:
            raise Exception("Connect failed")
        
        content = si.RetrieveContent()
        container = content.viewManager.CreateContainerView(content.rootFolder, [vim.VirtualMachine], True)
        
        res = []
        for vm in container.view:
            res.append({
                "id": vm.summary.config.uuid,
                "uuid": vm.summary.config.uuid,
                "name": vm.summary.config.name,
                "host_ip": host_ip,
                "status": vm.summary.runtime.powerState,
                "ip_address": vm.summary.guest.ipAddress,
                "os_name": vm.summary.guest.guestFullName,
                "cpu_count": vm.summary.config.numCpu,
                "memory_mb": vm.summary.config.memorySizeMB,
            })
        Disconnect(si)
        return res

    def update_host(self, db: Session, host: EsxiHost, username: Optional[str] = None, password: Optional[str] = None, port: Optional[int] = None):
        if username:
            host.username = username
        if password:
            host.password = password
        if port:
            host.port = port
        db.commit()
        db.refresh(host)
        return host

    def delete_host(self, db: Session, host: EsxiHost):
        db.query(VirtualMachine).filter(VirtualMachine.host_ip == host.ip).delete(synchronize_session=False)
        db.delete(host)
        db.commit()

    def sync_all_hosts(self, db: Session):
        hosts = db.query(EsxiHost).all()
        for host in hosts:
            try:
                self.sync_host_vms(db, host)
            except Exception as e:
                print(f"sync host {host.ip} failed: {e}")

    def _answer_vm_question(self, vm_obj):
        """检查并自动回答 VM 提问（默认为 'I copied it'）"""
        # 必须重新读取 runtime.question
        try:
            q = vm_obj.runtime.question
            if not q:
                return

            qid = q.id
            print(f"[Power] Found question: {q.text}")
            
            choice = None
            for opt in q.choice.choiceInfo:
                print(f"[Power] Option: key={opt.key}, label={opt.label}")
                if "copied" in opt.label.lower() or "copy" in opt.label.lower(): 
                    choice = opt.key
                elif "复制" in opt.label: 
                    choice = opt.key
            
            if not choice and len(q.choice.choiceInfo) >= 2:
                 choice = q.choice.choiceInfo[1].key
                 print(f"[Power] No keyword match, selecting 2nd option (key={choice})")
            
            if not choice: 
                choice = '2'
                print(f"[Power] No choice found, default to '2'")

            print(f"[Power] Answering question {qid} with choice {choice}")
            vm_obj.AnswerVM(qid, choice)
        except Exception as e:
            print(f"[Power] Answer failed: {e}")

    def power_vm(self, db: Session, host: EsxiHost, vm: VirtualMachine, action: str):
        """执行电源相关动作：powerOn/shutdown/powerOff/reboot/reset"""
        username, password = self._resolve_credentials(host)
        si = self._get_connection(host.ip, username, password, host.port)
        if not si:
            raise Exception(f"连接 {host.ip} 失败")

        try:
            content = si.RetrieveContent()
            dc = content.rootFolder.childEntity[0] if content.rootFolder.childEntity else None
            if not dc:
                raise Exception("未找到数据中心对象")
            vm_obj = self._find_vm(content, dc, vm)
            if not vm_obj:
                raise ValueError("未在 ESXi 上找到对应的虚拟机（UUID/IP/名称均未命中）")

            act = action.lower()
            msg = ""
            if act in ["poweron", "on", "start"]:
                if vm_obj.runtime.powerState == vim.VirtualMachinePowerState.poweredOn:
                    msg = "虚拟机已处于开机状态"
                else:
                    task = vm_obj.PowerOnVM_Task()
                    # 不等待完全成功，因为可能有 Question 阻塞
                    # 但我们需要等待它进入 Running 或者抛出 Question
                    # self._wait_task(task, "power-on", timeout=600) 
                    # 改为手动轮询以便处理 Question
                    start = time.time()
                    while task.info.state in [vim.TaskInfo.State.queued, vim.TaskInfo.State.running]:
                        if vm_obj.runtime.question:
                            self._answer_vm_question(vm_obj)
                        if time.time() - start > 60:
                            raise TimeoutError("PowerOn 等待超时")
                        time.sleep(1)
                    
                    if task.info.state == vim.TaskInfo.State.error:
                        raise Exception(f"PowerOn 失败: {task.info.error}")
                        
                    msg = "已开机"
            elif act in ["shutdown", "shutdownguest", "guestshutdown"]:
                if vm_obj.runtime.powerState == vim.VirtualMachinePowerState.poweredOff:
                    msg = "虚拟机已关闭"
                else:
                    try:
                        vm_obj.ShutdownGuest()
                        msg = "已发起软关机（依赖 VMware Tools）"
                    except Exception as e:
                        # 按需求：只软关机，失败不做硬关机
                        raise ValueError(f"软关机失败，请检查 VMware Tools：{e}")
            elif act in ["poweroff", "off", "halt"]:
                if vm_obj.runtime.powerState == vim.VirtualMachinePowerState.poweredOff:
                    msg = "虚拟机已关闭"
                else:
                    task = vm_obj.PowerOffVM_Task()
                    self._wait_task(task, "power-off", timeout=600)
                    msg = "已执行硬关机"
            elif act in ["reboot", "rebootguest"]:
                try:
                    vm_obj.RebootGuest()
                    msg = "已发起软重启（依赖 VMware Tools）"
                except Exception as e:
                    print(f"[Power] RebootGuest 失败，尝试硬重置: {e}")
                    task = vm_obj.ResetVM_Task()
                    self._wait_task(task, "reset", timeout=600)
                    msg = "软重启失败，已执行硬重置"
            elif act in ["reset", "hardreset"]:
                task = vm_obj.ResetVM_Task()
                self._wait_task(task, "reset", timeout=600)
                msg = "已执行硬重置"
            else:
                raise ValueError("不支持的动作")

            # 同步一次状态（失败不影响返回）
            try:
                self.sync_host_vms(db, host)
            except Exception as e:
                print(f"[Power] Sync warning: {e}")

            return {
                "task_id": f"power-{vm.id}-{int(time.time())}",
                "status": "success",
                "message": msg,
            }
        finally:
            Disconnect(si)

    def update_vm_basic_info(
        self,
        db: Session,
        host: EsxiHost,
        vm: VirtualMachine,
        new_name: Optional[str] = None,
        new_description: Optional[str] = None,
    ) -> VirtualMachine:
        """更新 VM 的名称/备注（同步操作 ESXi），成功后更新本地数据库。"""
        username, password = self._resolve_credentials(host)
        si = self._get_connection(host.ip, username, password, host.port)
        if not si:
            raise Exception(f"连接 {host.ip} 失败")

        try:
            content = si.RetrieveContent()
            dc = content.rootFolder.childEntity[0] if content.rootFolder.childEntity else None
            if not dc:
                raise Exception("未找到数据中心对象")

            vm_obj = self._find_vm(content, dc, vm)
            if not vm_obj:
                raise ValueError("未在 ESXi 上找到对应的虚拟机（UUID/IP/名称均未命中）")

            changed = False

            if new_name is not None:
                desired_name = new_name.strip()
                if not desired_name:
                    raise ValueError("name 不能为空")
                if desired_name != vm_obj.name:
                    task = vm_obj.Rename_Task(desired_name)
                    self._wait_task(task, "rename-vm", timeout=300)
                    vm.name = desired_name
                    changed = True

            if new_description is not None:
                current_annotation = getattr(getattr(vm_obj, "summary", None), "config", None)
                current_annotation = getattr(current_annotation, "annotation", None)
                if new_description != current_annotation:
                    spec = vim.vm.ConfigSpec(annotation=new_description)
                    task = vm_obj.ReconfigVM_Task(spec)
                    self._wait_task(task, "update-annotation", timeout=300)
                    vm.description = new_description
                    changed = True

            if changed:
                vm.last_sync = datetime.now(timezone.utc)
                db.commit()
                db.refresh(vm)

            return vm
        finally:
            Disconnect(si)

    def clone_vm(
        self,
        db: Session,
        host: EsxiHost,
        vm: VirtualMachine,
        new_name: str,
        target_datastore: Optional[str] = None,
        power_on: bool = False,
        source_ip: Optional[str] = None,
        auto_config_ip: bool = False,
        guest_username: Optional[str] = None,
        guest_password: Optional[str] = None,
        new_ip: Optional[str] = None,
        netmask: Optional[str] = None,
        gateway: Optional[str] = None,
        dns: Optional[List[str]] = None,
        nic_name: Optional[str] = "eth0",
        disconnect_nic_first: bool = True,
        task_service=None,
        task_id: Optional[str] = None,
    ):
        """基于关机状态的离线克隆：复制文件并 RegisterVM"""
        
        prefix_msg = f"{vm.name}->{new_name}"
        
        def task_update(status=None, progress=None, message=None, result=None):
            if task_service and task_id:
                try:
                    # 自动添加前缀，除非 message 为空
                    final_msg = message
                    if message and prefix_msg not in message:
                        final_msg = f"[{prefix_msg}] {message}"
                        
                    task_service.update_task(db, task_id, status=status, progress=progress, message=final_msg, result=result)
                except Exception as e:
                    print(f"[Task] update failed: {e}")

        username, password = self._resolve_credentials(host)
        si = self._get_connection(host.ip, username, password, host.port)
        if not si:
            raise Exception(f"连接 {host.ip} 失败")

        new_vm = None
        ip_configured = False
        ip_message = None
        task_update(status="running", progress=5, message="连接 ESXi")

        if auto_config_ip:
            if not guest_username or not guest_password:
                raise ValueError("开启自动改 IP 需要提供 guest_username 与 guest_password")
            if not new_ip or not netmask:
                raise ValueError("自动改 IP 需要提供 new_ip 与 netmask")
            power_on = True  # 需要开机才能执行 GuestOps

        try:
            content = si.RetrieveContent()
            dc = content.rootFolder.childEntity[0] if content.rootFolder.childEntity else None
            if not dc:
                raise Exception("未找到数据中心对象")

            vm_obj = self._find_vm(content, dc, vm)
            if not vm_obj:
                raise ValueError("未在 ESXi 上找到对应的虚拟机（UUID/IP/名称均未命中）")
            if vm_obj.runtime.powerState != vim.VirtualMachinePowerState.poweredOff:
                raise ValueError("克隆前请先关机（已在前端限制）")

            config = vm_obj.config
            if not config:
                raise ValueError("VM 缺少配置，无法克隆")

            src_vmx = config.files.vmPathName
            src_ds, src_rel_path = self._parse_datastore_path(src_vmx)
            target_ds = target_datastore or src_ds
            target_folder = new_name
            target_dir = f"[{target_ds}] {target_folder}"
            target_vmx = f"{target_dir}/{os.path.basename(src_rel_path)}"

            file_mgr = content.fileManager
            disk_mgr = content.virtualDiskManager

            # 检查并清理目标目录
            try:
                # 尝试查找目标目录是否已存在（通过 ListDatastoreFile 或直接尝试删除）
                # 为了简单起见，我们直接尝试删除（如果不存在会抛错，catch 住即可）
                print(f"[Clone] 尝试清理目标目录 {target_dir}")
                del_task = file_mgr.DeleteDatastoreFile_Task(name=target_dir, datacenter=dc)
                self._wait_task(del_task, f"cleanup-{target_folder}", timeout=60)
                print(f"[Clone] 已清理旧目录 {target_dir}")
            except Exception as e:
                # 如果目录不存在，Delete 会报错，属于正常情况
                print(f"[Clone] Cleanup skipped (probably not exists): {e}")
            task_update(progress=10, message="准备目标目录")

            print(f"[Clone] 创建目录 {target_dir}")
            try:
                file_mgr.MakeDirectory(name=target_dir, datacenter=dc, createParentDirectories=True)
            except Exception as e:
                print(f"[Clone] MakeDirectory warning: {e}")
            task_update(progress=15, message="创建目录完成")

            # 复制磁盘
            for idx, dev in enumerate(config.hardware.device):
                if isinstance(dev, vim.vm.device.VirtualDisk):
                    src_disk = dev.backing.fileName
                    disk_name = os.path.basename(src_disk)
                    dst_disk = f"{target_dir}/{disk_name}"
                    print(f"[Clone] 复制磁盘 {src_disk} -> {dst_disk}")
                    task = disk_mgr.CopyVirtualDisk_Task(
                        sourceName=src_disk,
                        sourceDatacenter=dc,
                        destName=dst_disk,
                        destDatacenter=dc,
                        destSpec=None,
                        force=True,
                    )
                    self._wait_task(task, f"copy-disk-{disk_name}", timeout=3600)
                    task_update(progress=30, message=f"复制磁盘 {disk_name}")

            # 复制 vmx / nvram / vmxf 等配置文件（存在才复制）
            copy_files = [src_vmx, getattr(config.files, "nvram", None), getattr(config.files, "vmxfFile", None)]
            for fpath in copy_files:
                if not fpath:
                    continue
                fname = os.path.basename(fpath)
                dst_path = f"{target_dir}/{fname}"
                print(f"[Clone] 复制配置 {fpath} -> {dst_path}")
                task = file_mgr.CopyDatastoreFile_Task(
                    sourceName=fpath,
                    sourceDatacenter=dc,
                    destinationName=dst_path,
                    destinationDatacenter=dc,
                    force=True,
                )
                self._wait_task(task, f"copy-file-{fname}", timeout=600)
            task_update(progress=50, message="复制配置文件完成")

            resource_pool = vm_obj.resourcePool
            host_ref = vm_obj.runtime.host
            folder = dc.vmFolder

            print(f"[Clone] 注册新虚拟机 {new_name}，vmx: {target_vmx}")
            reg_task = folder.RegisterVM_Task(
                path=target_vmx,
                name=new_name,
                asTemplate=False,
                pool=resource_pool,
                host=host_ref,
            )
            new_vm = self._wait_task(reg_task, "register-vm", timeout=600)
            task_update(progress=65, message="注册虚拟机完成")
            # 重置 UUID/MAC，避免开机弹“移动/复制”，并按需断开网卡
            try:
                self._reset_identity_and_nic(new_vm, new_name, disconnect_nic=disconnect_nic_first)
            except Exception as e:
                print(f"[Clone] reset uuid/mac warning: {e}")
            task_update(progress=70, message="重置 UUID/MAC")

            # 开机（如需）并处理 Question
            if power_on:
                print(f"[Clone] 开机新虚拟机 {new_name}")
                task = new_vm.PowerOnVM_Task()
                start = time.time()
                while task.info.state in [vim.TaskInfo.State.queued, vim.TaskInfo.State.running]:
                    if new_vm.runtime.question:
                        self._answer_vm_question(new_vm)
                    if time.time() - start > 120:
                        print("[Clone] PowerOn wait timeout")
                        break
                    time.sleep(1)
                if task.info.state == vim.TaskInfo.State.error:
                    raise Exception(f"开机失败: {task.info.error}")
                
                # 开机成功后立即同步一次，更新 PowerState
                try:
                    self.sync_host_vms(db, host)
                except Exception as e:
                    print(f"[Clone] Intermediate sync warning: {e}")
                
                # 等待 OS 启动 (Heartbeat / Tools)
                try:
                    task_update(progress=82, message="等待操作系统启动...")
                    self._ensure_tools_ready(new_vm, timeout=300)
                    task_update(progress=85, message="操作系统已就绪")
                except Exception as e:
                    print(f"[Clone] Wait tools warning: {e}")
                    task_update(progress=85, message="开机完成 (Tools未就绪)")

            # 自动改 IP（可选，需要 VMware Tools）
            ip_configured = False
            ip_message = None
            if auto_config_ip and new_vm:
                print(f"[Clone] ========== 开始自动改 IP 流程 ==========")
                print(f"[Clone] 请求参数:")
                print(f"[Clone]   guest_username: {guest_username}")
                print(f"[Clone]   guest_password: {'*' * len(guest_password) if guest_password else '(空)'}")
                print(f"[Clone]   nic_name: {nic_name}")
                print(f"[Clone]   new_ip: {new_ip}")
                print(f"[Clone]   netmask: {netmask}")
                print(f"[Clone]   gateway: {gateway}")
                print(f"[Clone]   dns: {dns}")
                try:
                    print(f"[Clone] 等待 VMware Tools 就绪 (timeout=180s)...")
                    self._ensure_tools_ready(new_vm, timeout=180)
                    print(f"[Clone] ✅ VMware Tools 已就绪")
                    task_update(progress=85, message="VMware Tools 就绪，开始改 IP")
                    self._run_guest_ip_config(
                        content,
                        new_vm,
                        username=guest_username or "root",
                        password=guest_password or "",
                        nic=nic_name or "eth0",
                        ip=new_ip,
                        netmask=netmask,
                        gateway=gateway,
                        dns=dns,
                        host_ip=host.ip,  # 传入 ESXi IP 用于修正上传 URL
                    )
                    ip_configured = True
                    ip_message = f"已在 {nic_name or 'eth0'} 上设置 {new_ip}"
                    print(f"[Clone] ✅ {ip_message}")
                    task_update(progress=90, message=ip_message)
                except Exception as e:
                    ip_message = f"自动改 IP 失败: {e}"
                    print(f"[Clone] ❌ {ip_message}")
                    import traceback
                    print(f"[Clone] 异常堆栈: {traceback.format_exc()}")
                    # raise # 不抛出异常，以免影响后续重连网卡和同步流程
                finally:
                    # 重连网卡
                    print(f"[Clone] ========== 重连网卡 ==========")
                    try:
                        device_changes = []
                        for dev in new_vm.config.hardware.device:
                            if isinstance(dev, vim.vm.device.VirtualEthernetCard):
                                print(f"[Clone] 发现网卡: {dev.deviceInfo.label}, MAC: {dev.macAddress}")
                                nic_spec = vim.vm.device.VirtualDeviceSpec()
                                nic_spec.operation = vim.vm.device.VirtualDeviceSpec.Operation.edit
                                nic_spec.device = dev
                                if nic_spec.device.connectable:
                                    old_connected = nic_spec.device.connectable.connected
                                    nic_spec.device.connectable.connected = True
                                    nic_spec.device.connectable.startConnected = True
                                    print(f"[Clone] 设置网卡 {dev.deviceInfo.label}: connected={old_connected}->True")
                                device_changes.append(nic_spec)
                        if device_changes:
                            print(f"[Clone] 执行 ReconfigVM_Task 重连 {len(device_changes)} 个网卡...")
                            spec = vim.vm.ConfigSpec(deviceChange=device_changes)
                            task = new_vm.ReconfigVM_Task(spec)
                            self._wait_task(task, "reconnect-nic", timeout=120)
                            print(f"[Clone] ✅ 网卡重连完成")
                        else:
                            print(f"[Clone] ⚠️ 未发现需要重连的网卡")
                    except Exception as e:
                        print(f"[Clone] ❌ reconnect nic 失败: {e}")
                        import traceback
                        print(f"[Clone] 异常堆栈: {traceback.format_exc()}")

            # 同步一次数据库（非阻塞/失败不影响结果）
            try:
                self.sync_host_vms(db, host)
            except Exception as e:
                print(f"[Clone] Sync warning: {e}")

            return {
                "success": True,
                "message": "克隆完成",
                "new_vm_moref": new_vm._GetMoId() if new_vm else None,
                "new_vmx_path": target_vmx,
                "source_ip": source_ip,
                "ip_configured": ip_configured if auto_config_ip else None,
                "ip_message": ip_message if auto_config_ip else None,
            }
        finally:
            Disconnect(si)

    def install_tools_ssh(self, ip, username, password):
        """SSH into VM and install open-vm-tools"""
        import paramiko
        
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        log = []
        try:
            print(f"[SSH] Connecting to {ip}...")
            client.connect(ip, username=username, password=password, timeout=10)
            
            # Detect OS roughly
            _, stdout, _ = client.exec_command("cat /etc/os-release")
            os_info = stdout.read().decode().lower()
            
            cmd = ""
            if "centos" in os_info or "rhel" in os_info or "fedora" in os_info:
                # CentOS 8 EOL fix: Switch to Aliyun Vault/Mirror
                fix_repo = (
                    "if grep -q 'release 8' /etc/redhat-release; then "
                    "  sed -i 's/mirrorlist/#mirrorlist/g' /etc/yum.repos.d/CentOS-*.repo; "
                    "  sed -i 's|#baseurl=http://mirror.centos.org|baseurl=http://mirrors.aliyun.com|g' /etc/yum.repos.d/CentOS-*.repo; "
                    "fi"
                )
                cmd = f"{fix_repo} && yum install -y open-vm-tools && systemctl start vmtoolsd && systemctl enable vmtoolsd"
            elif "ubuntu" in os_info or "debian" in os_info:
                # apt might need non-interactive
                cmd = "export DEBIAN_FRONTEND=noninteractive; apt-get update && apt-get install -y open-vm-tools && systemctl start vmtoolsd && systemctl enable vmtoolsd"
            elif "alpine" in os_info:
                cmd = "apk add open-vm-tools && rc-service open-vm-tools start && rc-update add open-vm-tools"
            else:
                # Fallback trial
                cmd = "yum install -y open-vm-tools || apt-get install -y open-vm-tools"

            print(f"[SSH] Executing: {cmd}")
            stdin, stdout, stderr = client.exec_command(cmd)
            
            # Wait for completion (blocking)
            exit_status = stdout.channel.recv_exit_status()
            out_str = stdout.read().decode()
            err_str = stderr.read().decode()
            
            log.append(f"Command: {cmd}")
            log.append(f"Exit Code: {exit_status}")
            if out_str: log.append(f"Stdout: {out_str[:500]}...")
            if err_str: log.append(f"Stderr: {err_str[:500]}...")
            
            if exit_status != 0:
                raise Exception(f"Install command failed (Exit {exit_status}): {err_str.strip() or out_str.strip()}")
                
            return {"success": True, "message": "Installation success", "log": log}
            
        except Exception as e:
            print(f"[SSH] Error: {e}")
            raise Exception(f"SSH Failed: {str(e)}")
        finally:
            client.close()

virtualization_service = VirtualizationService()
