import apiClient from '@/lib/axios';

export interface Task {
  id: string;
  type: string;
  target_id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  progress: number;
  message: string;
  result?: any;
  created_at: string;
  updated_at: string;
}

export interface TaskListResponse {
  total: number;
  items: Task[];
}

export const taskApi = {
  getTasks: async (params?: { 
    status?: string; 
    type?: string; 
    page?: number; 
    page_size?: number 
  }) => {
    const response = await apiClient.get<TaskListResponse>('/tasks', { params });
    return response.data;
  },

  getTask: async (taskId: string) => {
    const response = await apiClient.get<Task>(`/tasks/${taskId}`);
    return response.data;
  }
};
