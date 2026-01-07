import { useState, useCallback, useRef, useEffect } from 'react';

export interface UploadTask {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  speed?: number;
  error?: string;
  xhr?: XMLHttpRequest;
  startTime?: number;
  pausedAt?: number;
  thumbnail?: string;
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

interface UploadQueueState {
  tasks: UploadTask[];
  isUploading: boolean;
  concurrentUploads: number;
}

const STORAGE_KEY = 'upload_queue_state';
const MAX_CONCURRENT_UPLOADS = 3;

export function useAdvancedUpload() {
  const [tasks, setTasks] = useState<UploadTask[]>(() => {
    // Try to restore upload state from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Reset all uploading tasks to queued on reload
        return parsed.map((task: UploadTask) => ({
          ...task,
          status: task.status === 'uploading' ? 'queued' : task.status,
          xhr: undefined,
          speed: undefined,
        }));
      }
    } catch (e) {
      console.error('Failed to restore upload state:', e);
    }
    return [];
  });

  const [isUploading, setIsUploading] = useState(false);
  const uploadOptionsRef = useRef<UploadOptions | null>(null);
  const activeUploadsRef = useRef<Set<string>>(new Set());

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    try {
      const tasksToSave = tasks.map(({ xhr, ...task }) => task);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksToSave));
    } catch (e) {
      console.error('Failed to save upload state:', e);
    }
  }, [tasks]);

  // Generate thumbnail for image files
  const generateThumbnail = useCallback((file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve('');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string || '');
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    const newTasks: UploadTask[] = await Promise.all(
      files.map(async (file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: 'queued' as const,
        progress: 0,
        uploadedBytes: 0,
        totalBytes: file.size,
        thumbnail: await generateThumbnail(file),
      }))
    );
    setTasks((prev) => [...prev, ...newTasks]);
    return newTasks;
  }, [generateThumbnail]);

  const uploadSingleTask = useCallback(
    (task: UploadTask, options: UploadOptions): Promise<void> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        const startTime = Date.now();

        formData.append('file', task.file);
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
            const elapsedTime = (Date.now() - startTime) / 1000;
            const speed = elapsedTime > 0 ? e.loaded / elapsedTime : 0;

            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? {
                      ...t,
                      progress,
                      uploadedBytes: e.loaded,
                      speed,
                    }
                  : t
              )
            );
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? {
                      ...t,
                      status: 'completed',
                      progress: 100,
                      uploadedBytes: task.totalBytes,
                      xhr: undefined,
                    }
                  : t
              )
            );
            activeUploadsRef.current.delete(task.id);
            resolve();
          } else {
            const error = `Upload failed with status ${xhr.status}`;
            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? {
                      ...t,
                      status: 'failed',
                      error,
                      xhr: undefined,
                    }
                  : t
              )
            );
            activeUploadsRef.current.delete(task.id);
            reject(new Error(error));
          }
        });

        xhr.addEventListener('error', () => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    status: 'failed',
                    error: 'Network error',
                    xhr: undefined,
                  }
                : t
            )
          );
          activeUploadsRef.current.delete(task.id);
          reject(new Error('Network error'));
        });

        xhr.addEventListener('abort', () => {
          activeUploadsRef.current.delete(task.id);
          reject(new Error('Upload aborted'));
        });

        // Store XHR reference in task for pause/cancel functionality
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: 'uploading',
                  xhr,
                  startTime,
                  pausedAt: undefined,
                }
              : t
          )
        );

        const token = localStorage.getItem('token');
        xhr.open('POST', `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/media/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
    },
    []
  );

  const processQueue = useCallback(async () => {
    const options = uploadOptionsRef.current;
    if (!options) return;

    const queuedTasks = tasks.filter((t) => t.status === 'queued');

    for (const task of queuedTasks) {
      // Wait until we have room for another upload
      while (activeUploadsRef.current.size >= MAX_CONCURRENT_UPLOADS) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Check if we should stop uploading
      if (!uploadOptionsRef.current) {
        break;
      }

      activeUploadsRef.current.add(task.id);
      uploadSingleTask(task, options).catch((error) => {
        console.error(`Upload failed for ${task.file.name}:`, error);
      });
    }

    // Wait for all active uploads to complete
    while (activeUploadsRef.current.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setIsUploading(false);
    uploadOptionsRef.current = null;
  }, [tasks, uploadSingleTask]);

  const startUpload = useCallback(
    async (options: UploadOptions) => {
      if (isUploading) return;

      const queuedOrFailed = tasks.filter((t) => t.status === 'queued' || t.status === 'failed');
      if (queuedOrFailed.length === 0) return;

      // Reset failed tasks to queued
      setTasks((prev) =>
        prev.map((t) =>
          t.status === 'failed'
            ? { ...t, status: 'queued', error: undefined, progress: 0, uploadedBytes: 0 }
            : t
        )
      );

      uploadOptionsRef.current = options;
      setIsUploading(true);
      await processQueue();
    },
    [isUploading, tasks, processQueue]
  );

  const pauseUpload = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId && t.status === 'uploading' && t.xhr) {
          t.xhr.abort();
          return {
            ...t,
            status: 'paused',
            pausedAt: Date.now(),
            xhr: undefined,
          };
        }
        return t;
      })
    );
    activeUploadsRef.current.delete(taskId);
  }, []);

  const pauseAll = useCallback(() => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.status === 'uploading' && t.xhr) {
          t.xhr.abort();
          activeUploadsRef.current.delete(t.id);
          return {
            ...t,
            status: 'paused',
            pausedAt: Date.now(),
            xhr: undefined,
          };
        }
        return t;
      })
    );
  }, []);

  const resumeUpload = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status !== 'paused') return;

      const options = uploadOptionsRef.current;
      if (!options) return;

      // Reset task to queued to be picked up by the queue processor
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'queued',
                progress: 0,
                uploadedBytes: 0,
                error: undefined,
              }
            : t
        )
      );

      // If not currently uploading, restart the queue
      if (!isUploading) {
        setIsUploading(true);
        await processQueue();
      }
    },
    [tasks, isUploading, processQueue]
  );

  const resumeAll = useCallback(async () => {
    const options = uploadOptionsRef.current;
    if (!options) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.status === 'paused'
          ? {
              ...t,
              status: 'queued',
              progress: 0,
              uploadedBytes: 0,
              error: undefined,
            }
          : t
      )
    );

    if (!isUploading) {
      setIsUploading(true);
      await processQueue();
    }
  }, [isUploading, processQueue]);

  const cancelUpload = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          if (t.xhr) {
            t.xhr.abort();
            activeUploadsRef.current.delete(taskId);
          }
          return {
            ...t,
            status: 'cancelled',
            xhr: undefined,
            error: 'Cancelled by user',
          };
        }
        return t;
      })
    );
  }, []);

  const retryUpload = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId && (t.status === 'failed' || t.status === 'cancelled')
          ? {
              ...t,
              status: 'queued',
              error: undefined,
              progress: 0,
              uploadedBytes: 0,
            }
          : t
      )
    );
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (task?.xhr) {
        task.xhr.abort();
        activeUploadsRef.current.delete(taskId);
      }
      return prev.filter((t) => t.id !== taskId);
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
  }, []);

  const clearAll = useCallback(() => {
    tasks.forEach((t) => {
      if (t.xhr) {
        t.xhr.abort();
      }
    });
    activeUploadsRef.current.clear();
    setTasks([]);
    setIsUploading(false);
    uploadOptionsRef.current = null;
  }, [tasks]);

  const stats = {
    total: tasks.length,
    queued: tasks.filter((t) => t.status === 'queued').length,
    uploading: tasks.filter((t) => t.status === 'uploading').length,
    paused: tasks.filter((t) => t.status === 'paused').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
    cancelled: tasks.filter((t) => t.status === 'cancelled').length,
    totalBytes: tasks.reduce((acc, t) => acc + t.totalBytes, 0),
    uploadedBytes: tasks.reduce((acc, t) => acc + t.uploadedBytes, 0),
    averageSpeed:
      tasks.filter((t) => t.speed).reduce((acc, t) => acc + (t.speed || 0), 0) /
        tasks.filter((t) => t.speed).length || 0,
  };

  return {
    tasks,
    isUploading,
    stats,
    addFiles,
    startUpload,
    pauseUpload,
    pauseAll,
    resumeUpload,
    resumeAll,
    cancelUpload,
    retryUpload,
    removeTask,
    clearCompleted,
    clearAll,
  };
}

// Utility functions
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

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
