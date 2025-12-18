import React from 'react';
import { RefreshCcw, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonitorToolbarProps {
  viewMode?: 'card' | 'table';
  onViewModeChange?: (mode: 'card' | 'table') => void;
  showViewSwitch?: boolean;
  refreshMinutes: number;
  onRefreshMinutesChange: (minutes: number) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  refreshOptions?: number[];
  filters?: React.ReactNode;
  summary?: React.ReactNode;
}

const defaultRefreshOptions = [5, 10, 30, 60, 120];

export const MonitorToolbar: React.FC<MonitorToolbarProps> = ({
  viewMode = 'table',
  onViewModeChange,
  showViewSwitch = true,
  refreshMinutes,
  onRefreshMinutesChange,
  onRefresh,
  isRefreshing,
  refreshOptions = defaultRefreshOptions,
  filters,
  summary,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left: View Mode */}
        <div className="flex items-center gap-2 shrink-0 min-w-[1px]">
          {showViewSwitch && onViewModeChange && (
            <div className="flex p-1 bg-muted rounded-lg border border-border">
              <button
                onClick={() => onViewModeChange('table')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all',
                  viewMode === 'table'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="列表视图"
              >
                <List className="h-4 w-4" />
                列表
              </button>
              <button
                onClick={() => onViewModeChange('card')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all',
                  viewMode === 'card'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="卡片视图"
              >
                <LayoutGrid className="h-4 w-4" />
                卡片
              </button>
            </div>
          )}
        </div>

        {/* Right: Actions & Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end">
          {/* Filters Slot */}
          {filters}

          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

          {/* Refresh Control */}
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={refreshMinutes}
              onChange={(e) => onRefreshMinutesChange(Number(e.target.value))}
              title="自动刷新间隔"
            >
              {refreshOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}m
                </option>
              ))}
            </select>
            <button
              onClick={onRefresh}
              className="h-9 inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              disabled={isRefreshing}
              title="立即刷新"
            >
              <RefreshCcw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
              <span className="hidden sm:inline">{isRefreshing ? '刷新中' : '刷新'}</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Summary Row */}
      {summary && (
        <div className="text-sm text-muted-foreground flex justify-end border-t border-border/50 pt-2">
          {summary}
        </div>
      )}
    </div>
  );
};
