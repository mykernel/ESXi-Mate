import apiClient from '@/lib/axios';

export interface Credential {
  id: number;
  name: string;
  username: string;
  description?: string;
  created_at: string;
}

export const credentialsApi = {
  list: async () => {
    const response = await apiClient.get<Credential[]>('/credentials');
    return response.data;
  },

  create: async (data: { name: string; username: string; password: string; description?: string }) => {
    const response = await apiClient.post<Credential>('/credentials', data);
    return response.data;
  },

  delete: async (id: number) => {
    await apiClient.delete(`/credentials/${id}`);
  }
};
