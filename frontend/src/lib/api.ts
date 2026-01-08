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
    metadataOptions?: { removeMetadata?: boolean; addMetadata?: boolean },
    folderOptions?: { folderId?: string; organizeByDate?: boolean; assignedBuyerId?: string }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('editor_id', editorId);
    if (tags) formData.append('tags', JSON.stringify(tags));
    if (description) formData.append('description', description);

    // ✨ Metadata options
    if (metadataOptions?.removeMetadata) {
      formData.append('remove_metadata', 'true');
    }
    if (metadataOptions?.addMetadata) {
      formData.append('add_metadata', 'true');
    }

    // ✨ NEW: Folder options
    if (folderOptions?.folderId) {
      formData.append('folder_id', folderOptions.folderId);
    }
    if (folderOptions?.organizeByDate) {
      formData.append('organize_by_date', 'true');
    }
    if (folderOptions?.assignedBuyerId) {
      formData.append('assigned_buyer_id', folderOptions.assignedBuyerId);
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
  rename: (id: string, newFilename: string) =>
    api.patch(`/media/${id}/rename`, { new_filename: newFilename }),
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

  // ✨ NEW: File versioning
  getVersionHistory: (id: string) => api.get(`/media/${id}/versions`),
  createVersion: (id: string, file: File, description?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }
    return api.post(`/media/${id}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  restoreVersion: (id: string, versionId: string) =>
    api.post(`/media/${id}/versions/${versionId}/restore`),
  deleteVersion: (id: string, versionId: string) =>
    api.delete(`/media/${id}/versions/${versionId}`),

  // ✨ NEW: Bulk operations
  bulkDelete: (fileIds: string[]) =>
    api.delete('/media/bulk', { data: { file_ids: fileIds } }),
  bulkMove: (fileIds: string[], targetFolderId: string | null) =>
    api.post('/media/bulk/move', { file_ids: fileIds, target_folder_id: targetFolderId }),

  // ✨ NEW: Trash / Deleted files operations
  getDeletedFiles: () => api.get('/media/deleted'),
  restore: (fileId: string) => api.post(`/media/${fileId}/restore`),
  permanentDelete: (fileId: string) => api.delete(`/media/${fileId}/permanent`),
  emptyTrash: () => api.delete('/media/deleted/empty'),
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

// Activity endpoints (per-file activity)
export const activityApi = {
  getFileActivity: (fileId: string, params?: {
    action_type?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }) => api.get(`/media/${fileId}/activity`, { params }),
};

// Team endpoints
export const teamApi = {
  getAll: () => api.get('/teams'),
  getById: (id: string) => api.get(`/teams/${id}`),
  create: (data: { name: string; description?: string }) => api.post('/teams', data),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch(`/teams/${id}`, data),
  delete: (id: string) => api.delete(`/teams/${id}`),
  getMembers: (id: string) => api.get(`/teams/${id}/members`),
  addMember: (id: string, data: { user_id: string; role?: string }) =>
    api.post(`/teams/${id}/members`, data),
  removeMember: (id: string, userId: string) =>
    api.delete(`/teams/${id}/members/${userId}`),
  updateMemberRole: (id: string, userId: string, role: string) =>
    api.patch(`/teams/${id}/members/${userId}/role`, { role }),
};

// Permission endpoints
export const permissionApi = {
  grant: (data: {
    resource_type: 'file' | 'folder';
    resource_id: string;
    grantee_type: 'user' | 'team';
    grantee_id: string;
    permission_type: 'view' | 'download' | 'edit' | 'delete';
    expires_at?: string;
  }) => api.post('/permissions', data),
  getResourcePermissions: (resourceType: string, resourceId: string) =>
    api.get('/permissions', { params: { resource_type: resourceType, resource_id: resourceId } }),
  revoke: (id: string) => api.delete(`/permissions/${id}`),
  shareFolder: (data: {
    folder_id: string;
    team_id: string;
    permissions: string[];
  }) => api.post('/permissions/share-folder', data),
  getSharedByMe: () => api.get('/permissions/shared-by-me'),
  getSharedWithMe: () => api.get('/permissions/shared-with-me'),
};

// Public Link endpoints
export const publicLinkApi = {
  create: (permissionId: string, options: {
    password?: string;
    expires_at?: string;
    disable_download?: boolean;
    max_views?: number;
  }) => api.post(`/permissions/${permissionId}/public-link`, options),

  update: (linkId: string, options: {
    password?: string;
    expires_at?: string;
    disable_download?: boolean;
    max_views?: number;
  }) => api.patch(`/permissions/public-link/${linkId}`, options),

  revoke: (linkId: string) => api.delete(`/permissions/public-link/${linkId}`),

  getStats: (linkId: string) => api.get(`/permissions/public-link/${linkId}/stats`),

  // Public endpoints (no auth required)
  verifyPassword: (token: string, password?: string) =>
    axios.post(`${API_BASE_URL}/permissions/public/verify`, { token, password }),

  getPublic: (token: string) =>
    axios.get(`${API_BASE_URL}/permissions/public/${token}`),

  downloadPublic: (token: string, password?: string) =>
    axios.get(`${API_BASE_URL}/permissions/public/${token}/download`, {
      params: password ? { password } : undefined,
    }),
};

// ✨ NEW: Folder endpoints
export const folderApi = {
  // Create new folder
  create: (data: {
    name: string;
    parent_folder_id?: string;
    description?: string;
    color?: string;
  }) => api.post('/folders', data),

  // Get folder tree (hierarchical structure)
  getTree: (params?: { parent_id?: string; include_deleted?: boolean }) =>
    api.get('/folders/tree', { params }),

  // Get single folder details
  getOne: (id: string) => api.get(`/folders/${id}`),

  // Get folder contents (subfolders + files)
  getContents: (id: string, params?: {
    page?: number;
    limit?: number;
    file_type?: string;
  }) => api.get(`/folders/${id}/contents`, { params }),

  // Get folder breadcrumb (navigation path)
  getBreadcrumb: (id: string) => api.get(`/folders/${id}/breadcrumb`),

  // Get sibling folders (folders at same level)
  getSiblings: (id: string) => api.get(`/folders/${id}/siblings`),

  // Update folder (rename, change description, color)
  update: (id: string, data: Partial<{
    name: string;
    description: string;
    color: string;
  }>) => api.patch(`/folders/${id}`, data),

  // Rename folder
  rename: (id: string, newName: string) =>
    api.patch(`/folders/${id}/rename`, { new_name: newName }),

  // Delete folder
  delete: (id: string, deleteContents = false) =>
    api.delete(`/folders/${id}?delete_contents=${deleteContents}`),

  // Move files to target folder
  moveFiles: (data: { file_ids: string[]; target_folder_id: string | null }) =>
    api.post('/folders/move-files', data),

  // Copy files to target folder
  copyFiles: (data: { file_ids: string[]; target_folder_id: string | null }) =>
    api.post('/folders/copy-files', data),

  // Create or get date-based folder structure (jan2024/15-jan/)
  createDateFolder: (data?: { date?: string; parent_folder_id?: string }) =>
    api.post('/folders/date-folder', data),

  // Download folder as ZIP
  downloadFolder: (id: string) =>
    api.get(`/folders/${id}/download`, {
      responseType: 'blob',
    }),
};

// Starred endpoints
export const starredApi = {
  // Toggle starred status for a file
  toggleStarred: (fileId: string, isStarred: boolean) =>
    api.put(`/starred/${fileId}`, { is_starred: isStarred }),

  // Get all starred files
  getStarredFiles: () => api.get('/starred'),
};

// Comment endpoints
export const commentApi = {
  // Get comments for a file
  getComments: (fileId: string, includeResolved = true) =>
    api.get('/comments', { params: { file_id: fileId, include_resolved: includeResolved } }),

  // Create a new comment
  createComment: (data: {
    file_id: string;
    content: string;
    parent_comment_id?: string;
  }) => api.post('/comments', data),

  // Update comment
  updateComment: (id: string, content: string) =>
    api.patch(`/comments/${id}`, { content }),

  // Delete comment
  deleteComment: (id: string) => api.delete(`/comments/${id}`),

  // Toggle comment resolution
  toggleResolve: (id: string) => api.post(`/comments/${id}/resolve`),

  // Add reaction to comment
  addReaction: (id: string, reactionType: string) =>
    api.post(`/comments/${id}/reactions`, { reaction_type: reactionType }),

  // Remove reaction from comment
  removeReaction: (id: string, reactionType: string) =>
    api.delete(`/comments/${id}/reactions/${reactionType}`),
};

// Saved Search / Smart Collections endpoints
export const savedSearchApi = {
  create: (data: {
    name: string;
    description?: string;
    filters: any;
    color?: string;
    icon?: string
  }) => api.post('/saved-searches', data),

  getAll: () => api.get('/saved-searches'),

  getOne: (id: string) => api.get(`/saved-searches/${id}`),

  getResults: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/saved-searches/${id}/results`, { params }),

  update: (id: string, data: any) => api.patch(`/saved-searches/${id}`, data),

  delete: (id: string) => api.delete(`/saved-searches/${id}`),

  toggleFavorite: (id: string) => api.post(`/saved-searches/${id}/favorite`),
};

// File Request endpoints
export const fileRequestApi = {
  // Create new file request
  create: (data: {
    title: string;
    description?: string;
    folder_id?: string;
    deadline?: string;
    allow_multiple_uploads?: boolean;
    require_email?: boolean;
    custom_message?: string;
  }) => api.post('/file-requests', data),

  // Get all file requests for current user
  getAll: (params?: { status?: 'active' | 'closed' | 'all' }) =>
    api.get('/file-requests', { params }),

  // Get single file request details
  getOne: (id: string) => api.get(`/file-requests/${id}`),

  // Update file request
  update: (id: string, data: {
    title?: string;
    description?: string;
    deadline?: string;
    allow_multiple_uploads?: boolean;
    require_email?: boolean;
    custom_message?: string;
  }) => api.patch(`/file-requests/${id}`, data),

  // Close file request
  close: (id: string) => api.post(`/file-requests/${id}/close`),

  // Delete file request
  delete: (id: string) => api.delete(`/file-requests/${id}`),

  // Public endpoints (no auth required)
  getPublic: (token: string) =>
    axios.get(`${API_BASE_URL}/file-requests/public/${token}`),

  uploadToRequest: (token: string, file: File, uploaderEmail?: string, uploaderName?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (uploaderEmail) formData.append('uploader_email', uploaderEmail);
    if (uploaderName) formData.append('uploader_name', uploaderName);
    return axios.post(`${API_BASE_URL}/file-requests/public/${token}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;
