import React from 'react';
import { cn } from '@/lib/utils';

interface MonitorTableFrameProps {
  headers: React.ReactNode;
  children: React.ReactNode;
  minWidth?: string;
  className?: string;
}

export const MonitorTableFrame: React.FC<MonitorTableFrameProps> = ({
  headers,
  children,
  minWidth = 'min-w-[1000px]',
  className,
}) => {
  return (
    <div className={cn("rounded-md border border-border bg-card shadow-sm overflow-hidden", className)}>
      <div className="overflow-x-auto">
        {/* Header */}
        <div className={cn("bg-muted/30 border-b border-border min-w-full", minWidth)}>
          {headers}
        </div>

        {/* Body */}
        <div className={cn("divide-y divide-border/50 min-w-full bg-card", minWidth)}>
          {children}
        </div>
      </div>
    </div>
  );
};
