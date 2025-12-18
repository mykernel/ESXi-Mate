import React, { useEffect, useState } from 'react';
import { taskApi, Task } from '@/api/tasks';
import { Loader2, CheckCircle2, XCircle, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskCenterProps {
  isOpen: boolean;
  onClose: () => void;
  autoRefresh?: boolean;
}

export const TaskCenter: React.FC<TaskCenterProps> = ({ isOpen, onClose, autoRefresh = true }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchTasks = async (reset = false) => {
    try {
      const currentPage = reset ? 1 : page;
      // Default to 5 items per page
      const res = await taskApi.getTasks({ page: currentPage, page_size: 5 });
      
      if (reset) {
        setTasks(res.items);
        setPage(1);
      } else {
        setTasks(prev => [...prev, ...res.items]);
      }
      
      // Check if more
      setHasMore(res.total > (reset ? 0 : tasks.length) + res.items.length);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLoadMore = () => {
      setPage(p => p + 1);
  };

  // 当 page 变化时加载
  useEffect(() => {
      if (page > 1) {
          setLoading(true);
          fetchTasks(false).finally(() => setLoading(false));
      }
  }, [page]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      // Reset and fetch
      fetchTasks(true).finally(() => setLoading(false));
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && autoRefresh && page === 1) { // Only auto-refresh first page
      // Check if any task is running
      const hasRunning = tasks.some(t => t.status === 'running' || t.status === 'pending');
      if (hasRunning) {
        const interval = setInterval(() => fetchTasks(true), 3000);
        return () => clearInterval(interval);
      }
    }
  }, [isOpen, autoRefresh, tasks, page]); 

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pointer-events-none">
      <div className="bg-background rounded-lg shadow-xl w-96 border border-border pointer-events-auto max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center px-4 py-3 border-b border-border bg-muted/10">
          <h3 className="font-semibold text-sm">任务中心</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          {loading && tasks.length === 0 ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-4">暂无任务记录</div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="border rounded-md p-3 text-sm space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{task.type === 'clone_vm' ? '克隆虚拟机' : task.type}</div>
                    <div className="text-xs text-muted-foreground mt-0.5" title={task.target_id}>
                        {task.result?.source && task.result?.target ? (
                            <span className="font-mono text-primary">{task.result.source} <span className="text-muted-foreground">→</span> {task.result.target}</span>
                        ) : (
                            task.target_id.split('-')[0] + '...'
                        )}
                    </div>
                  </div>
                  <StatusIcon status={task.status} />
                </div>
                
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{task.message || '处理中...'}</span>
                        <span>{task.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                            className={cn(
                                "h-full transition-all duration-500", 
                                task.status === 'failed' ? "bg-red-500" : 
                                task.status === 'success' ? "bg-emerald-500" : "bg-blue-500"
                            )} 
                            style={{ width: `${task.progress}%` }} 
                        />
                    </div>
                </div>
                
                <div className="text-[10px] text-muted-foreground text-right">
                    {new Date(task.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
          
          {hasMore && !loading && (
            <button 
                onClick={handleLoadMore}
                className="w-full text-xs text-center py-2 text-primary hover:bg-muted/50 rounded-md transition-colors"
            >
                加载更多...
            </button>
          )}
          {loading && page > 1 && (
             <div className="text-center py-2">
                <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
        case 'success': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
        case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
        case 'running': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
        default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
};
