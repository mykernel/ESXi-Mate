import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { MonitorTableFrame } from '@/components/monitor/MonitorTableFrame';
import { MonitorToolbar } from '@/components/monitor/MonitorToolbar';
import { virtualizationApi, VirtualMachine, EsxiHost } from '@/api/virtualization';
import { 
  Play, 
  Repeat, 
  Monitor, 
  MoreHorizontal, 
  Search,
  Server,
  Cpu,
  RefreshCw,
  HardDrive,
  Box,
  Copy,
  AlertCircle,
  Power,
  XCircle,
  Loader2,
  ListChecks,
  Activity,
  X,
  FilterX,
  Wrench,
  Key,
  Pencil
} from 'lucide-react';
	import { cn } from '@/lib/utils';
const PaginationControls = ({ page, pageSize, total, onPageChange, onPageSizeChange }: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between text-sm">
      <div>共 {total} 条，{page} / {totalPages} 页</div>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          上一页
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          下一页
        </button>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="border rounded px-2 py-1"
        >
          {[10, 20, 50, 100].map((size) => (
            <option key={size} value={size}>
              每页 {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

const formatDuration = (seconds: number | undefined | null) => {
  if (!seconds) return '0m';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d${hours}h`;
  if (hours > 0) return `${hours}h${mins}m`;
  return `${mins}m`;
};
import { TaskCenter } from '@/components/TaskCenter';
import { CredentialsManager } from './components/CredentialsManager';

// --- Components ---

const MiniProgress = ({ percent, colorClass = "bg-blue-500" }: { percent: number, colorClass?: string }) => (
  <div className="h-1 w-full bg-muted rounded-full overflow-hidden mt-1">
    <div 
      className={cn("h-full transition-all duration-500", colorClass)} 
      style={{ width: `${Math.min(percent, 100)}%` }} 
    />
  </div>
);

// Modal Component
const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode; 
  footer?: React.ReactNode 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md border border-border">
        <div className="flex justify-between items-center px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <span className="text-2xl">×</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-border bg-muted/20 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

const simpleFormatGB = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
};

const StatusBadge = ({ status }: { status: string }) => {
  let colorClass = 'text-muted-foreground';
  let label = '未知';
  let dotColor = 'bg-gray-300';

  switch (status) {
    case 'poweredOn':
      colorClass = 'text-emerald-600';
      dotColor = 'bg-emerald-500';
      label = '运行中';
      break;
    case 'poweredOff':
      colorClass = 'text-gray-500';
      dotColor = 'bg-gray-400';
      label = '已停止';
      break;
    case 'suspended':
      colorClass = 'text-amber-600';
      dotColor = 'bg-amber-500';
      label = '已挂起';
      break;
    default:
      label = status || '未知';
  }

  return (
    <div className="flex items-center gap-1.5">
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColor)} />
        <span className={cn("text-[11px] font-medium", colorClass)}>{label}</span>
    </div>
  );
};

const ToolsStatusBadge = ({ status, osName, onInstall }: { status?: string; osName?: string; onInstall?: () => void }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!status) return <span className="text-gray-300 text-[11px] pl-2">-</span>;

  let color = "text-gray-500";
  let dotColor = "bg-gray-300";
  let text = status;
  let showHint = false;

  if (status === 'toolsOk') {
    color = "text-emerald-600";
    dotColor = "bg-emerald-500";
    text = "正常";
  } else if (status === 'toolsOld') {
    color = "text-amber-600";
    dotColor = "bg-amber-500";
    text = "旧版";
  } else if (status === 'toolsNotRunning') {
    color = "text-red-600";
    dotColor = "bg-red-500";
    text = "未运行";
    showHint = true;
  } else if (status === 'toolsNotInstalled') {
    color = "text-slate-400";
    dotColor = "bg-slate-300";
    text = "未安装";
    showHint = true;
  }

  const handleMouseEnter = () => {
    if (!showHint) return;
    timerRef.current = setTimeout(() => {
        setShowTooltip(true);
    }, 1500);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
    }
    setShowTooltip(false);
  };

  return (
    <div className="flex items-center">
        <div 
            className={cn("flex items-center gap-1.5 relative", showHint ? "cursor-help" : "")}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColor)} />
            <span className={cn("text-[11px] font-medium", color)}>{text}</span>
            
            {showTooltip && showHint && (
                <div className="absolute left-0 bottom-full mb-1.5 w-[240px] rounded bg-slate-900/95 p-3 text-[10px] text-white shadow-xl z-50 backdrop-blur-sm border border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                    <div className="font-semibold mb-2 text-slate-300 border-b border-slate-700 pb-1 flex justify-between">
                        <span>安装指引</span>
                        <span className="text-[9px] font-normal text-slate-500">{osName || 'Unknown OS'}</span>
                    </div>
                    
                    <div className="space-y-2">
                        <div>
                            <div className="text-[9px] font-medium text-blue-400 mb-0.5">CentOS / RHEL</div>
                            <div className="bg-black/40 p-1.5 rounded border border-white/5 font-mono text-emerald-400 whitespace-pre-wrap break-all select-all leading-tight">
                                yum install -y open-vm-tools
                            </div>
                        </div>
                        <div>
                            <div className="text-[9px] font-medium text-orange-400 mb-0.5">Ubuntu / Debian</div>
                            <div className="bg-black/40 p-1.5 rounded border border-white/5 font-mono text-emerald-400 whitespace-pre-wrap break-all select-all leading-tight">
                                apt install -y open-vm-tools
                            </div>
                        </div>
                    </div>

                    {/* Arrow */}
                    <div className="absolute left-2 top-full h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-slate-900/95"></div>
                </div>
            )}
        </div>
        {showHint && onInstall && (
            <button 
                onClick={(e) => { e.stopPropagation(); onInstall(); }}
                className="ml-2 p-1 rounded-full hover:bg-blue-100 text-blue-500 transition-colors"
                title="一键安装 (SSH)"
            >
                <Wrench className="w-3 h-3" />
            </button>
        )}
    </div>
  );
};

const Instances: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [refreshMinutes, setRefreshMinutes] = useState(5);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [vms, setVms] = useState<VirtualMachine[]>([]);
  const [hosts, setHosts] = useState<EsxiHost[]>([]);
  
  // Filters
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [filterHostId, setFilterHostId] = useState<string>(searchParams.get('host_id') || 'all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTaskCenterOpen, setIsTaskCenterOpen] = useState(false);
  const [fastPollingUntil, setFastPollingUntil] = useState<number>(0);
  
  // Clone State
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isSubmittingClone, setIsSubmittingClone] = useState(false);
  const [cloneSourceVm, setCloneSourceVm] = useState<VirtualMachine | null>(null);
  const [cloneNewName, setCloneName] = useState('');
  const [clonePowerOn, setClonePowerOn] = useState(true);
  
  // Clone IP Customization
  const [cloneCustomizeIp, setCloneCustomizeIp] = useState(false);
  const [cloneIpConfig, setCloneIpConfig] = useState({
      username: 'root',
      password: '',
      ip: '',
      netmask: '255.255.255.0',
      gateway: '',
      dns: '114.114.114.114',
      nic: 'ens192'
  });

  // Install Tools State
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isCredManagerOpen, setIsCredManagerOpen] = useState(false);
  const [installTargetVm, setInstallTargetVm] = useState<VirtualMachine | null>(null);
  const [installCreds, setInstallCreds] = useState<{ip: string; username: string; password?: string; credential_id?: number}>({ 
      ip: '', username: 'root', password: '' 
  });
  const [isInstalling, setIsInstalling] = useState(false);

  // Edit VM State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editTargetVm, setEditTargetVm] = useState<VirtualMachine | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  
  // Dropdown State
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleOpenEdit = (vm: VirtualMachine) => {
    setEditTargetVm(vm);
    setEditForm({ name: vm.name, description: vm.description || '' });
    setIsEditModalOpen(true);
  };

  const submitEdit = async () => {
    if (!editTargetVm || !editForm.name) return;
    
    setIsSubmittingEdit(true);
    try {
        await virtualizationApi.updateVm(editTargetVm.id, {
            name: editForm.name,
            description: editForm.description
        });
        alert("更新成功");
        setIsEditModalOpen(false);
        fetchVms(); // Refresh list
    } catch(e: any) {
        alert("更新失败: " + (e.response?.data?.detail || "未知错误"));
    } finally {
        setIsSubmittingEdit(false);
    }
  };

  const handleOpenInstall = (vm: VirtualMachine) => {
      setInstallTargetVm(vm);
      setInstallCreds({ 
          ip: vm.ip_address || '', 
          username: 'root', 
          password: '',
          credential_id: undefined
      });
      setIsInstallModalOpen(true);
  };

  const handleSelectCredential = (cred: any) => {
      setInstallCreds(prev => ({
          ...prev,
          username: cred.username,
          password: '', // Clear manual password as we use ID
          credential_id: cred.id
      }));
      setIsCredManagerOpen(false);
  };

  const submitInstall = async () => {
      if (!installTargetVm || !installCreds.ip) {
          alert("请填写 IP");
          return;
      }
      // Check: either password or credential_id
      if (!installCreds.password && !installCreds.credential_id) {
          alert("请填写密码或选择凭证");
          return;
      }

      setIsInstalling(true);
      try {
          await virtualizationApi.installTools(installTargetVm.id, installCreds as any);
          alert("安装任务已提交后台执行，请留意任务中心状态");
          setIsInstallModalOpen(false);
          setIsTaskCenterOpen(true);
      } catch(e: any) {
          alert("提交失败: " + (e.response?.data?.detail || "未知错误"));
      } finally {
          setIsInstalling(false);
      }
  };

  // Debounce effect
  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedKeyword(keyword);
    }, 500);
    return () => clearTimeout(handler);
  }, [keyword]);

  // Fetch Hosts for filter dropdown
  useEffect(() => {
    virtualizationApi.getHosts().then(setHosts).catch(console.error);
  }, []);

  // Update filterHostId when URL params change (e.g. navigation)
  useEffect(() => {
      const hostId = searchParams.get('host_id');
      if (hostId) {
          setFilterHostId(hostId);
      }
  }, [searchParams]);

  const handleOpenClone = (vm: VirtualMachine) => {
    setCloneSourceVm(vm);
    setCloneName(`${vm.name}-clone`);
    setClonePowerOn(true);
    // Reset IP config
    setCloneCustomizeIp(false);
    setCloneIpConfig({
        username: 'root',
        password: '',
        ip: '',
        netmask: '255.255.255.0',
        gateway: '',
        dns: '114.114.114.114',
        nic: 'ens192'
    });
    
    setIsSubmittingClone(false);
    setIsCloneModalOpen(true);
  };

  const submitClone = async () => {
    if (!cloneSourceVm || !cloneNewName) return;
    
    // Simple validation
    if (cloneCustomizeIp) {
        if (!cloneIpConfig.ip || !cloneIpConfig.password) {
            alert("请填写 IP 地址和系统密码");
            return;
        }
    }

    setIsSubmittingClone(true);
    try {
        await virtualizationApi.cloneVm(cloneSourceVm.id, { 
            new_name: cloneNewName,
            power_on: clonePowerOn,
            auto_config_ip: cloneCustomizeIp,
            guest_username: cloneCustomizeIp ? cloneIpConfig.username : undefined,
            guest_password: cloneCustomizeIp ? cloneIpConfig.password : undefined,
            new_ip: cloneCustomizeIp ? cloneIpConfig.ip : undefined,
            netmask: cloneCustomizeIp ? cloneIpConfig.netmask : undefined,
            gateway: cloneCustomizeIp ? cloneIpConfig.gateway : undefined,
            dns: cloneCustomizeIp && cloneIpConfig.dns ? cloneIpConfig.dns.split(/[,; ]+/).filter(Boolean) : undefined,
            nic_name: cloneCustomizeIp ? cloneIpConfig.nic : undefined,
            disconnect_nic_first: cloneCustomizeIp,
            source_ip: cloneSourceVm.ip_address,
        });
        alert("克隆任务已提交后台执行，列表将在接下来的 5 分钟内加快刷新频率。");
        // alert("克隆任务已提交后台执行..."); // 移除 Alert，改为直接打开任务中心
        setIsCloneModalOpen(false);
        setIsTaskCenterOpen(true); // Auto open
        // setFastPollingUntil... (keep or remove, task center handles polling now)
        // We can keep it to refresh VM list automatically
        setFastPollingUntil(Date.now() + 5 * 60 * 1000);
    } catch(e: any) {
        alert("提交失败: " + (e.response?.data?.detail || "未知错误"));
    } finally {
        setIsSubmittingClone(false);
    }
  };



  const handleSync = async () => {
    setIsSyncing(true);
    try {
        await virtualizationApi.syncHosts();
        alert("已触发后台同步，请稍后刷新列表");
        setTimeout(fetchVms, 1000);
    } catch(e) {
        alert("同步请求失败");
    } finally {
        setIsSyncing(false);
    }
  };

  const fetchVms = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await virtualizationApi.getVms({
        keyword: debouncedKeyword,
        host_id: filterHostId !== 'all' ? Number(filterHostId) : undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        page,
        page_size: pageSize
      });
      setVms(res.items);
      setTotal(res.total);
    } catch (error) {
      console.error("Failed to fetch VMs", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [debouncedKeyword, filterHostId, filterStatus, page, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedKeyword, filterHostId, filterStatus, pageSize]);

  useEffect(() => {
    fetchVms();
    
    // Determine interval
    let intervalMs = refreshMinutes * 60 * 1000;
    if (Date.now() < fastPollingUntil) {
        intervalMs = 15000; // 15s
    }

    const interval = setInterval(() => {
        fetchVms();
        // 强制刷新组件以检查 fastPolling 是否过期 (通过 setTick)
        // 或者简单地，每次 fetch 后，react 会重新渲染，useEffect 会重新运行如果依赖变了
        // 但 fastPollingUntil 是常量。
        // 实际上，如果 intervalMs 变了，我们需要重启 timer。
        // 这里依赖 fastPollingUntil 的值变化来触发重置是不够的，因为 Date.now() 是变化的。
        // 简单的做法：在 interval 回调里检查。
    }, intervalMs);
    
    return () => clearInterval(interval);
  }, [fetchVms, refreshMinutes, fastPollingUntil]); // 当 fastPollingUntil 更新时，会重新设定 timer

  // 另外需要一个 timer 来在 fastPolling 结束时触发一次重置 (可选，或者用户手动)
  // 其实只要 fastPollingUntil 设定了，effect 就会用 15s。
  // 5分钟后，虽然 fastPollingUntil 没变，但 Date.now() > 它了。
  // 问题是 useEffect 不会自动重新运行。
  // 所以我们需要一个机制来“退出”快速轮询。
  // 简单起见：每次 fetch 完检查一下？不，setInterval 不会变。
  // 解决方案：在 setInterval 内部判断，或者设置一个 5 分钟后的 timeout 来强制刷新 effect。
  
  useEffect(() => {
      if (fastPollingUntil > 0) {
          const timeout = setTimeout(() => {
              setFastPollingUntil(0); // 触发重置
          }, fastPollingUntil - Date.now());
          return () => clearTimeout(timeout);
      }
  }, [fastPollingUntil]);

  const handleAction = async (vmId: string, action: 'powerOn' | 'shutdown' | 'powerOff' | 'reboot') => {
    const actionName = {
        powerOn: "开机",
        reboot: "重启",
        shutdown: "关机",
        powerOff: "硬关机（断电）",
    }[action];
    
    if(!confirm(`确定要执行 ${actionName} 操作吗?`)) return;
    try {
        const res = await virtualizationApi.performPowerAction(vmId, action);
        alert(res.message || "任务已提交");
        fetchVms();
    } catch(e) {
        alert("操作失败");
    }
  };

  const gridCols = "grid-cols-[32px_200px_80px_80px_110px_180px_110px_140px_140px_180px]";

  const headers = (
    <div className={cn("grid gap-2 px-3 py-2", gridCols)}>
      <div></div>
      <div className="text-xs font-medium text-foreground/80">名称 / 操作系统</div>
      <div className="text-xs font-medium text-foreground/80">状态</div>
      <div className="text-xs font-medium text-foreground/80">Tools 状态</div>
      <div className="text-xs font-medium text-foreground/80">IP 地址</div>
      <div className="text-xs font-medium text-foreground/80">备注</div>
      <div className="text-xs font-medium text-foreground/80">所属宿主机</div>
      <div className="text-xs font-medium text-foreground/80">资源 (配置 / 使用)</div>
      <div className="text-xs font-medium text-foreground/80">存储 (已用 / 置备)</div>
      <div className="text-xs font-medium text-foreground/80 text-right">操作</div>
    </div>
  );

  const resetFilters = () => {
      setKeyword('');
      setFilterHostId('all');
      setFilterStatus('all');
  };

  const hasFilters = keyword || filterHostId !== 'all' || filterStatus !== 'all';

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">虚拟机管理</h1>
            <p className="text-sm text-muted-foreground mt-1">管理所有 ESXi 主机下的虚拟机实例。</p>
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={() => setIsCredManagerOpen(true)}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
                <Key className="mr-2 h-4 w-4" />
                凭证管理
            </button>
            <button
                onClick={() => setIsTaskCenterOpen(!isTaskCenterOpen)}
                className={cn(
                    "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                    isTaskCenterOpen && "bg-accent text-accent-foreground"
                )}
            >
                <ListChecks className="mr-2 h-4 w-4" />
                任务中心
            </button>
            <button
                onClick={handleSync}
                disabled={isSyncing}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 transition-colors"
            >
                <RefreshCw className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} />
                {isSyncing ? "同步中..." : "状态同步"}
            </button>
        </div>
      </div>

      <MonitorToolbar
        showViewSwitch={false}
        refreshMinutes={refreshMinutes}
        onRefreshMinutesChange={setRefreshMinutes}
        onRefresh={fetchVms}
        isRefreshing={isRefreshing}
        filters={
          <div className="flex items-center gap-2">
            {/* Host Filter */}
            <div className="relative">
                <Server className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <select
                className="h-9 w-36 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={filterHostId}
                onChange={(e) => setFilterHostId(e.target.value)}
                >
                <option value="all">所有主机</option>
                {hosts.map(h => (
                    <option key={h.id} value={h.id}>{h.ip}</option>
                ))}
                </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
                <Activity className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <select
                className="h-9 w-32 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                >
                <option value="all">所有状态</option>
                <option value="poweredOn">运行中</option>
                <option value="poweredOff">已停止</option>
                <option value="suspended">已挂起</option>
                </select>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="搜索 VM..."
                className="pl-9 pr-8 h-9 w-48 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setDebouncedKeyword(e.currentTarget.value)} 
              />
              {keyword && (
                  <button 
                    onClick={() => { setKeyword(''); setDebouncedKeyword(''); }}
                    className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                      <X className="h-4 w-4" />
                  </button>
              )}
            </div>

            {/* Reset Button */}
            {hasFilters && (
                <button
                    onClick={resetFilters}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-dashed border-input hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="重置所有筛选"
                >
                    <FilterX className="h-4 w-4" />
                </button>
            )}
          </div>
        }
      />

      <MonitorTableFrame headers={headers} minWidth="min-w-[1000px]">
        {vms.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">暂无虚拟机数据</div>
        ) : (
            vms.map((vm) => {
                // 计算使用率
                const memUsagePercent = vm.memory_usage_mb ? (vm.memory_usage_mb / vm.memory_mb) * 100 : 0;
                // 存储
                const diskUsed = vm.disk_used_gb || 0;
                const diskProv = vm.disk_provisioned_gb || 0;
                const diskPercent = diskProv > 0 ? (diskUsed / diskProv) * 100 : 0;

                return (
                <div key={vm.id} className="group">
                    <div className={cn("grid gap-2 px-3 py-3 text-sm hover:bg-accent/30 transition-colors items-center", gridCols)}>
                        
                        {/* Icon */}
                        <div className="flex items-center justify-center">
                            <Box className="h-4 w-4 text-muted-foreground" />
                        </div>
                        
                        {/* Name */}
                        <div className="min-w-0">
                            <div className="font-medium text-foreground truncate" title={vm.name}>{vm.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate" title={vm.guest_os}>{vm.guest_os || 'Unknown OS'}</div>
                        </div>

                        {/* Status */}
                        <div>
                            <StatusBadge status={vm.power_state} />
                            {vm.power_state === 'poweredOn' && vm.uptime_seconds && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {formatDuration(vm.uptime_seconds)}
                                </div>
                            )}
                        </div>

                        {/* Tools Status */}
                        <div>
                             <ToolsStatusBadge 
                                status={vm.tools_status} 
                                osName={vm.guest_os} 
                                onInstall={() => handleOpenInstall(vm)}
                             />
                        </div>

                        {/* IP */}
                        <div className="font-mono text-muted-foreground text-xs truncate" title={vm.ip_address}>
                            {vm.ip_address || '-'}
                        </div>

                        {/* Description */}
                        <div className="text-muted-foreground text-xs truncate" title={vm.description}>
                            {vm.description || '-'}
                        </div>

                        {/* Host */}
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Server className="h-3.5 w-3.5" />
                            <span className="truncate text-xs" title={vm.host_ip}>{vm.host_ip}</span>
                        </div>

                        {/* Resources (CPU/Mem) */}
                        <div className="pr-2">
                            {/* CPU */}
                            <div className="flex justify-between items-center text-xs mb-1">
                                <div className="flex items-center gap-1">
                                    <Cpu className="h-3 w-3 text-muted-foreground" />
                                    <span>{vm.cpu_count} vCPU</span>
                                </div>
                                {vm.cpu_usage_mhz !== undefined && (
                                    <span className="text-muted-foreground">{vm.cpu_usage_mhz} MHz</span>
                                )}
                            </div>
                            
                            {/* Memory */}
                            <div className="text-xs">
                                <div className="flex justify-between">
                                    <span>{simpleFormatGB(vm.memory_mb)}</span>
                                    {vm.memory_usage_mb != null && (
                                        <span className="text-muted-foreground">{vm.memory_usage_mb.toFixed(0)} MB</span>
                                    )}
                                </div>
                                <MiniProgress percent={memUsagePercent} colorClass={memUsagePercent > 90 ? 'bg-red-500' : 'bg-purple-500'} />
                            </div>
                        </div>

                        {/* Storage */}
                        <div className="pr-2">
                            <div className="text-xs flex justify-between mb-1">
                                <div className="flex items-center gap-1">
                                    <HardDrive className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-medium">{(diskUsed || 0).toFixed(1)} GB</span>
                                </div>
                                <span className="text-muted-foreground">/ {(diskProv || 0).toFixed(1)} GB</span>
                            </div>
                            <MiniProgress percent={diskPercent} colorClass="bg-slate-500" />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 relative">
                            {/* 常驻按钮: Edit */}
                            <button 
                                onClick={() => handleOpenEdit(vm)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                                title="编辑虚拟机"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>

                            {/* 更多操作下拉菜单 */}
                            <div className="relative">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (openMenuId === vm.id) {
                                            setOpenMenuId(null);
                                            setMenuPosition(null);
                                        } else {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            // Align right edge of menu with right edge of button
                                            // Menu width is roughly 192px (w-48)
                                            setMenuPosition({ 
                                                top: rect.bottom + window.scrollY + 4, 
                                                left: rect.right - 192 
                                            });
                                            setOpenMenuId(vm.id);
                                        }
                                    }}
                                    className={cn(
                                        "h-8 w-8 inline-flex items-center justify-center rounded-md border transition-colors",
                                        openMenuId === vm.id 
                                            ? "bg-accent text-accent-foreground border-input" 
                                            : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    )}
                                    title="更多操作"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </button>

                                {openMenuId === vm.id && menuPosition && createPortal(
                                    <div 
                                        ref={menuRef}
                                        className="fixed w-48 rounded-md border bg-popover text-popover-foreground shadow-md z-[9999] animate-in fade-in zoom-in-95 duration-200 p-1"
                                        style={{ top: menuPosition.top, left: menuPosition.left }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1.5">
                                            常用
                                        </div>
                                        <button 
                                            disabled
                                            className="w-full flex items-center px-2 py-1.5 text-sm rounded text-muted-foreground opacity-50 cursor-not-allowed"
                                            title="暂未开放"
                                        >
                                            <Monitor className="mr-2 h-3.5 w-3.5" />
                                            打开控制台
                                        </button>

                                        <div className="my-1 h-px bg-muted" />
                                        <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1.5">
                                            电源操作
                                        </div>
                                        {vm.power_state === 'poweredOff' ? (
                                            <button 
                                                onClick={() => { handleAction(vm.id, 'powerOn'); setOpenMenuId(null); }}
                                                className="w-full flex items-center px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground text-green-600"
                                            >
                                                <Play className="mr-2 h-3.5 w-3.5" />
                                                开机
                                            </button>
                                        ) : (
                                            <>
                                                <button 
                                                    onClick={() => { handleAction(vm.id, 'reboot'); setOpenMenuId(null); }}
                                                    className="w-full flex items-center px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground"
                                                >
                                                    <Repeat className="mr-2 h-3.5 w-3.5" />
                                                    重启
                                                </button>
                                                <button 
                                                    onClick={() => { handleAction(vm.id, 'shutdown'); setOpenMenuId(null); }}
                                                    className="w-full flex items-center px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground"
                                                >
                                                    <Power className="mr-2 h-3.5 w-3.5" />
                                                    软关机
                                                </button>
                                                <button 
                                                    onClick={() => { handleAction(vm.id, 'powerOff'); setOpenMenuId(null); }}
                                                    className="w-full flex items-center px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground text-red-600"
                                                >
                                                    <XCircle className="mr-2 h-3.5 w-3.5" />
                                                    硬关机 (断电)
                                                </button>
                                            </>
                                        )}
                                        
                                        <div className="my-1 h-px bg-muted" />
                                        <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1.5">
                                            维护
                                        </div>

                                        <button 
                                            onClick={() => { handleOpenClone(vm); setOpenMenuId(null); }}
                                            className="w-full flex items-center px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground"
                                        >
                                            <Copy className="mr-2 h-3.5 w-3.5" />
                                            克隆虚拟机...
                                        </button>

                                        {vm.tools_status !== 'toolsOk' && (
                                            <button 
                                                onClick={() => { handleOpenInstall(vm); setOpenMenuId(null); }}
                                                className="w-full flex items-center px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground text-blue-600"
                                            >
                                                <Wrench className="mr-2 h-3.5 w-3.5" />
                                                安装 Tools...
                                            </button>
                                        )}
                                    </div>,
                                    document.body
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                );
            })
        )}
      </MonitorTableFrame>
      
      {/* 分页 */}
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Clone Modal */}
      <Modal
        isOpen={isCloneModalOpen}
        onClose={() => setIsCloneModalOpen(false)}
        title="克隆虚拟机"
        footer={
          <>
            <button
              onClick={() => setIsCloneModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              取消
            </button>
            <button
              onClick={submitClone}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!cloneNewName || cloneSourceVm?.power_state === 'poweredOn' || isSubmittingClone}
            >
              {isSubmittingClone ? (
                <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    提交中...
                </span>
              ) : (
                "开始克隆"
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-100 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>说明：当前仅支持在本 ESXi 主机内部克隆，不支持跨主机迁移。</span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">源虚拟机</label>
            <div className="p-2 bg-muted rounded-md text-sm text-muted-foreground flex justify-between items-center">
                <span>{cloneSourceVm?.name} {cloneSourceVm?.ip_address ? `(${cloneSourceVm.ip_address})` : ''}</span>
                <StatusBadge status={cloneSourceVm?.power_state || ''} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">新虚拟机名称</label>
            <input 
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={cloneNewName}
              onChange={e => setCloneName(e.target.value)}
              placeholder="请输入新名称"
            />
          </div>

          {/* IP Customization Toggle */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
                <input
                type="checkbox"
                id="cloneCustomizeIp"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={cloneCustomizeIp}
                onChange={e => setCloneCustomizeIp(e.target.checked)}
                />
                <label htmlFor="cloneCustomizeIp" className="text-sm font-medium leading-none cursor-pointer">
                自动修改 IP (Guest Customization)
                </label>
            </div>

            {cloneCustomizeIp && (
                <div className="space-y-3 pl-6 border-l-2 border-muted ml-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium">系统账号</label>
                            <input 
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                value={cloneIpConfig.username}
                                onChange={e => setCloneIpConfig({...cloneIpConfig, username: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium">系统密码</label>
                            <input 
                                type="password"
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                value={cloneIpConfig.password}
                                onChange={e => setCloneIpConfig({...cloneIpConfig, password: e.target.value})}
                                placeholder="必填"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium">新 IP 地址</label>
                            <input 
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                value={cloneIpConfig.ip}
                                onChange={e => setCloneIpConfig({...cloneIpConfig, ip: e.target.value})}
                                placeholder="192.168.x.x"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium">子网掩码</label>
                            <input 
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                value={cloneIpConfig.netmask}
                                onChange={e => setCloneIpConfig({...cloneIpConfig, netmask: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium">网关</label>
                            <input 
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                value={cloneIpConfig.gateway}
                                onChange={e => setCloneIpConfig({...cloneIpConfig, gateway: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium">DNS</label>
                            <input 
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                value={cloneIpConfig.dns}
                                onChange={e => setCloneIpConfig({...cloneIpConfig, dns: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium">网卡名称 (Guest)</label>
                        <input 
                            className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                            value={cloneIpConfig.nic}
                            onChange={e => setCloneIpConfig({...cloneIpConfig, nic: e.target.value})}
                            placeholder="eth0, ens192..."
                        />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                        * 需要源虚拟机安装 VMware Tools 且账号密码正确。
                    </div>
                </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <input
              type="checkbox"
              id="clonePowerOn"
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              checked={clonePowerOn}
              onChange={e => setClonePowerOn(e.target.checked)}
            />
            <label htmlFor="clonePowerOn" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              克隆完成后自动开机
            </label>
          </div>
          
          {cloneSourceVm?.power_state === 'poweredOn' ? (
             <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                    <p className="font-medium">无法克隆：源虚拟机正在运行</p>
                    <p className="mt-1">为确保数据一致性，请先关闭源虚拟机后再进行克隆操作。</p>
                </div>
             </div>
          ) : (
             <div className="text-xs text-muted-foreground bg-yellow-50 p-2 rounded text-yellow-800 border border-yellow-100">
                <p>注意：克隆操作将在后台执行，耗时较长（取决于磁盘大小）。</p>
                <p className="mt-1">请确保目标存储空间充足。</p>
             </div>
          )}
        </div>
      </Modal>

      {/* Install Tools Modal */}
      <Modal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        title="一键安装 VMware Tools (SSH)"
        footer={
          <>
            <button
              onClick={() => setIsInstallModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              取消
            </button>
            <button
              onClick={submitInstall}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={isInstalling || !installCreds.ip || (!installCreds.password && !installCreds.credential_id)}
            >
              {isInstalling ? (
                <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    提交中...
                </span>
              ) : (
                "开始安装"
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
            <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded border border-blue-100">
                本功能通过 SSH 连接虚拟机并自动执行 <code>open-vm-tools</code> 安装命令。
                请确保虚拟机 SSH 服务已开启且网络可达。
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium">IP 地址</label>
                <input 
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={installCreds.ip}
                    onChange={e => setInstallCreds({...installCreds, ip: e.target.value})}
                    placeholder="例如 192.168.1.100"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium flex justify-between items-center">
                        SSH 用户名
                        <button 
                            onClick={() => setIsCredManagerOpen(true)}
                            className="text-xs text-primary hover:underline font-normal"
                        >
                            选择保存的凭证
                        </button>
                    </label>
                    <input 
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={installCreds.username}
                        onChange={e => setInstallCreds({...installCreds, username: e.target.value, credential_id: undefined})}
                        placeholder="root"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">SSH 密码</label>
                    {installCreds.credential_id ? (
                        <div className="flex h-9 w-full rounded-md border border-input bg-muted px-3 items-center text-sm text-muted-foreground justify-between">
                            <span className="flex items-center gap-2"><Key className="h-3 w-3" /> 已选用凭证</span>
                            <button 
                                onClick={() => setInstallCreds(prev => ({...prev, credential_id: undefined, password: ''}))}
                                className="text-xs hover:text-foreground p-1"
                                title="清除选择"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ) : (
                        <input 
                            type="password"
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={installCreds.password}
                            onChange={e => setInstallCreds({...installCreds, password: e.target.value})}
                            placeholder="必填"
                        />
                    )}
                </div>
            </div>
        </div>
      </Modal>

      {/* Edit VM Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="编辑虚拟机"
        footer={
          <>
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              取消
            </button>
            <button
              onClick={submitEdit}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              disabled={isSubmittingEdit || !editForm.name}
            >
              {isSubmittingEdit ? (
                <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    保存中...
                </span>
              ) : (
                "保存"
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">名称</label>
                <input 
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={editForm.name}
                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium">备注 (Annotation)</label>
                <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={editForm.description}
                    onChange={e => setEditForm({...editForm, description: e.target.value})}
                    placeholder="输入虚拟机备注..."
                />
            </div>
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                注意：修改名称或备注会实时同步到 ESXi，可能需要几秒钟时间。
            </div>
        </div>
      </Modal>

      <CredentialsManager 
        isOpen={isCredManagerOpen} 
        onClose={() => setIsCredManagerOpen(false)}
        onSelect={isInstallModalOpen ? handleSelectCredential : undefined}
      />

      <TaskCenter 
        isOpen={isTaskCenterOpen} 
        onClose={() => setIsTaskCenterOpen(false)} 
      />
    </div>
  );
};

export default Instances;
