import React, { useState, useEffect } from 'react';
import { X, Clock, Upload, RotateCcw, Trash2, Download, FileText } from 'lucide-react';
import { mediaApi } from '../lib/api';

// Simple time ago formatter
const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
};

interface MediaFile {
  id: string;
  original_filename: string;
  file_size: number;
  file_type: string;
  s3_url: string;
  thumbnail_url?: string;
  version_number: number;
  description?: string;
  created_at: string;
  uploaded_by?: string;
  width?: number;
  height?: number;
}

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  onVersionRestored?: () => void;
}

export function VersionHistoryModal({
  isOpen,
  onClose,
  fileId,
  fileName,
  onVersionRestored
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingNewVersion, setUploadingNewVersion] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [newVersionDescription, setNewVersionDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchVersionHistory();
    }
  }, [isOpen, fileId]);

  const fetchVersionHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await mediaApi.getVersionHistory(fileId);
      setVersions(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch version history:', err);
      setError(err.response?.data?.error || 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadNewVersion = async () => {
    if (!newVersionFile) return;

    try {
      setUploadingNewVersion(true);
      setError('');
      await mediaApi.createVersion(fileId, newVersionFile, newVersionDescription);
      setNewVersionFile(null);
      setNewVersionDescription('');
      await fetchVersionHistory();
      onVersionRestored?.();
    } catch (err: any) {
      console.error('Failed to upload new version:', err);
      setError(err.response?.data?.error || 'Failed to upload new version');
    } finally {
      setUploadingNewVersion(false);
    }
  };

  const handleRestoreVersion = async (versionId: string, versionNumber: number) => {
    if (!window.confirm(`Restore version ${versionNumber}? This will create a new version based on this one.`)) {
      return;
    }

    try {
      setError('');
      await mediaApi.restoreVersion(fileId, versionId);
      await fetchVersionHistory();
      onVersionRestored?.();
      alert('Version restored successfully');
    } catch (err: any) {
      console.error('Failed to restore version:', err);
      setError(err.response?.data?.error || 'Failed to restore version');
    }
  };

  const handleDeleteVersion = async (versionId: string, versionNumber: number) => {
    if (!window.confirm(`Delete version ${versionNumber}? This cannot be undone.`)) {
      return;
    }

    try {
      setError('');
      await mediaApi.deleteVersion(fileId, versionId);
      await fetchVersionHistory();
    } catch (err: any) {
      console.error('Failed to delete version:', err);
      setError(err.response?.data?.error || 'Failed to delete version');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (!isOpen) return null;

  const currentVersion = versions.find(v => v.version_number === Math.max(...versions.map(v => v.version_number)));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Clock className="text-blue-600" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Version History</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Upload New Version Section */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Upload size={16} />
            Upload New Version
          </h3>
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="file"
                onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                disabled={uploadingNewVersion}
              />
            </div>
            <input
              type="text"
              value={newVersionDescription}
              onChange={(e) => setNewVersionDescription(e.target.value)}
              placeholder="Optional description..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
              disabled={uploadingNewVersion}
            />
            <button
              onClick={handleUploadNewVersion}
              disabled={!newVersionFile || uploadingNewVersion}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
            >
              {uploadingNewVersion ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Versions List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500 dark:text-gray-400">Loading versions...</div>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <Clock size={48} className="mb-4 opacity-50" />
              <p>No version history available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className={`border rounded-lg p-4 ${
                    version.id === currentVersion?.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      {version.thumbnail_url ? (
                        <img
                          src={version.thumbnail_url}
                          alt={`Version ${version.version_number}`}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <FileText size={24} className="text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Version Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          Version {version.version_number}
                        </span>
                        {version.id === currentVersion?.id && (
                          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                            Current
                          </span>
                        )}
                      </div>

                      {version.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {version.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatFileSize(version.file_size)}</span>
                        {version.width && version.height && (
                          <span>{version.width} × {version.height}px</span>
                        )}
                        <span>
                          {formatTimeAgo(new Date(version.created_at))}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <a
                        href={version.s3_url}
                        download
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download size={16} />
                      </a>

                      {version.id !== currentVersion?.id && (
                        <>
                          <button
                            onClick={() => handleRestoreVersion(version.id, version.version_number)}
                            className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Restore this version"
                          >
                            <RotateCcw size={16} />
                          </button>

                          <button
                            onClick={() => handleDeleteVersion(version.id, version.version_number)}
                            className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete this version"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
