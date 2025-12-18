import React from 'react';

interface MonitorPageLayoutProps {
  title: string;
  description?: string;
  stats?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

export const MonitorPageLayout: React.FC<MonitorPageLayoutProps> = ({
  title,
  description,
  stats,
  toolbar,
  children,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {stats}
        </div>
      )}

      {/* Toolbar */}
      {toolbar}

      {/* Content */}
      <div className="min-h-[500px]">
        {children}
      </div>
    </div>
  );
};
