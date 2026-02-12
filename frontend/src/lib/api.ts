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
  getBuyers: () => api.get('/auth/buyers'),
  getUsers: () => api.get('/auth/users'), // For sharing - accessible by all authenticated users
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
  bulkCopy: (fileIds: string[], targetFolderId: string | null) =>
    api.post('/media/bulk/copy', { file_ids: fileIds, target_folder_id: targetFolderId }),

  // ✨ NEW: Individual file move/copy operations
  moveFile: (fileId: string, targetFolderId: string | null) =>
    api.post(`/media/${fileId}/move`, { target_folder_id: targetFolderId }),
  copyFile: (fileId: string, targetFolderId: string | null) =>
    api.post(`/media/${fileId}/copy`, { target_folder_id: targetFolderId }),

  // ✨ NEW: Trash / Deleted files operations
  getDeletedFiles: () => api.get('/media/deleted'),
  restore: (fileId: string) => api.post(`/media/${fileId}/restore`),
  permanentDelete: (fileId: string) => api.delete(`/media/${fileId}/permanent`),
  emptyTrash: () => api.delete('/media/deleted/empty'),

  // ✨ NEW: Add file request upload to media library
  addFileRequestUploadToLibrary: (fileId: string) =>
    api.post(`/media/add-from-file-request/${fileId}`),
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

// Team endpoints - Phase 8 Teams Feature (comprehensive)
// Note: This replaces the previous simple teamApi with full Phase 8 functionality

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
    team_id?: string;
    ownership_type?: 'user' | 'team';
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

  // Toggle folder lock
  toggleLock: (id: string, reason?: string) =>
    api.post(`/folders/${id}/toggle-lock`, { reason }),

  // Get folder lock status
  getLockStatus: (id: string) =>
    api.get(`/folders/${id}/lock-status`),

  // Folder access management
  grantAccess: (folderId: string, data: {
    userId: string;
    permissionType: 'view' | 'edit' | 'delete';
    expiresAt?: string;
  }) => api.post(`/folders/${folderId}/grant-access`, data),

  getPermissions: (folderId: string) =>
    api.get(`/folders/${folderId}/permissions`),

  revokeAccess: (folderId: string, permissionId: string) =>
    api.delete(`/folders/${folderId}/permissions/${permissionId}`),

  searchUsers: (query: string) =>
    api.get(`/folders/search-users`, { params: { q: query } }),
};

// File Request Comments endpoints
export const requestCommentsApi = {
  getComments: (requestId: string) =>
    api.get(`/file-requests/${requestId}/comments`),

  addComment: (requestId: string, comment: string) =>
    api.post(`/file-requests/${requestId}/comments`, { comment }),

  updateComment: (commentId: string, comment: string) =>
    api.put(`/file-requests/comments/${commentId}`, { comment }),

  deleteComment: (commentId: string) =>
    api.delete(`/file-requests/comments/${commentId}`),

  getCommentCount: (requestId: string) =>
    api.get(`/file-requests/${requestId}/comments/count`),
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

// Metadata endpoints
export const metadataApi = {
  // Add metadata to file (embed creator info)
  addMetadata: (
    file: File,
    creatorId: string,
    options?: {
      description?: string;
      title?: string;
      keywords?: string;
      custom_fields?: Record<string, any>;
    }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('creator_id', creatorId);
    if (options?.description) formData.append('description', options.description);
    if (options?.title) formData.append('title', options.title);
    if (options?.keywords) formData.append('keywords', options.keywords);
    if (options?.custom_fields) formData.append('custom_fields', JSON.stringify(options.custom_fields));

    return api.post('/metadata/add', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Remove metadata from file (strip EXIF/GPS)
  removeMetadata: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/metadata/remove', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Extract metadata from file (read-only)
  extractMetadata: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/metadata/extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// File Request endpoints
export const fileRequestApi = {
  // Create new file request
  create: (data: {
    title?: string;
    request_type?: string;
    description?: string;
    concept_notes?: string;
    num_creatives?: number;
    platform?: string;
    vertical?: string;
    folder_id?: string;
    deadline?: string;
    allow_multiple_uploads?: boolean;
    require_email?: boolean;
    custom_message?: string;
    editor_id?: string;
    editor_ids?: string[];
    assigned_buyer_id?: string;
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

  // Status transition methods
  markAsUploaded: (id: string) => api.post(`/file-requests/${id}/mark-uploaded`),
  launch: (id: string) => api.post(`/file-requests/${id}/launch`),
  closeRequest: (id: string) => api.post(`/file-requests/${id}/close`),
  reopenRequest: (id: string) => api.post(`/file-requests/${id}/reopen`),

  // Backward compatibility (deprecated)
  close: (id: string) => api.post(`/file-requests/${id}/close`),

  // Delete file request
  delete: (id: string) => api.delete(`/file-requests/${id}`),

  // Public endpoints (no auth required)
  getPublic: (token: string) =>
    axios.get(`${API_BASE_URL}/file-requests/public/${token}`),

  uploadToRequest: (token: string, file: File, uploaderEmail?: string, uploaderName?: string, editorId?: string, comments?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (uploaderEmail) formData.append('uploader_email', uploaderEmail);
    if (uploaderName) formData.append('uploader_name', uploaderName);
    if (editorId) formData.append('editor_id', editorId);
    if (comments) formData.append('comments', comments);
    return axios.post(`${API_BASE_URL}/file-requests/public/${token}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Assign multiple editors to file request
  assignEditors: (id: string, editor_ids: string[]) =>
    api.post(`/file-requests/${id}/assign-editors`, { editor_ids }),

  // Create folder for file request
  createFolder: (id: string, data: { folder_name: string; description?: string }) =>
    api.post(`/file-requests/${id}/folders`, data),

  // Get folders for file request
  getFolders: (id: string) => api.get(`/file-requests/${id}/folders`),

  // Get assigned editors for file request
  getAssignedEditors: (id: string) => api.get(`/file-requests/${id}/editors`),

  // Complete file request
  complete: (id: string, data?: { delivery_note?: string }) =>
    api.post(`/file-requests/${id}/complete`, data),

  // Reassign file request to another editor
  reassign: (id: string, data: { reassign_to: string; note?: string }) =>
    api.post(`/file-requests/${id}/reassign`, data),

  // Get reassignment history
  getReassignments: (id: string) => api.get(`/file-requests/${id}/reassignments`),

  // Get upload history for file request
  getUploadHistory: (id: string) => api.get(`/file-requests/${id}/upload-history`),

  // Soft-remove an upload session (tracks deletions/removals)
  deleteUploadSession: (requestId: string, uploadId: string) =>
    api.delete(`/file-requests/${requestId}/uploads/${uploadId}`),

  // Authenticated upload to file request (for editors)
  uploadToRequestAuth: (id: string, file: File, comments?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (comments) formData.append('comments', comments);
    return api.post(`/file-requests/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Canvas/Product Brief endpoints
  canvas: {
    // Get canvas for file request
    get: (requestId: string) =>
      api.get(`/file-requests/${requestId}/canvas`),

    // Create or update canvas
    upsert: (requestId: string, content: any) =>
      api.post(`/file-requests/${requestId}/canvas`, { content }),

    // Upload attachment to canvas
    uploadAttachment: (requestId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/file-requests/${requestId}/canvas/attach`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },

    // Remove attachment from canvas
    removeAttachment: (requestId: string, fileId: string) =>
      api.delete(`/file-requests/${requestId}/canvas/attachments/${fileId}`),

    // Delete canvas
    delete: (requestId: string) =>
      api.delete(`/file-requests/${requestId}/canvas`),
  },
};

// Slack Integration endpoints
export const slackApi = {
  // Initiate OAuth flow
  initiateOAuth: () => api.get('/slack/oauth/initiate'),

  // Get connection status
  getStatus: () => api.get('/slack/status'),

  // Disconnect Slack
  disconnect: () => api.post('/slack/disconnect'),

  // Get notification preferences
  getPreferences: () => api.get('/slack/preferences'),

  // Update notification preferences
  updatePreferences: (data: { enabled?: boolean; preferences?: Record<string, boolean> }) =>
    api.put('/slack/preferences', data),

  // Get all Slack-connected users
  getConnectedUsers: () => api.get('/slack/connected-users'),

  // Send manual notification to selected users
  sendManualNotification: (data: {
    userIds: string[];
    fileName: string;
    fileUrl?: string;
    message?: string;
  }) => api.post('/slack/notify', data),

  // Send test notification
  sendTest: () => api.post('/slack/test'),
};

// Activity Log Export endpoints (admin only)
export const activityLogExportApi = {
  // Get export history
  getHistory: () => api.get('/activity-logs/exports'),

  // Get specific export
  getExport: (exportId: string) => api.get(`/activity-logs/exports/${exportId}`),

  // Get download URL for export
  getDownloadUrl: (exportId: string) => api.get(`/activity-logs/exports/${exportId}/download`),

  // Trigger manual export
  manualExport: (targetDate: string) =>
    api.post('/activity-logs/exports/manual', { targetDate }),

  // Get export job status
  getJobStatus: () => api.get('/activity-logs/exports/job/status'),

  // Request new export
  requestExport: (data: { start_date: string; end_date: string }) =>
    api.post('/activity-logs/exports/request', data),
};

// Enhanced Analytics endpoints
export const analyticsApi = {
  // Sync Facebook ads
  syncAds: (data: { ad_account_id: string; date_from?: string; date_to?: string }) =>
    api.post('/analytics/sync', data),

  // Stop ongoing sync
  stopSync: () => api.post('/analytics/sync/stop'),

  // Get editor performance with filtering
  getEditorPerformance: (params?: {
    editor_id?: string;
    date_from?: string;
    date_to?: string;
    media_type?: 'image' | 'video';
  }) => api.get('/analytics/editor-performance', { params }),

  // Get editor media uploads with filtering
  getEditorMedia: (params?: {
    editor_id?: string;
    date_from?: string;
    date_to?: string;
    media_type?: 'image' | 'video';
  }) => api.get('/analytics/editor-media', { params }),

  // Get ads without editor
  getAdsWithoutEditor: () => api.get('/analytics/ads-without-editor'),

  // Get ad name changes
  getAdNameChanges: (params?: { editor_changed?: boolean; date_from?: string }) =>
    api.get('/analytics/ad-name-changes', { params }),

  // Get unified analytics
  getUnifiedAnalytics: (params: {
    ad_account_id: string;
    date_from?: string;
    date_to?: string;
    bulk_fetch?: boolean;
  }) => api.get('/analytics/unified', { params }),
};

// Metadata Tags endpoints
export const metadataTagApi = {
  // Get all tags with usage counts
  getAll: (params?: { category?: string; search?: string }) =>
    api.get('/metadata-tags', { params }),

  // Get tag by ID
  getById: (id: string) => api.get(`/metadata-tags/${id}`),

  // Create new tag
  create: (data: { name: string; category?: string; description?: string }) =>
    api.post('/metadata-tags', data),

  // Update tag
  update: (id: string, data: { name?: string; category?: string; description?: string }) =>
    api.patch(`/metadata-tags/${id}`, data),

  // Delete tag
  delete: (id: string) => api.delete(`/metadata-tags/${id}`),

  // Get all unique categories
  getCategories: () => api.get('/metadata-tags/categories'),

  // Get files with a specific tag
  getFilesWithTag: (id: string) => api.get(`/metadata-tags/${id}/files`),

  // Add tag to media file
  addTagToFile: (mediaId: string, tagId: string) =>
    api.post(`/media/${mediaId}/tags`, { tag_id: tagId }),

  // Remove tag from media file
  removeTagFromFile: (mediaId: string, tagId: string) =>
    api.delete(`/media/${mediaId}/tags/${tagId}`),

  // Get tags for a specific media file
  getFileTags: (mediaId: string) => api.get(`/media/${mediaId}/tags`),

  // Bulk add tags to file
  bulkAddTagsToFile: (mediaId: string, tagIds: string[]) =>
    api.post(`/media/${mediaId}/tags/bulk`, { tag_ids: tagIds }),
};

// Workload Management endpoints
export const workloadApi = {
  // Get workload overview for all editors
  getOverview: () => api.get('/workload/overview'),

  // Get detailed workload for a specific editor
  getEditorWorkload: (editorId: string) => api.get(`/workload/editor/${editorId}`),

  // Update editor capacity settings
  updateCapacity: (editorId: string, data: {
    maxConcurrentRequests?: number;
    maxHoursPerWeek?: number;
    isAvailable?: boolean;
    unavailableUntil?: string;
    unavailableReason?: string;
  }) => api.put(`/workload/capacity/${editorId}`, data),

  // Update file request time estimate
  updateEstimate: (requestId: string, data: {
    estimatedHours?: number;
    complexity?: string;
    priority?: number;
  }) => api.put(`/workload/request/${requestId}/estimate`, data),

  // Get workload analytics
  getAnalytics: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/workload/analytics', { params }),

  // Get workload recommendations
  getRecommendations: (requestId?: string) =>
    api.get('/workload/recommendations', { params: requestId ? { requestId } : {} }),
};

// Team endpoints
export const teamApi = {
  // Team management
  createTeam: (data: { name: string; description?: string }) =>
    api.post('/teams', data),
  create: (data: { name: string; description?: string }) =>
    api.post('/teams', data),
  getUserTeams: () =>
    api.get('/teams'),
  getAll: () =>
    api.get('/teams'),
  getTeam: (teamId: string) =>
    api.get(`/teams/${teamId}`),
  getById: (teamId: string) =>
    api.get(`/teams/${teamId}`),
  updateTeam: (teamId: string, data: { name?: string; description?: string }) =>
    api.put(`/teams/${teamId}`, data),
  deleteTeam: (teamId: string) =>
    api.delete(`/teams/${teamId}`),
  delete: (teamId: string) =>
    api.delete(`/teams/${teamId}`),

  // Team members
  getAvailableUsers: (teamId: string, params?: { search?: string }) =>
    api.get(`/teams/${teamId}/available-users`, { params }),
  addMember: (teamId: string, data: { userId: string; teamRole: 'lead' | 'member' | 'guest' }) =>
    api.post(`/teams/${teamId}/members`, data),
  removeMember: (teamId: string, userId: string) =>
    api.delete(`/teams/${teamId}/members/${userId}`),
  updateMemberRole: (teamId: string, userId: string, data: { teamRole: 'lead' | 'member' | 'guest' }) =>
    api.put(`/teams/${teamId}/members/${userId}/role`, data),

  // Team folders
  getTeamFolders: (teamId: string) =>
    api.get(`/teams/${teamId}/folders`),

  // Team activity
  getActivity: (teamId: string, params?: { type?: string; userId?: string; limit?: number; offset?: number }) =>
    api.get(`/teams/${teamId}/activity`, { params }),
  logActivity: (teamId: string, data: { activityType: string; resourceType?: string; resourceId?: string; metadata?: any }) =>
    api.post(`/teams/${teamId}/activity`, data),

  // Request templates
  createTemplate: (teamId: string, data: {
    name: string;
    description?: string;
    defaultTitle?: string;
    defaultRequestType?: string;
    defaultInstructions?: string;
    defaultPriority?: 'low' | 'normal' | 'high' | 'urgent';
    defaultDueDays?: number;
    defaultPlatform?: string;
    defaultVertical?: string;
    defaultNumCreatives?: number;
    defaultAllowMultipleUploads?: boolean;
    defaultRequireEmail?: boolean;
    defaultCustomMessage?: string;
    requiredFields?: any[];
  }) =>
    api.post(`/teams/${teamId}/templates`, data),
  getTemplates: (teamId: string, params?: { active?: boolean }) =>
    api.get(`/teams/${teamId}/templates`, { params }),
  getTemplate: (templateId: string) =>
    api.get(`/teams/templates/${templateId}`),
  updateTemplate: (templateId: string, data: any) =>
    api.put(`/teams/templates/${templateId}`, data),
  deleteTemplate: (templateId: string) =>
    api.delete(`/teams/templates/${templateId}`),
  useTemplate: (templateId: string, overrides?: any) =>
    api.post(`/teams/templates/${templateId}/use`, overrides),

  // Team analytics
  getAnalyticsSummary: (teamId: string) =>
    api.get(`/teams/${teamId}/analytics/summary`),
  getAnalyticsTrends: (teamId: string, params?: { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' }) =>
    api.get(`/teams/${teamId}/analytics/trends`, { params }),
  getMemberAnalytics: (teamId: string) =>
    api.get(`/teams/${teamId}/analytics/members`),
  getRequestAnalytics: (teamId: string) =>
    api.get(`/teams/${teamId}/analytics/requests`),

  // Team messages/discussion
  getMessages: (teamId: string, params?: { limit?: number; offset?: number; parent_id?: string }) =>
    api.get(`/teams/${teamId}/messages`, { params }),
  postMessage: (teamId: string, data: { message_text: string; parent_message_id?: string; mentions?: string[]; attachments?: any[] }) =>
    api.post(`/teams/${teamId}/messages`, data),
  editMessage: (teamId: string, messageId: string, data: { message_text: string }) =>
    api.put(`/teams/${teamId}/messages/${messageId}`, data),
  deleteMessage: (teamId: string, messageId: string) =>
    api.delete(`/teams/${teamId}/messages/${messageId}`),
  markMessageAsRead: (teamId: string, messageId: string) =>
    api.post(`/teams/${teamId}/messages/${messageId}/read`),
  getUnreadCount: (teamId: string) =>
    api.get(`/teams/${teamId}/messages/unread-count`),

  // Smart Collections
  createCollection: (data: { name: string; description?: string; teamId?: string; collectionType?: 'manual' | 'smart'; smartRules?: any[]; isPublic?: boolean }) =>
    api.post('/teams/collections', data),
  getCollections: (params?: { teamId?: string; collectionType?: string }) =>
    api.get('/teams/collections', { params }),
  getCollection: (collectionId: string) =>
    api.get(`/teams/collections/${collectionId}`),
  updateCollection: (collectionId: string, data: any) =>
    api.put(`/teams/collections/${collectionId}`, data),
  deleteCollection: (collectionId: string) =>
    api.delete(`/teams/collections/${collectionId}`),
  addItemToCollection: (collectionId: string, data: { fileRequestUploadId: string }) =>
    api.post(`/teams/collections/${collectionId}/items`, data),
  removeItemFromCollection: (collectionId: string, itemId: string) =>
    api.delete(`/teams/collections/${collectionId}/items/${itemId}`),

  // Team Shared Media
  shareMediaWithTeam: (data: { teamId: string; fileRequestUploadId: string; shareMessage?: string }) =>
    api.post(`/media/share`, data),
  shareMediaWithMultipleTeams: (data: { teamIds: string[]; fileRequestUploadId: string; shareMessage?: string }) =>
    api.post(`/media/share-multiple`, data),
  getTeamSharedMedia: (teamId: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/teams/${teamId}/shared-media`, { params }),
  removeSharedMedia: (teamId: string, fileId: string) =>
    api.delete(`/teams/${teamId}/shared-media/${fileId}`),
};

export default api;
