import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { virtualizationApi, EsxiHost } from '@/api/virtualization';
import { 
  Server, 
  Cpu, 
  MemoryStick as Memory, 
  HardDrive, 
  RotateCw,
  MonitorPlay,
  Layers,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useParams } from 'react-router-dom';

// Utility for progress bars
const ProgressBar = ({ value, className, colorClass = "bg-primary" }: { value: number, className?: string, colorClass?: string }) => (
  <div className={cn("h-2 w-full bg-secondary/30 rounded-full overflow-hidden", className)}>
    <div 
      className={cn("h-full transition-all duration-500", colorClass)} 
      style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} 
    />
  </div>
);

const MetricCard = ({ title, value, subtext, icon: Icon, color }: any) => (
  <div className="bg-white dark:bg-slate-900 rounded-lg border p-4 flex items-center space-x-4 shadow-sm">
    <div className={cn("p-3 rounded-full bg-opacity-10", color)}>
      <Icon className={cn("w-6 h-6", color.replace('bg-', 'text-'))} />
    </div>
    <div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <h3 className="text-2xl font-bold">{value}</h3>
      {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
    </div>
  </div>
);

const HostCard = ({ host, onSync }: { host: EsxiHost, onSync: (id: number) => void }) => {
  const { envId } = useParams();
  const isOnline = host.status === 'online';
  
  // Display Name Priority: Description > IP > Hostname
  const displayName = host.description || host.ip || host.hostname;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b flex justify-between items-start bg-slate-50 dark:bg-slate-800/50">
        <div>
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-lg truncate max-w-[200px]" title={displayName}>{displayName}</h3>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-muted-foreground font-mono">{host.hostname || host.ip}</span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider",
              isOnline ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"
            )}>
              {isOnline ? '在线' : host.status === 'offline' ? '离线' : '认证失败'}
            </span>
          </div>
        </div>
        <button 
          onClick={() => onSync(host.id)}
          className="text-slate-400 hover:text-primary transition-colors p-1"
          title="同步主机信息"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>
      
      <div className="p-4 space-y-4 flex-1">
        {/* Resource Usage */}
        <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="flex items-center text-muted-foreground">
                    <Cpu className="w-3 h-3 mr-1" /> CPU
                </span>
                <span className="font-medium">{host.cpu_usage || 0}%</span>
              </div>
              <ProgressBar 
                value={host.cpu_usage || 0} 
                colorClass={host.cpu_usage && host.cpu_usage > 80 ? "bg-red-500" : "bg-blue-500"} 
              />
              <p className="text-[10px] text-right text-muted-foreground mt-0.5">{host.cpu_cores || '-'} 核</p>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="flex items-center text-muted-foreground">
                    <Memory className="w-3 h-3 mr-1" /> 内存
                </span>
                <span className="font-medium">{host.memory_usage || 0}%</span>
              </div>
              <ProgressBar 
                value={host.memory_usage || 0} 
                colorClass={host.memory_usage && host.memory_usage > 80 ? "bg-amber-500" : "bg-purple-500"} 
              />
              <p className="text-[10px] text-right text-muted-foreground mt-0.5">{host.memory_total_gb ? `${host.memory_total_gb} GB` : '-'}</p>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                 <span className="flex items-center text-muted-foreground">
                    <HardDrive className="w-3 h-3 mr-1" /> 存储
                </span>
                {host.storage_total_gb ? (
                   <span className="font-medium">
                     {host.storage_free_gb} GB 可用 / {host.storage_total_gb} GB
                   </span>
                ) : (
                    <span className="font-medium">-</span>
                )}
              </div>
               {/* Storage Bar (Free space inverse) */}
               {host.storage_total_gb && host.storage_free_gb !== undefined && (
                   <ProgressBar 
                     value={((host.storage_total_gb - host.storage_free_gb) / host.storage_total_gb) * 100} 
                     colorClass="bg-slate-500" 
                   />
               )}
            </div>
        </div>

        {/* VM Stats */}
        <div className="pt-2 mt-2 border-t flex justify-between items-center">
             <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">虚拟机</span>
             </div>
             <div className="text-sm">
                 <span className="font-bold text-green-600">{host.vms_running || 0}</span>
                 <span className="text-muted-foreground mx-1">/</span>
                 <span>{host.vm_count || 0}</span>
             </div>
        </div>
      </div>
      
      <div className="bg-slate-50 dark:bg-slate-800/30 p-2 flex justify-end">
          <Link 
            to={`/${envId}/virtualization/instances?host_id=${host.id}`} 
            className="text-xs font-medium text-primary hover:underline px-2"
          >
            查看详情 &rarr;
          </Link>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: hosts = [], isLoading, isError } = useQuery({
    queryKey: ['esxi-hosts'],
    queryFn: virtualizationApi.getHosts,
    refetchInterval: 30000, // Auto refresh every 30s
  });

  const { data: dsStats } = useQuery({
    queryKey: ['esxi-datastores'],
    queryFn: virtualizationApi.getDatastoreStats,
    refetchInterval: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: virtualizationApi.syncHosts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['esxi-hosts'] });
      queryClient.invalidateQueries({ queryKey: ['esxi-datastores'] });
    },
  });

  // Calculate Aggregates
  const totalHosts = hosts.length;
  const onlineHosts = hosts.filter(h => h.status === 'online').length;
  const totalVMs = hosts.reduce((acc, h) => acc + (h.vm_count || 0), 0);
  const runningVMs = hosts.reduce((acc, h) => acc + (h.vms_running || 0), 0);
  const totalCores = hosts.reduce((acc, h) => acc + (h.cpu_cores || 0), 0);
  const totalMem = hosts.reduce((acc, h) => acc + (h.memory_total_gb || 0), 0);
  
  // Format helpers
  const fmtMem = (gb: number) => gb >= 1024 ? `${(gb/1024).toFixed(1)} TB` : `${gb.toFixed(0)} GB`;

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">加载数据中...</div>;
  if (isError) return <div className="p-8 text-center text-red-500 flex flex-col items-center"><AlertCircle className="w-8 h-8 mb-2"/> 无法加载仪表盘数据。</div>;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">资源概览</h1>
          <p className="text-muted-foreground">ESXi 基础设施实时监控</p>
        </div>
        <button 
          onClick={() => syncMutation.mutate(undefined)}
          disabled={syncMutation.isPending}
          className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
           <RotateCw className={cn("w-4 h-4 mr-2", syncMutation.isPending && "animate-spin")} />
           {syncMutation.isPending ? '同步中...' : '全部同步'}
        </button>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard 
          title="宿主机状态" 
          value={`${onlineHosts} / ${totalHosts}`} 
          subtext="在线 / 总数"
          icon={Server}
          color="bg-blue-500 text-blue-600"
        />
        <MetricCard 
          title="虚拟机" 
          value={`${runningVMs} / ${totalVMs}`} 
          subtext="运行中 / 总数"
          icon={MonitorPlay}
          color="bg-green-500 text-green-600"
        />
        <MetricCard 
          title="计算资源池" 
          value={totalCores} 
          subtext="总 vCPU 核心数"
          icon={Cpu}
          color="bg-indigo-500 text-indigo-600"
        />
        <MetricCard 
          title="内存资源池" 
          value={fmtMem(totalMem)} 
          subtext="物理内存总量"
          icon={Memory}
          color="bg-purple-500 text-purple-600"
        />
        <MetricCard 
          title="存储资源池" 
          value={fmtMem(dsStats?.total_capacity_gb || 0)}
          subtext={`${dsStats?.total_count || 0} 个存储池 (可用 ${fmtMem(dsStats?.total_free_gb || 0)})`}
          icon={HardDrive}
          color="bg-orange-500 text-orange-600"
        />
      </div>

      {/* Hosts Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">宿主机列表</h2>
        {hosts.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-slate-50 text-muted-foreground">
            暂无纳管的宿主机。请前往“Esxi主机”页面添加节点。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {hosts.map(host => (
              <HostCard 
                key={host.id} 
                host={host} 
                onSync={(id) => syncMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
