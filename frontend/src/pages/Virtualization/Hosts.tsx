import React, { useEffect, useState } from 'react';
import { virtualizationApi, EsxiHost } from '@/api/virtualization';
import { MonitorTableFrame } from '@/components/monitor/MonitorTableFrame';
import { 
  Server, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Save
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Components ---

const ProgressBar = ({ percent, colorClass = "bg-blue-500" }: { percent: number, colorClass?: string }) => (
  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
    <div 
      className={cn("h-full transition-all duration-500", colorClass)} 
      style={{ width: `${Math.min(percent, 100)}%` }} 
    />
  </div>
);

// --- Simple Modal Component ---
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

const Hosts: React.FC = () => {
  const [hosts, setHosts] = useState<EsxiHost[]>([]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    ip: '',
    port: 443,
    username: 'root',
    password: '',
    description: ''
  });
  
  const [probeStatus, setProbeStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [probeMsg, setProbeMsg] = useState('');
  
  const [syncingHosts, setSyncingHosts] = useState<Record<number, boolean>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const fetchHosts = async () => {
    try {
      const data = await virtualizationApi.getHosts();
      setHosts(data);
    } catch (error) {
      console.error("Failed to fetch hosts", error);
    }
  };

  useEffect(() => {
    fetchHosts();
  }, []);

  const resetForm = () => {
    setFormData({ ip: '', port: 443, username: 'root', password: '', description: '' });
    setProbeStatus('idle');
    setProbeMsg('');
    setIsEditMode(false);
    setEditingId(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (host: EsxiHost) => {
    resetForm();
    setIsEditMode(true);
    setEditingId(host.id);
    setFormData({
      ip: host.ip,
      port: host.port || 443,
      username: host.username || 'root',
      password: '', // Password不回显
      description: host.description || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要移除该主机吗？纳管的虚拟机数据也将被清除。')) return;
    try {
      await virtualizationApi.deleteHost(id);
      fetchHosts();
    } catch (e) {
      alert("删除失败");
    }
  };

  const handleProbe = async () => {
    setProbeStatus('testing');
    setProbeMsg('');
    try {
      const res = await virtualizationApi.addHost({
        ...formData,
        probe_only: true
      });
      // 后端返回的是 Host 对象（probe_only 时 id=0，不含 success 字段）
      setProbeStatus('success');
      setProbeMsg(`连接成功: ${res.version || 'Unknown Version'}`);
    } catch (e: any) {
      setProbeStatus('failed');
      setProbeMsg(e.response?.data?.detail || "连接失败");
    }
  };

  const handleSave = async () => {
    try {
      if (isEditMode && editingId) {
        await virtualizationApi.updateHost(editingId, formData);
      } else {
        await virtualizationApi.addHost({ ...formData, probe_only: false });
      }
      setIsModalOpen(false);
      fetchHosts();
    } catch (e: any) {
      alert(e.response?.data?.detail || "保存失败");
    }
  };

  const handleSyncHost = async (hostId: number) => {
    setSyncingHosts(prev => ({ ...prev, [hostId]: true }));
    try {
        await virtualizationApi.syncHosts(hostId);
        // 稍微延迟一下再刷新列表，等待后端处理
        setTimeout(() => {
            fetchHosts();
            setSyncingHosts(prev => ({ ...prev, [hostId]: false }));
        }, 2000);
    } catch (e) {
        alert("同步失败");
        setSyncingHosts(prev => ({ ...prev, [hostId]: false }));
    }
  };

  const handleHeaderSort = async (field: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === field && sortConfig.direction === 'desc') {
        direction = 'asc';
    }
    setSortConfig({ key: field, direction });

    const newHosts = [...hosts];
    
    newHosts.sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        switch (field) {
            case 'ip':
                valA = a.ip; 
                valB = b.ip;
                break;
            case 'vm_count':
                valA = a.vm_count || 0;
                valB = b.vm_count || 0;
                break;
            case 'cpu':
                valA = a.cpu_usage || 0;
                valB = b.cpu_usage || 0;
                break;
            case 'memory':
                valA = a.memory_usage || 0;
                valB = b.memory_usage || 0;
                break;
            case 'storage_usage':
                const usedA = (a.storage_total_gb || 0) - (a.storage_free_gb || 0);
                const totalA = a.storage_total_gb || 1;
                const usedB = (b.storage_total_gb || 0) - (b.storage_free_gb || 0);
                const totalB = b.storage_total_gb || 1;
                valA = usedA / totalA;
                valB = usedB / totalB;
                break;
            case 'description':
                valA = a.description || '';
                valB = b.description || '';
                break;
            case 'version':
                valA = a.version || '';
                valB = b.version || '';
                break;
            default:
                return 0;
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    setHosts(newHosts);
  };

  const handleSaveOrder = async () => {
    if (!hosts.length) return;
    setIsSavingOrder(true);
    try {
        await virtualizationApi.reorderHosts(hosts.map(h => h.id));
        alert("排序已保存，将同步应用到资源管理页面。");
    } catch (e) {
        alert("保存排序失败");
        console.error(e);
    } finally {
        setIsSavingOrder(false);
    }
  };

  const SortableHeader = ({ label, field, className }: { label: string, field: any, className?: string }) => {
    const isActive = sortConfig?.key === field;
    return (
        <div 
            className={cn("flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors group select-none", className)}
            onClick={() => handleHeaderSort(field)}
        >
            {label}
            {isActive ? (
                sortConfig?.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            ) : (
                <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />
            )}
        </div>
    );
  };

  const gridCols = "grid-cols-[200px_150px_150px_80px_60px_160px_160px_160px_1fr]";

  const headers = (
    <div className={cn("grid gap-2 px-3 py-2 text-xs font-medium text-foreground/80", gridCols)}>
      <SortableHeader label="主机 (IP / Hostname)" field="ip" />
      <SortableHeader label="版本 / 型号" field="version" />
      <SortableHeader label="备注" field="description" />
      <div>状态</div>
      <SortableHeader label="VMs" field="vm_count" />
      <SortableHeader label="CPU (使用率 / 核数)" field="cpu" />
      <SortableHeader label="内存 (使用率 / 总量)" field="memory" />
      <SortableHeader label="存储 (剩余 / 总量)" field="storage_usage" />
      <div className="text-right">操作</div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Esxi主机</h1>
          <p className="text-sm text-muted-foreground mt-1">管理 ESXi 节点连接配置及资源监控。</p>
        </div>
        <div className="flex items-center gap-2">
            {sortConfig && (
                <button
                    onClick={handleSaveOrder}
                    disabled={isSavingOrder}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 transition-colors"
                >
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingOrder ? "保存中..." : "保存排序"}
                </button>
            )}
            <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
            <Plus className="mr-2 h-4 w-4" />
            纳管主机
            </button>
        </div>
      </div>

      <MonitorTableFrame headers={headers} minWidth="min-w-[1350px]">
        {hosts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">暂无纳管主机</div>
        ) : (
          hosts.map(host => {
            // Data Prep
            const cpuUsage = host.cpu_usage || 0;
            const memUsage = host.memory_usage || 0;
            
            // Storage calculation
            const storageTotal = host.storage_total_gb || 0;
            const storageFree = host.storage_free_gb || 0;
            const storageUsed = storageTotal - storageFree;
            const storagePercent = storageTotal > 0 ? (storageUsed / storageTotal) * 100 : 0;
            const isStorageLow = storageTotal > 0 && (storageFree / storageTotal) < 0.1;

            return (
              <div key={host.id} className={cn("grid gap-2 px-3 py-4 text-sm items-center hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0", gridCols)}>
                {/* Host Info */}
                <div>
                  <div className="font-medium flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    {host.ip}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{host.hostname || '-'}</div>
                </div>

                {/* Version */}
                <div className="text-xs text-muted-foreground">
                  <div className="truncate" title={host.version}>{host.version || 'Unknown'}</div>
                </div>

                {/* Description */}
                <div className="text-xs text-muted-foreground truncate" title={host.description}>
                  {host.description || '-'}
                </div>

                {/* Status */}
                <div>
                  {host.status === 'online' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <CheckCircle2 className="h-3 w-3" /> 在线
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                      <XCircle className="h-3 w-3" /> 离线
                    </span>
                  )}
                </div>

                {/* VM Count */}
                <div className="font-mono">{host.vm_count}</div>

                {/* CPU */}
                <div className="pr-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{cpuUsage.toFixed(1)}%</span>
                    <span className="text-muted-foreground">{host.cpu_cores ? `${host.cpu_cores} Cores` : '-'}</span>
                  </div>
                  <ProgressBar percent={cpuUsage} colorClass={cpuUsage > 80 ? "bg-amber-500" : "bg-blue-500"} />
                </div>

                {/* Memory */}
                <div className="pr-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{memUsage.toFixed(1)}%</span>
                    <span className="text-muted-foreground">{host.memory_total_gb ? `${host.memory_total_gb} GB` : '-'}</span>
                  </div>
                  <ProgressBar percent={memUsage} colorClass={memUsage > 80 ? "bg-amber-500" : "bg-purple-500"} />
                </div>

                {/* Storage */}
                <div className="pr-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className={cn("font-medium", isStorageLow && "text-red-600")}>
                      {storageTotal ? `${storageFree.toFixed(0)} GB Free` : '-'}
                    </span>
                    <span className="text-muted-foreground">/ {storageTotal ? `${(storageTotal/1024).toFixed(1)} TB` : '-'}</span>
                  </div>
                  <ProgressBar percent={storagePercent} colorClass={isStorageLow ? "bg-red-500" : "bg-slate-500"} />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                  <button 
                    onClick={() => handleSyncHost(host.id)}
                    className="p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-primary transition-colors"
                    title="立即同步资源与虚拟机"
                    disabled={syncingHosts[host.id]}
                  >
                    <RefreshCw className={cn("h-4 w-4", syncingHosts[host.id] && "animate-spin")} />
                  </button>
                  <button 
                    onClick={() => handleOpenEdit(host)}
                    className="p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    title="编辑"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(host.id)}
                    className="p-2 hover:bg-red-50 rounded-md text-muted-foreground hover:text-red-600 transition-colors"
                    title="移除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </MonitorTableFrame>

      {/* Modal - Same as before */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditMode ? "编辑主机配置" : "纳管新主机"}
        footer={
          <>
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              disabled={probeStatus === 'testing'}
            >
              {isEditMode ? "更新" : "确认添加"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">IP 地址</label>
              <input 
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="192.168.1.10"
                value={formData.ip}
                onChange={e => setFormData({...formData, ip: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">端口 (HTTPS)</label>
              <input 
                type="number"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.port}
                onChange={e => setFormData({...formData, port: Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">用户名</label>
              <input 
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">密码</label>
              <input 
                type="password"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={isEditMode ? "如果不修改请留空" : ""}
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">备注 (可选)</label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="请输入主机用途描述，例如：测试集群节点 A"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          {/* Test Connection Area */}
          <div className="pt-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleProbe}
                disabled={probeStatus === 'testing' || !formData.ip}
                className="text-sm text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                {probeStatus === 'testing' && <Loader2 className="h-3 w-3 animate-spin" />}
                测试连接
              </button>
              
              {probeStatus === 'success' && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {probeMsg}
                </span>
              )}
              {probeStatus === 'failed' && (
                <span className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {probeMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Hosts;
