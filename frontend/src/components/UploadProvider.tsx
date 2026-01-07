import React, { createContext, useContext, ReactNode } from 'react';
import { useAdvancedUpload, UploadTask, UploadOptions } from '../hooks/useAdvancedUpload';
import { UploadQueue } from './UploadQueue';

interface UploadContextValue {
  tasks: UploadTask[];
  isUploading: boolean;
  stats: {
    total: number;
    queued: number;
    uploading: number;
    paused: number;
    completed: number;
    failed: number;
    cancelled: number;
    totalBytes: number;
    uploadedBytes: number;
    averageSpeed: number;
  };
  addFiles: (files: File[]) => Promise<UploadTask[]>;
  startUpload: (options: UploadOptions) => Promise<void>;
  pauseUpload: (taskId: string) => void;
  pauseAll: () => void;
  resumeUpload: (taskId: string) => Promise<void>;
  resumeAll: () => Promise<void>;
  cancelUpload: (taskId: string) => void;
  retryUpload: (taskId: string) => void;
  removeTask: (taskId: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUploadContext() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUploadContext must be used within UploadProvider');
  }
  return context;
}

interface UploadProviderProps {
  children: ReactNode;
}

export function UploadProvider({ children }: UploadProviderProps) {
  const uploadControls = useAdvancedUpload();

  return (
    <UploadContext.Provider value={uploadControls}>
      {children}
      <UploadQueue
        tasks={uploadControls.tasks}
        isUploading={uploadControls.isUploading}
        stats={uploadControls.stats}
        onPause={uploadControls.pauseUpload}
        onPauseAll={uploadControls.pauseAll}
        onResume={uploadControls.resumeUpload}
        onResumeAll={uploadControls.resumeAll}
        onCancel={uploadControls.cancelUpload}
        onRetry={uploadControls.retryUpload}
        onRemove={uploadControls.removeTask}
        onClearCompleted={uploadControls.clearCompleted}
        onClearAll={uploadControls.clearAll}
      />
    </UploadContext.Provider>
  );
}
