import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  Info,
  Clock,
  Share2,
  History,
  Save,
  Edit2,
  Check,
  XCircle,
  Folder,
  User,
  Calendar,
  FileText,
  Tag,
  HardDrive,
  Image as ImageIcon,
  Video,
  File,
  AlertCircle,
  Palette,
  Users
} from 'lucide-react';
import { Button } from './ui/Button';
import { mediaApi, folderApi, activityLogApi, permissionApi } from '../lib/api';
import { MediaFile } from '../types';
import { formatBytes, formatDate } from '../lib/utils';
import { ShareDialog } from './ShareDialog';

interface PropertiesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  resourceType: 'file' | 'folder';
  resourceId: string;
  onUpdate?: () => void;
}

type TabType = 'details' | 'activity' | 'sharing' | 'versions';

interface FolderDetails {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
  created_by_name?: string;
  parent_folder_id?: string;
  parent_folder_name?: string;
  file_count?: number;
  subfolder_count?: number;
  total_size?: number;
}

interface ActivityLogEntry {
  id: string;
  created_at: string;
  user_email: string;
  action_type: string;
  resource_type: string;
  resource_name: string;
  status: string;
  details?: any;
}

interface VersionEntry {
  id: string;
  version_number: number;
  file_size: number;
  s3_url: string;
  thumbnail_url?: string;
  description?: string;
  created_at: string;
  created_by_name?: string;
}

interface Permission {
  id: string;
  grantee_type: 'user' | 'team';
  grantee_name: string;
  permission_type: string;
  granted_at: string;
  expires_at?: string;
}

export function PropertiesPanel({
  isOpen,
  onClose,
  resourceType,
  resourceId,
  onUpdate
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // File or folder data
  const [fileData, setFileData] = useState<MediaFile | null>(null);
  const [folderData, setFolderData] = useState<FolderDetails | null>(null);

  // Activity data
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Permissions data
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // Versions data
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Editable fields state
  const [editMode, setEditMode] = useState({
    name: false,
    description: false,
    tags: false,
    color: false
  });

  const [editValues, setEditValues] = useState({
    name: '',
    description: '',
    tags: [] as string[],
    color: ''
  });

  const [showShareDialog, setShowShareDialog] = useState(false);

  // Fetch resource details
  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (resourceType === 'file') {
        const response = await mediaApi.getOne(resourceId);
        const file = response.data.data;
        setFileData(file);
        setEditValues({
          name: file.original_filename,
          description: file.description || '',
          tags: file.tags || [],
          color: ''
        });
      } else {
        const response = await folderApi.getOne(resourceId);
        const folder = response.data.data;
        setFolderData(folder);
        setEditValues({
          name: folder.name,
          description: folder.description || '',
          tags: [],
          color: folder.color || '#3b82f6'
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch resource details:', err);
      setError(err.response?.data?.error || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  // Fetch activity logs
  const fetchActivity = useCallback(async () => {
    try {
      setActivitiesLoading(true);
      const response = await activityLogApi.getLogs({
        resource_type: resourceType,
        limit: 20,
        offset: 0
      });
      setActivities(response.data.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setActivitiesLoading(false);
    }
  }, [resourceType]);

  // Fetch permissions
  const fetchPermissions = useCallback(async () => {
    try {
      setPermissionsLoading(true);
      const response = await permissionApi.getResourcePermissions(resourceType, resourceId);
      setPermissions(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
    } finally {
      setPermissionsLoading(false);
    }
  }, [resourceType, resourceId]);

  // Fetch version history (files only)
  const fetchVersions = useCallback(async () => {
    if (resourceType !== 'file') return;

    try {
      setVersionsLoading(true);
      const response = await mediaApi.getVersionHistory(resourceId);
      setVersions(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    } finally {
      setVersionsLoading(false);
    }
  }, [resourceType, resourceId]);

  useEffect(() => {
    if (isOpen) {
      fetchDetails();
    }
  }, [isOpen, fetchDetails]);

  useEffect(() => {
    if (isOpen && activeTab === 'activity' && activities.length === 0) {
      fetchActivity();
    }
  }, [isOpen, activeTab, fetchActivity]);

  useEffect(() => {
    if (isOpen && activeTab === 'sharing' && permissions.length === 0) {
      fetchPermissions();
    }
  }, [isOpen, activeTab, fetchPermissions]);

  useEffect(() => {
    if (isOpen && activeTab === 'versions' && versions.length === 0) {
      fetchVersions();
    }
  }, [isOpen, activeTab, fetchVersions]);

  const handleSave = async (field: keyof typeof editMode) => {
    try {
      setSaving(true);
      setError('');

      if (resourceType === 'file') {
        if (field === 'name') {
          await mediaApi.rename(resourceId, editValues.name);
        } else if (field === 'description' || field === 'tags') {
          await mediaApi.update(resourceId, {
            description: editValues.description,
            tags: editValues.tags
          });
        }
      } else {
        await folderApi.update(resourceId, {
          name: editValues.name,
          description: editValues.description,
          color: editValues.color
        });
      }

      setEditMode({ ...editMode, [field]: false });
      await fetchDetails();
      onUpdate?.();
    } catch (err: any) {
      console.error('Failed to save:', err);
      setError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (field: keyof typeof editMode) => {
    setEditMode({ ...editMode, [field]: false });
    if (resourceType === 'file' && fileData) {
      setEditValues({
        name: fileData.original_filename,
        description: fileData.description || '',
        tags: fileData.tags || [],
        color: ''
      });
    } else if (resourceType === 'folder' && folderData) {
      setEditValues({
        name: folderData.name,
        description: folderData.description || '',
        tags: [],
        color: folderData.color || '#3b82f6'
      });
    }
  };

  const handleVersionRestore = async (versionId: string) => {
    if (!window.confirm('Restore this version? This will create a new version with this content.')) {
      return;
    }

    try {
      await mediaApi.restoreVersion(resourceId, versionId);
      alert('Version restored successfully');
      await fetchVersions();
      await fetchDetails();
      onUpdate?.();
    } catch (err: any) {
      console.error('Failed to restore version:', err);
      alert(err.response?.data?.error || 'Failed to restore version');
    }
  };

  const handleVersionDownload = async (version: VersionEntry) => {
    try {
      // Use authenticated fetch with Bearer token to download file
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const downloadUrl = `${API_BASE}/media/${resourceId}/download`;
      const token = localStorage.getItem('token');

      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `version-${version.version_number}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  const getFileIcon = (fileType?: string) => {
    switch (fileType) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-blue-500" />;
      case 'video':
        return <Video className="w-5 h-5 text-purple-500" />;
      default:
        return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full md:w-[400px] bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Properties</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'details'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-900'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Info className="w-4 h-4 inline-block mr-1" />
            Details
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'activity'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-900'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Clock className="w-4 h-4 inline-block mr-1" />
            Activity
          </button>
          <button
            onClick={() => setActiveTab('sharing')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'sharing'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-900'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Share2 className="w-4 h-4 inline-block mr-1" />
            Sharing
          </button>
          {resourceType === 'file' && (
            <button
              onClick={() => setActiveTab('versions')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'versions'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-900'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <History className="w-4 h-4 inline-block mr-1" />
              Versions
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-600 dark:text-gray-400">Loading...</p>
            </div>
          ) : (
            <>
              {/* DETAILS TAB */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  {resourceType === 'file' && fileData && (
                    <>
                      {/* Thumbnail/Preview */}
                      <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
                        {fileData.thumbnail_url ? (
                          <img
                            src={fileData.thumbnail_url}
                            alt={fileData.original_filename}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          getFileIcon(fileData.file_type)
                        )}
                      </div>

                      {/* Filename */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Filename
                          </label>
                          {!editMode.name && (
                            <button
                              onClick={() => setEditMode({ ...editMode, name: true })}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {editMode.name ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editValues.name}
                              onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave('name');
                                if (e.key === 'Escape') handleCancel('name');
                              }}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSave('name')}
                                disabled={saving}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancel('name')}
                                disabled={saving}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-900 dark:text-white font-medium">
                            {fileData.original_filename}
                          </p>
                        )}
                      </div>

                      {/* File Info Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Type</p>
                          <div className="flex items-center gap-2">
                            {getFileIcon(fileData.file_type)}
                            <span className="text-sm text-gray-900 dark:text-white capitalize">
                              {fileData.file_type}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Size</p>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {formatBytes(fileData.file_size)}
                          </p>
                        </div>
                        {fileData.width && fileData.height && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Dimensions</p>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {fileData.width} x {fileData.height}
                            </p>
                          </div>
                        )}
                        {fileData.duration && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Duration</p>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {Math.floor(fileData.duration)}s
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Uploaded</p>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {formatDate(fileData.created_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Modified</p>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {formatDate(fileData.updated_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Uploaded by</p>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {fileData.uploader_name || 'Unknown'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Editor</p>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {fileData.editor_name || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <Tag className="w-4 h-4" />
                            Tags
                          </label>
                          {!editMode.tags && (
                            <button
                              onClick={() => setEditMode({ ...editMode, tags: true })}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {editMode.tags ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editValues.tags.join(', ')}
                              onChange={(e) => setEditValues({
                                ...editValues,
                                tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                              })}
                              placeholder="tag1, tag2, tag3"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSave('tags')}
                                disabled={saving}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancel('tags')}
                                disabled={saving}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {fileData.tags && fileData.tags.length > 0 ? (
                              fileData.tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                                >
                                  {tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-gray-500">No tags</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            Description
                          </label>
                          {!editMode.description && (
                            <button
                              onClick={() => setEditMode({ ...editMode, description: true })}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {editMode.description ? (
                          <div className="space-y-2">
                            <textarea
                              value={editValues.description}
                              onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                              placeholder="Add a description..."
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm min-h-[80px]"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSave('description')}
                                disabled={saving}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancel('description')}
                                disabled={saving}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-900 dark:text-white">
                            {fileData.description || <span className="text-gray-500">No description</span>}
                          </p>
                        )}
                      </div>

                      {/* Storage Info */}
                      <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                          <HardDrive className="w-4 h-4" />
                          Storage Information
                        </label>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">S3 Key</p>
                            <p className="text-xs text-gray-900 dark:text-white font-mono break-all">
                              {fileData.s3_key}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">MIME Type</p>
                            <p className="text-xs text-gray-900 dark:text-white">
                              {fileData.mime_type}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {resourceType === 'folder' && folderData && (
                    <>
                      {/* Folder Icon with Color */}
                      <div className="flex items-center justify-center p-8">
                        <div
                          className="p-8 rounded-2xl"
                          style={{ backgroundColor: `${folderData.color || '#3b82f6'}20` }}
                        >
                          <Folder
                            className="w-20 h-20"
                            style={{ color: folderData.color || '#3b82f6' }}
                          />
                        </div>
                      </div>

                      {/* Folder Name */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Folder Name
                          </label>
                          {!editMode.name && (
                            <button
                              onClick={() => setEditMode({ ...editMode, name: true })}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {editMode.name ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editValues.name}
                              onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave('name');
                                if (e.key === 'Escape') handleCancel('name');
                              }}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSave('name')}
                                disabled={saving}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancel('name')}
                                disabled={saving}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-900 dark:text-white font-medium">
                            {folderData.name}
                          </p>
                        )}
                      </div>

                      {/* Folder Color */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <Palette className="w-4 h-4" />
                            Color
                          </label>
                          {!editMode.color && (
                            <button
                              onClick={() => setEditMode({ ...editMode, color: true })}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {editMode.color ? (
                          <div className="space-y-2">
                            <input
                              type="color"
                              value={editValues.color}
                              onChange={(e) => setEditValues({ ...editValues, color: e.target.value })}
                              className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSave('color')}
                                disabled={saving}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancel('color')}
                                disabled={saving}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="w-12 h-8 rounded border border-gray-300 dark:border-gray-600"
                            style={{ backgroundColor: folderData.color || '#3b82f6' }}
                          />
                        )}
                      </div>

                      {/* Folder Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Files</p>
                          <p className="text-sm text-gray-900 dark:text-white font-medium">
                            {folderData.file_count || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Subfolders</p>
                          <p className="text-sm text-gray-900 dark:text-white font-medium">
                            {folderData.subfolder_count || 0}
                          </p>
                        </div>
                        {folderData.total_size !== undefined && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Size</p>
                            <p className="text-sm text-gray-900 dark:text-white font-medium">
                              {formatBytes(folderData.total_size)}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Created</p>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {formatDate(folderData.created_at)}
                          </p>
                        </div>
                        {folderData.created_by_name && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Created by</p>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {folderData.created_by_name}
                            </p>
                          </div>
                        )}
                        {folderData.parent_folder_name && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Parent Folder</p>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {folderData.parent_folder_name}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            Description
                          </label>
                          {!editMode.description && (
                            <button
                              onClick={() => setEditMode({ ...editMode, description: true })}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {editMode.description ? (
                          <div className="space-y-2">
                            <textarea
                              value={editValues.description}
                              onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                              placeholder="Add a description..."
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm min-h-[80px]"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSave('description')}
                                disabled={saving}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancel('description')}
                                disabled={saving}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-900 dark:text-white">
                            {folderData.description || <span className="text-gray-500">No description</span>}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ACTIVITY TAB */}
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  {activitiesLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-gray-600 dark:text-gray-400">Loading activities...</p>
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-600 dark:text-gray-400">No activity yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activities.slice(0, 20).map((activity) => (
                        <div
                          key={activity.id}
                          className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 mt-1">
                              <User className="w-4 h-4 text-gray-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 dark:text-white font-medium">
                                {activity.action_type}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                by {activity.user_email}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                {formatDate(activity.created_at)}
                              </p>
                            </div>
                            <span
                              className={`flex-shrink-0 px-2 py-1 text-xs rounded-full ${
                                activity.status === 'success'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                              }`}
                            >
                              {activity.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SHARING TAB */}
              {activeTab === 'sharing' && (
                <div className="space-y-4">
                  <Button
                    onClick={() => setShowShareDialog(true)}
                    className="w-full"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share {resourceType}
                  </Button>

                  {permissionsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-gray-600 dark:text-gray-400">Loading permissions...</p>
                    </div>
                  ) : permissions.length === 0 ? (
                    <div className="text-center py-8">
                      <Share2 className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-600 dark:text-gray-400">Not shared with anyone</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Shared with {permissions.length} {permissions.length === 1 ? 'person' : 'people'}
                      </h3>
                      {permissions.map((perm) => (
                        <div
                          key={perm.id}
                          className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            {perm.grantee_type === 'team' ? (
                              <Users className="w-4 h-4 text-purple-500" />
                            ) : (
                              <User className="w-4 h-4 text-blue-500" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {perm.grantee_name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Can {perm.permission_type}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* VERSIONS TAB */}
              {activeTab === 'versions' && resourceType === 'file' && (
                <div className="space-y-4">
                  {versionsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-gray-600 dark:text-gray-400">Loading versions...</p>
                    </div>
                  ) : versions.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-600 dark:text-gray-400">No version history</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <div className="flex gap-3">
                            {version.thumbnail_url && (
                              <img
                                src={version.thumbnail_url}
                                alt={`Version ${version.version_number}`}
                                className="w-16 h-16 rounded object-cover"
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  Version {version.version_number}
                                </p>
                                <span className="text-xs text-gray-500">
                                  {formatBytes(version.file_size)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {formatDate(version.created_at)}
                              </p>
                              {version.created_by_name && (
                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                  by {version.created_by_name}
                                </p>
                              )}
                              {version.description && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  {version.description}
                                </p>
                              )}
                              <div className="flex gap-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleVersionRestore(version.id)}
                                >
                                  Restore
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleVersionDownload(version)}
                                >
                                  Download
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Share Dialog */}
      {showShareDialog && (
        <ShareDialog
          isOpen={showShareDialog}
          onClose={() => {
            setShowShareDialog(false);
            fetchPermissions();
          }}
          resourceType={resourceType}
          resourceId={resourceId}
          resourceName={
            resourceType === 'file'
              ? fileData?.original_filename || 'File'
              : folderData?.name || 'Folder'
          }
        />
      )}
    </>
  );
}
