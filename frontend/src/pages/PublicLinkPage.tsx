import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, Download, Eye, AlertCircle, FileIcon, Image, Video, FileText, Clock, XCircle, ChevronLeft, ChevronRight, Folder } from 'lucide-react';
import { publicLinkApi } from '../lib/api';
import { Button } from '../components/ui/Button';
import { VideoPlayer } from '../components/VideoPlayer';

export function PublicLinkPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [resource, setResource] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [resourceType, setResourceType] = useState<string>('file');
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [error, setError] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [disableDownload, setDisableDownload] = useState(false);

  useEffect(() => {
    if (token) {
      loadPublicResource();
    }
  }, [token]);

  const loadPublicResource = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await publicLinkApi.getPublic(token!);
      const data = response.data.data;
      setResource(data.resource);
      setResourceType(data.resource_type || 'file');
      setDisableDownload(data.disable_download || false);
      if (data.files && data.files.length > 0) {
        setFiles(data.files);
      }
    } catch (err: any) {
      console.error('Failed to load public resource:', err);
      if (err.response?.status === 401 && err.response?.data?.requires_password) {
        setRequiresPassword(true);
      } else if (err.response?.status === 404) {
        setError('This link does not exist or has been removed.');
      } else if (err.response?.status === 410) {
        setError(err.response?.data?.error || 'This link has expired or reached maximum views.');
      } else {
        setError(err.response?.data?.error || 'Failed to load resource. Please check the link and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setError('Please enter a password');
      return;
    }

    try {
      setVerifying(true);
      setError('');
      const response = await publicLinkApi.verifyPassword(token!, password);
      const data = response.data.data;
      setResource(data.resource);
      setResourceType(data.resource_type || 'file');
      setDisableDownload(data.disable_download || false);
      if (data.files && data.files.length > 0) {
        setFiles(data.files);
      }
      setRequiresPassword(false);
    } catch (err: any) {
      console.error('Password verification failed:', err);
      if (err.response?.status === 401) {
        setError('Invalid password. Please try again.');
      } else if (err.response?.status === 410) {
        setError(err.response?.data?.error || 'This link has expired or reached maximum views.');
      } else {
        setError(err.response?.data?.error || 'Verification failed. Please try again.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleDownload = async () => {
    if (!token || disableDownload) return;

    try {
      const response = await publicLinkApi.downloadPublic(token, requiresPassword ? password : undefined);
      const downloadUrl = response.data.data.download_url;

      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
      }
    } catch (err: any) {
      console.error('Download failed:', err);
      setError(err.response?.data?.error || 'Failed to download file');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType?.startsWith('image/')) {
      return <Image className="w-16 h-16 text-blue-500" />;
    } else if (fileType?.startsWith('video/')) {
      return <Video className="w-16 h-16 text-purple-500" />;
    } else if (fileType?.includes('pdf')) {
      return <FileText className="w-16 h-16 text-red-500" />;
    }
    return <FileIcon className="w-16 h-16 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Get the current file to display (for folders with multiple files)
  const getCurrentFile = () => {
    if (files.length > 0) {
      return files[currentFileIndex] || files[0];
    }
    return resource;
  };

  const goToNextFile = () => {
    if (currentFileIndex < files.length - 1) {
      setCurrentFileIndex(currentFileIndex + 1);
    }
  };

  const goToPrevFile = () => {
    if (currentFileIndex > 0) {
      setCurrentFileIndex(currentFileIndex - 1);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Password required state
  if (requiresPassword && !resource) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
              <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Password Required
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              This link is password protected. Please enter the password to access the content.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleVerifyPassword} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter password"
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12"
              disabled={verifying || !password}
            >
              {verifying ? 'Verifying...' : 'Access Content'}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Shared via Creative Library
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !resource) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 mb-4">
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Unable to Access
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Need help? Contact the person who shared this link with you.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state - Display resource
  if (resource) {
    const isFolder = resourceType === 'folder' && files.length > 0;
    const currentFile = getCurrentFile();
    const isImage = currentFile?.file_type?.startsWith('image/');
    const isVideo = currentFile?.file_type?.startsWith('video/');

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {isFolder ? resource.name || resource.filename : currentFile?.filename || resource.filename}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Shared with you via Creative Library
            </p>
            {isFolder && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                <Folder className="w-4 h-4 inline mr-1" />
                {files.length} file{files.length !== 1 ? 's' : ''} in this folder
              </p>
            )}
          </div>

          {/* Main Content */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            {/* Preview */}
            <div className="bg-gray-100 dark:bg-gray-900 p-8 flex items-center justify-center min-h-[400px] relative">
              {/* Navigation arrows for folders */}
              {isFolder && files.length > 1 && (
                <>
                  <button
                    onClick={goToPrevFile}
                    disabled={currentFileIndex === 0}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-700 shadow-lg rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                  </button>
                  <button
                    onClick={goToNextFile}
                    disabled={currentFileIndex === files.length - 1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-700 shadow-lg rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                  </button>
                </>
              )}

              {isImage && currentFile?.s3_url ? (
                <img
                  src={currentFile.s3_url}
                  alt={currentFile.filename}
                  className="max-w-full max-h-[600px] object-contain rounded-lg shadow-lg"
                />
              ) : isVideo && currentFile?.s3_url ? (
                <div className="w-full max-w-3xl mx-auto">
                  <VideoPlayer
                    key={currentFile.id}
                    src={currentFile.s3_url}
                    poster={currentFile.thumbnail_url}
                    className="w-full"
                  />
                </div>
              ) : currentFile?.thumbnail_url ? (
                <img
                  src={currentFile.thumbnail_url}
                  alt={currentFile.filename}
                  className="max-w-full max-h-[400px] object-contain rounded-lg shadow-lg"
                />
              ) : (
                <div className="text-center">
                  {getFileIcon(currentFile?.file_type)}
                  <p className="text-gray-500 dark:text-gray-400 mt-4">
                    Preview not available
                  </p>
                </div>
              )}

              {/* File counter for folders */}
              {isFolder && files.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-1.5 rounded-full">
                  {currentFileIndex + 1} / {files.length}
                </div>
              )}
            </div>

            {/* Current file name for folders */}
            {isFolder && (
              <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {currentFile?.filename}
                </p>
              </div>
            )}

            {/* Info */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <FileIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">File Type</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {currentFile?.file_type?.split('/')[1]?.toUpperCase() || 'Unknown'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">File Size</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatFileSize(currentFile?.file_size)}
                    </p>
                  </div>
                </div>

                {!disableDownload && (
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleDownload}
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                )}
              </div>

              {resource.description && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {resource.description}
                  </p>
                </div>
              )}

              {disableDownload && (
                <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Downloads are disabled for this file
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnail strip for folders */}
            {isFolder && files.length > 1 && (
              <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {files.map((file, index) => (
                    <button
                      key={file.id}
                      onClick={() => setCurrentFileIndex(index)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        index === currentFileIndex
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {file.thumbnail_url ? (
                        <img src={file.thumbnail_url} alt={file.filename} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <FileIcon className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Uploaded via info */}
          {resource.request_title && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Uploaded via file request: {resource.request_title}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Powered by Creative Library
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Want to share your own files securely? Get your own Creative Library
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
