import apiClient from '@/lib/axios';

// --- Interfaces ---

// 宿主机
export interface EsxiHost {
  id: number;
  ip: string;
  port?: number;
  username?: string;
  hostname: string;
  status: 'online' | 'offline' | 'auth_error';
  version?: string;
  description?: string;
  sort_order?: number;
  cpu_usage?: number; // percentage
  memory_usage?: number; // percentage
  cpu_cores?: number;
  memory_total_gb?: number;
  storage_total_gb?: number;
  storage_free_gb?: number;
  vm_count: number;
  vms_running?: number;
  last_sync?: string;
}

// Host add response（兼容探测返回 success/host_info 与正常 host 对象）
export type AddHostResponse = EsxiHost & {
  success?: boolean;
  message?: string;
  host_info?: any;
};

// 虚拟机
export interface VirtualMachine {
  id: string; // 数据库 ID
  // uuid: string; // API 可能没返回这个，或者叫 instance_uuid
  name: string;
  host_id: number;
  host_ip: string;
  power_state: string; // 'poweredOn' | 'poweredOff' | 'suspended'
  ip_address?: string;
  guest_os?: string;
  cpu_count: number;
  memory_mb: number;
  uptime_seconds?: number;
  
  // 新增运行时指标
  cpu_usage_mhz?: number;
  memory_usage_mb?: number;
  disk_used_gb?: number;
  disk_provisioned_gb?: number;
  
  description?: string; // VM 备注/Annotation
  tools_status?: string;
}

// 电源操作动作
export type VmPowerAction = 'powerOn' | 'shutdown' | 'powerOff' | 'reboot' | 'reset' | 'suspend';

// 异步任务响应
export interface AsyncTaskResponse {
  task_id: string;
  status: string;
  message?: string;
}

// Console 连接信息
export interface VmConsoleInfo {
  type: string;
  url: string;
  ticket?: string;
}

// 分页响应
export interface PageResult<T> {
  total: number;
  items: T[];
}

export interface DatastoreStats {
  total_count: number;
  total_capacity_gb: number;
  total_free_gb: number;
}

// --- API ---

export const virtualizationApi = {
  // Hosts
  getHosts: async () => {
    const response = await apiClient.get<EsxiHost[]>('/virtualization/hosts');
    return response.data;
  },

  getDatastoreStats: async () => {
    const response = await apiClient.get<DatastoreStats>('/virtualization/datastores/stats');
    return response.data;
  },

  addHost: async (data: { ip: string; port?: number; username: string; password?: string; description?: string; probe_only?: boolean }) => {
    const response = await apiClient.post<AddHostResponse>('/virtualization/hosts', data);
    return response.data;
  },

  updateHost: async (id: number, data: { ip?: string; port?: number; username?: string; password?: string; description?: string }) => {
    const response = await apiClient.put<EsxiHost>(`/virtualization/hosts/${id}`, data);
    return response.data;
  },

  deleteHost: async (id: number) => {
    await apiClient.delete(`/virtualization/hosts/${id}`);
  },

  syncHosts: async (hostId?: number) => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/virtualization/sync', {
        host_id: hostId
    });
    return response.data;
  },

  reorderHosts: async (hostIds: number[]) => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/virtualization/hosts/reorder', {
        host_ids: hostIds
    });
    return response.data;
  },

  // VMs
  getVms: async (params: {
    host_id?: number;
    keyword?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }) => {
    const response = await apiClient.get<PageResult<VirtualMachine>>('/virtualization/vms', {
      params,
    });
    return response.data;
  },

  performPowerAction: async (vmId: string, action: VmPowerAction) => {
    const response = await apiClient.post<AsyncTaskResponse>(`/virtualization/vms/${vmId}/power`, {
      action,
    });
    return response.data;
  },

  getConsoleUrl: async (vmId: string) => {
    const response = await apiClient.get<VmConsoleInfo>(`/virtualization/vms/${vmId}/console`);
    return response.data;
  },

  updateVm: async (vmId: string, data: { name?: string; description?: string }) => {
    const response = await apiClient.patch<VirtualMachine>(`/virtualization/vms/${vmId}`, data);
    return response.data;
  },
  
  // Snapshots
  getSnapshots: async (vmId: string) => {
      // TODO: Define Snapshot interface if needed later
      const response = await apiClient.get<any[]>(`/virtualization/vms/${vmId}/snapshots`);
      return response.data;
  },

  createSnapshot: async (vmId: string, data: { name: string; description?: string }) => {
      const response = await apiClient.post<AsyncTaskResponse>(`/virtualization/vms/${vmId}/snapshots`, data);
      return response.data;
  },

  revertSnapshot: async (vmId: string, snapshotId: string) => {
      const response = await apiClient.post<AsyncTaskResponse>(`/virtualization/vms/${vmId}/snapshots/${snapshotId}/revert`);
      return response.data;
  },

  // Clone
  cloneVm: async (vmId: string, data: { 
      new_name: string; 
      target_datastore?: string; 
      power_on?: boolean;
      // IP Customization
      auto_config_ip?: boolean;
      guest_username?: string;
      guest_password?: string;
      new_ip?: string;
      netmask?: string;
      gateway?: string;
      dns?: string[]; // Array of strings
      nic_name?: string;
      disconnect_nic_first?: boolean;
      source_ip?: string; // 用于记录源虚拟机 IP
  }) => {
      const response = await apiClient.post<AsyncTaskResponse>(`/virtualization/vms/${vmId}/clone`, data);
      return response.data;
  },

  installTools: async (vmId: string, data: { ip: string; username?: string; password?: string; credential_id?: number }) => {
      const response = await apiClient.post<AsyncTaskResponse>(`/virtualization/vms/${vmId}/install-tools`, data);
      return response.data;
  }
};
