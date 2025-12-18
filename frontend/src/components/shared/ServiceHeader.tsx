import React from 'react';
import type { ServicePanoramaItem } from '@/types';

interface ServiceHeaderProps {
  service: ServicePanoramaItem;
  onConfigureAllowedHosts?: (service: ServicePanoramaItem) => void;
}

export const ServiceHeader: React.FC<ServiceHeaderProps> = ({
  service,
  onConfigureAllowedHosts,
}) => {
  return (
    <div className="flex flex-col gap-2 border-b p-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {service.service_type}
        </div>
        <div className="text-xl font-semibold flex items-center gap-2">
          {service.service_name}
          <span className="text-xs text-muted-foreground font-normal">{service.display_name}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {service.description?.trim() || '（服务介绍待完善）'}
        </div>
        {(service.team || service.maintainers || service.port || service.call_level) && (
          <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
            {service.team && <span>责任团队：{service.team}</span>}
            {service.maintainers && <span>维护人：{service.maintainers}</span>}
            {service.port && <span>默认端口：{service.port}</span>}
            {service.call_level && <span>调用层级：{service.call_level}</span>}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 text-xs text-muted-foreground md:items-end md:text-right">
        {service.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {service.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 border rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}
        {onConfigureAllowedHosts && (
          <button
            type="button"
            className="self-start rounded border px-3 py-1 text-xs text-muted-foreground hover:text-foreground md:self-end"
            onClick={() => onConfigureAllowedHosts(service)}
          >
            北极星可信白名单
          </button>
        )}
      </div>
    </div>
  );
};
