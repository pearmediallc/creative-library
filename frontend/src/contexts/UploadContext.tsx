import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  uploadedUrl?: string;
  speed?: number;
  startTime?: number;
  cancelToken?: AbortController;
  folderPath?: string;
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
  // For file request uploads
  requestId?: string;
  subfolder?: string;
  comments?: string;
}

interface UploadStats {
  total: number;
  pending: number;
  uploading: number;
  success: number;
  error: number;
  totalSize: number;
  uploadedSize: number;
  averageSpeed: number;
}

interface UploadContextType {
  uploadFiles: UploadFile[];
  isUploading: boolean;
  stats: UploadStats;
  isMinimized: boolean;
  addFiles: (files: File[], folderPath?: string) => UploadFile[];
  removeFile: (id: string) => void;
  cancelUpload: (id: string) => void;
  uploadAll: (options: UploadOptions) => Promise<void>;
  clearCompleted: () => void;
  clearAll: () => void;
  setMinimized: (val: boolean) => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isMinimized, setMinimized] = useState(true);
  const uploadingRef = useRef(false);

  const addFiles = useCallback((files: File[], folderPath?: string) => {
    const newFiles: UploadFile[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'pending' as const,
      cancelToken: new AbortController(),
      folderPath,
    }));
    setUploadFiles(prev => [...prev, ...newFiles]);
    setMinimized(false); // Show widget when files are added
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

  const uploadSingleFile = async (uploadFile: UploadFile, options: UploadOptions) => {
    const { id, file, cancelToken } = uploadFile;
    const startTime = Date.now();

    setUploadFiles(prev => prev.map(f =>
      f.id === id ? { ...f, status: 'uploading' as const, startTime, progress: 0 } : f
    ));

    try {
      await new Promise<any>((resolve, reject) => {
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
        if (uploadFile.folderPath) formData.append('folder_path', uploadFile.folderPath);

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            const elapsedTime = (Date.now() - startTime) / 1000;
            const speed = e.loaded / elapsedTime;
            setUploadFiles(prev => prev.map(f =>
              f.id === id ? { ...f, progress, speed } : f
            ));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch { reject(new Error('Failed to parse response')); }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

        if (cancelToken) {
          cancelToken.signal.addEventListener('abort', () => xhr.abort());
        }

        const token = localStorage.getItem('token');
        xhr.open('POST', `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/media/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });

      setUploadFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'success' as const, progress: 100 } : f
      ));
    } catch (error: any) {
      setUploadFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'error' as const, error: error.message || 'Upload failed' } : f
      ));
    }
  };

  const uploadFilesRef = useRef(uploadFiles);
  uploadFilesRef.current = uploadFiles;

  const uploadAll = useCallback(async (options: UploadOptions) => {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setIsUploading(true);

    // Read from ref to get current state, avoiding stale closure
    const pendingFiles = uploadFilesRef.current.filter(f => f.status === 'pending' || f.status === 'error');
    const batchSize = 3;
    for (let i = 0; i < pendingFiles.length; i += batchSize) {
      const batch = pendingFiles.slice(i, i + batchSize);
      await Promise.all(batch.map(file => uploadSingleFile(file, options)));
    }

    setIsUploading(false);
    uploadingRef.current = false;
  }, []);

  const clearCompleted = useCallback(() => {
    setUploadFiles(prev => prev.filter(f => f.status !== 'success'));
  }, []);

  const clearAll = useCallback(() => {
    setUploadFiles(prev => {
      prev.forEach(f => {
        if (f.cancelToken && f.status === 'uploading') f.cancelToken.abort();
      });
      return [];
    });
  }, []);

  const stats: UploadStats = {
    total: uploadFiles.length,
    pending: uploadFiles.filter(f => f.status === 'pending').length,
    uploading: uploadFiles.filter(f => f.status === 'uploading').length,
    success: uploadFiles.filter(f => f.status === 'success').length,
    error: uploadFiles.filter(f => f.status === 'error').length,
    totalSize: uploadFiles.reduce((acc, f) => acc + f.file.size, 0),
    uploadedSize: uploadFiles.reduce((acc, f) => acc + (f.file.size * (f.progress / 100)), 0),
    averageSpeed: uploadFiles.filter(f => f.speed).reduce((acc, f) => acc + (f.speed || 0), 0)
      / (uploadFiles.filter(f => f.speed).length || 1),
  };

  return (
    <UploadContext.Provider value={{
      uploadFiles, isUploading, stats, isMinimized,
      addFiles, removeFile, cancelUpload, uploadAll,
      clearCompleted, clearAll, setMinimized,
    }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useGlobalUpload() {
  const context = useContext(UploadContext);
  if (!context) throw new Error('useGlobalUpload must be used within UploadProvider');
  return context;
}
