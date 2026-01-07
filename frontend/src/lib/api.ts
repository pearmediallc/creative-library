import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authApi = {
  register: (data: { name: string; email: string; password: string; role?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// Editor endpoints
export const editorApi = {
  getAll: (includeStats = false) =>
    api.get(`/editors${includeStats ? '?includeStats=true' : ''}`),
  getOne: (id: string) => api.get(`/editors/${id}`),
  create: (data: { name: string; display_name?: string }) =>
    api.post('/editors', data),
  update: (id: string, data: Partial<{ name: string; display_name: string; is_active: boolean }>) =>
    api.patch(`/editors/${id}`, data),
  delete: (id: string) => api.delete(`/editors/${id}`),
};

// Media endpoints
export const mediaApi = {
  upload: (
    file: File,
    editorId: string,
    tags?: string[],
    description?: string,
    metadataOptions?: { removeMetadata?: boolean; addMetadata?: boolean }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('editor_id', editorId);
    if (tags) formData.append('tags', JSON.stringify(tags));
    if (description) formData.append('description', description);

    // ✨ NEW: Add metadata options
    if (metadataOptions?.removeMetadata) {
      formData.append('remove_metadata', 'true');
    }
    if (metadataOptions?.addMetadata) {
      formData.append('add_metadata', 'true');
    }

    return api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getAll: (params?: {
    editor_id?: string;
    media_type?: string;
    tags?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/media', { params }),
  getOne: (id: string) => api.get(`/media/${id}`),
  update: (id: string, data: { editor_id?: string; tags?: string[]; description?: string }) =>
    api.patch(`/media/${id}`, data),
  delete: (id: string) => api.delete(`/media/${id}`),
  getStats: () => api.get('/media/stats'),

  // ✨ NEW: Bulk metadata operations
  bulkMetadata: (data: {
    file_ids: string[];
    operation: 'add' | 'remove' | 'remove_and_add';
    metadata?: any;
  }) => api.post('/media/bulk/metadata', data),

  getBulkStatus: (jobId: string) => api.get(`/media/bulk/status/${jobId}`),

  cancelBulkOperation: (jobId: string) => api.post(`/media/bulk/cancel/${jobId}`),

  // Metadata extraction and viewing
  extractMetadata: (id: string) => api.get(`/media/${id}/metadata`),

  // Bulk ZIP download
  bulkDownloadZip: (fileIds: string[]) =>
    api.post('/media/bulk/download-zip', { file_ids: fileIds }, {
      responseType: 'blob',
    }),
};

// Facebook endpoints
export const facebookApi = {
  connect: (data: { accessToken: string; adAccountId?: string; adAccountName?: string }) =>
    api.post('/facebook/connect', data),
  getAdAccounts: () => api.get('/facebook/ad-accounts'),
  updateAdAccount: (data: { adAccountId: string; adAccountName: string }) =>
    api.put('/facebook/ad-account', data),
  getStatus: () => api.get('/facebook/status'),
  disconnect: () => api.delete('/facebook/disconnect'),
};

// Analytics endpoints
export const analyticsApi = {
  sync: (adAccountId: string, dateFrom?: string, dateTo?: string) =>
    api.post('/analytics/sync', {
      ad_account_id: adAccountId,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined
    }),
  stopSync: () => api.post('/analytics/sync/stop'),
  getEditorPerformance: (params?: {
    editor_id?: string;
    date_from?: string;
    date_to?: string;
  }) => api.get('/analytics/editor-performance', { params }),
  getAdsWithoutEditor: () => api.get('/analytics/ads-without-editor'),
  getAdNameChanges: (params?: { editor_changed?: boolean; date_from?: string }) =>
    api.get('/analytics/ad-name-changes', { params }),
  getUnified: (adAccountId: string, dateFrom?: string, dateTo?: string, bulkFetch?: boolean) =>
    api.get('/analytics/unified', {
      params: {
        ad_account_id: adAccountId,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        bulk_fetch: bulkFetch !== undefined ? bulkFetch : undefined
      }
    }),
};

// Admin endpoints
export const adminApi = {
  getUsers: () => api.get('/admin/users'),
  createUser: (data: {
    name: string;
    email: string;
    password: string;
    role: string;
    upload_limit_monthly?: number;
  }) => api.post('/admin/users', data),
  updateUser: (id: string, data: Partial<{
    name: string;
    role: string;
    upload_limit_monthly: number;
    is_active: boolean;
  }>) => api.patch(`/admin/users/${id}`, data),
  getStats: () => api.get('/admin/stats'),

  // Approval workflow
  getPendingUsers: () => api.get('/admin/pending-users'),
  approveUser: (id: string) => api.post(`/admin/approve-user/${id}`),
  rejectUser: (id: string, data: { reason?: string }) =>
    api.post(`/admin/reject-user/${id}`, data),

  // Password management
  resetUserPassword: (id: string, data: { admin_password: string; new_password: string }) =>
    api.post(`/admin/users/${id}/reset-password`, data),

  // Email whitelist
  getAllowedEmails: (params?: { limit?: number; offset?: number }) =>
    api.get('/admin/allowed-emails', { params }),
  addAllowedEmail: (data: { email: string; department?: string; job_title?: string; notes?: string }) =>
    api.post('/admin/allowed-emails', data),
  bulkImportEmails: (data: { emails: Array<{ email: string; department?: string; job_title?: string; notes?: string }> }) =>
    api.post('/admin/allowed-emails/bulk-import', data),
  removeAllowedEmail: (id: string) => api.delete(`/admin/allowed-emails/${id}`),
};

// Activity Logs endpoints (Admin only)
export const activityLogApi = {
  getLogs: (params?: {
    user_id?: string;
    user_email?: string;
    action_type?: string;
    resource_type?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/activity-logs', { params }),
  getFilters: () => api.get('/activity-logs/filters'),
};

export default api;
