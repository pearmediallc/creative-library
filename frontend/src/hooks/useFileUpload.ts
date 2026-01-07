import { useState, useCallback } from 'react';
import { mediaApi } from '../lib/api';

export interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  uploadedUrl?: string;
  speed?: number; // bytes per second
  startTime?: number;
  cancelToken?: AbortController;
}

export interface UploadOptions {
  editorId: string;
  tags?: string[];
  description?: string;
  folderId?: string;
  organizeByDate?: boolean;
  assignedBuyerId?: string;
  removeMetadata?: boolean;
  addMetadata?: boolean;
}

export function useFileUpload() {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const addFiles = useCallback((files: File[]) => {
    const newFiles: UploadFile[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'pending' as const,
      cancelToken: new AbortController(),
    }));
    setUploadFiles(prev => [...prev, ...newFiles]);
    return newFiles;
  }, []);

  const removeFile = useCallback((id: string) => {
    setUploadFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.cancelToken && file.status === 'uploading') {
        file.cancelToken.abort();
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const cancelUpload = useCallback((id: string) => {
    setUploadFiles(prev => prev.map(f => {
      if (f.id === id && f.cancelToken && f.status === 'uploading') {
        f.cancelToken.abort();
        return { ...f, status: 'error' as const, error: 'Upload cancelled' };
      }
      return f;
    }));
  }, []);

  const retryUpload = useCallback((id: string, options: UploadOptions) => {
    setUploadFiles(prev => prev.map(f => {
      if (f.id === id) {
        return { ...f, status: 'pending' as const, error: undefined, progress: 0, cancelToken: new AbortController() };
      }
      return f;
    }));
    // Trigger upload for this specific file
    const file = uploadFiles.find(f => f.id === id);
    if (file) {
      uploadSingleFile(file, options);
    }
  }, [uploadFiles]);

  const uploadSingleFile = async (uploadFile: UploadFile, options: UploadOptions) => {
    const { id, file, cancelToken } = uploadFile;
    const startTime = Date.now();

    setUploadFiles(prev => prev.map(f =>
      f.id === id ? { ...f, status: 'uploading' as const, startTime, progress: 0 } : f
    ));

    try {
      // Create a custom XMLHttpRequest to track progress
      const response = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();

        formData.append('file', file);
        formData.append('editor_id', options.editorId);

        if (options.tags) formData.append('tags', JSON.stringify(options.tags));
        if (options.description) formData.append('description', options.description);
        if (options.folderId) formData.append('folder_id', options.folderId);
        if (options.organizeByDate) formData.append('organize_by_date', 'true');
        if (options.assignedBuyerId) formData.append('assigned_buyer_id', options.assignedBuyerId);
        if (options.removeMetadata) formData.append('remove_metadata', 'true');
        if (options.addMetadata) formData.append('add_metadata', 'true');

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            const elapsedTime = (Date.now() - startTime) / 1000; // seconds
            const speed = e.loaded / elapsedTime; // bytes per second

            setUploadFiles(prev => prev.map(f =>
              f.id === id ? { ...f, progress, speed } : f
            ));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch (e) {
              reject(new Error('Failed to parse response'));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        // Set up cancellation
        if (cancelToken) {
          cancelToken.signal.addEventListener('abort', () => {
            xhr.abort();
          });
        }

        const token = localStorage.getItem('token');
        xhr.open('POST', `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/media/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });

      setUploadFiles(prev => prev.map(f =>
        f.id === id ? {
          ...f,
          status: 'success' as const,
          progress: 100,
          uploadedUrl: response.data?.s3_url
        } : f
      ));

    } catch (error: any) {
      setUploadFiles(prev => prev.map(f =>
        f.id === id ? {
          ...f,
          status: 'error' as const,
          error: error.message || 'Upload failed'
        } : f
      ));
    }
  };

  const uploadAll = useCallback(async (options: UploadOptions) => {
    setIsUploading(true);

    const pendingFiles = uploadFiles.filter(f => f.status === 'pending' || f.status === 'error');

    // Upload files in parallel (max 3 at a time to avoid overwhelming server)
    const batchSize = 3;
    for (let i = 0; i < pendingFiles.length; i += batchSize) {
      const batch = pendingFiles.slice(i, i + batchSize);
      await Promise.all(batch.map(file => uploadSingleFile(file, options)));
    }

    setIsUploading(false);
  }, [uploadFiles]);

  const clearCompleted = useCallback(() => {
    setUploadFiles(prev => prev.filter(f => f.status !== 'success'));
  }, []);

  const clearAll = useCallback(() => {
    uploadFiles.forEach(f => {
      if (f.cancelToken && f.status === 'uploading') {
        f.cancelToken.abort();
      }
    });
    setUploadFiles([]);
  }, [uploadFiles]);

  const stats = {
    total: uploadFiles.length,
    pending: uploadFiles.filter(f => f.status === 'pending').length,
    uploading: uploadFiles.filter(f => f.status === 'uploading').length,
    success: uploadFiles.filter(f => f.status === 'success').length,
    error: uploadFiles.filter(f => f.status === 'error').length,
    totalSize: uploadFiles.reduce((acc, f) => acc + f.file.size, 0),
    uploadedSize: uploadFiles.reduce((acc, f) =>
      acc + (f.file.size * (f.progress / 100)), 0
    ),
    averageSpeed: uploadFiles
      .filter(f => f.speed)
      .reduce((acc, f) => acc + (f.speed || 0), 0) / uploadFiles.filter(f => f.speed).length || 0,
  };

  return {
    uploadFiles,
    isUploading,
    stats,
    addFiles,
    removeFile,
    cancelUpload,
    retryUpload,
    uploadAll,
    clearCompleted,
    clearAll,
  };
}

// Utility function to format bytes
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Utility function to format speed
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

// Utility function to estimate time remaining
export function formatTimeRemaining(bytesRemaining: number, bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return 'Calculating...';
  const secondsRemaining = bytesRemaining / bytesPerSecond;

  if (secondsRemaining < 60) {
    return `${Math.round(secondsRemaining)}s`;
  } else if (secondsRemaining < 3600) {
    return `${Math.round(secondsRemaining / 60)}m`;
  } else {
    return `${Math.round(secondsRemaining / 3600)}h`;
  }
}
