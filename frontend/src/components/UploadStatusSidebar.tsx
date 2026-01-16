/**
 * Upload Status Sidebar
 * Persistent sidebar showing upload progress (Google Drive style)
 */

import React, { useState, useEffect } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Pause, Play, RotateCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { uploadQueueManager, UploadTask } from '../services/uploadQueueManager';
import { Button } from './ui/Button';

export function UploadStatusSidebar() {
  const [queue, setQueue] = useState<UploadTask[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Subscribe to queue updates
    const unsubscribe = uploadQueueManager.subscribe((updatedQueue) => {
      setQueue(updatedQueue);

      // Auto-show sidebar when uploads are added
      if (updatedQueue.length > 0 && !isVisible) {
        setIsVisible(true);
      }
    });

    // Initial load
    setQueue(uploadQueueManager.getQueue());

    return unsubscribe;
  }, [isVisible]);

  const stats = uploadQueueManager.getStats();

  // Hide sidebar if no uploads
  if (queue.length === 0 || !isVisible) {
    return null;
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (startTime?: number, endTime?: number): string => {
    if (!startTime) return '';
    const end = endTime || Date.now();
    const duration = Math.floor((end - startTime) / 1000);

    if (duration < 60) return `${duration}s`;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}m ${seconds}s`;
  };

  const getStatusIcon = (task: UploadTask) => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'uploading':
        return <Upload className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'paused':
        return <Pause className="w-5 h-5 text-yellow-500" />;
      case 'pending':
        return <Upload className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (task: UploadTask) => {
    switch (task.status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'uploading':
        return 'bg-blue-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'pending':
        return 'bg-gray-300';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white dark:bg-gray-800 shadow-2xl rounded-lg border border-gray-200 dark:border-gray-700 z-50 max-h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <Upload className="w-5 h-5 text-blue-500" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Uploads {stats.uploading > 0 && `(${stats.uploading} active)`}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {stats.completed} of {stats.total} completed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            {isMinimized ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Upload List */}
      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {queue.map((task) => (
              <div
                key={task.id}
                className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
              >
                {/* File Info */}
                <div className="flex items-start gap-3 mb-2">
                  {getStatusIcon(task)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {task.file?.name || 'Unknown file'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatBytes(task.uploadedBytes)} / {formatBytes(task.totalBytes)}
                      </span>
                      {task.status === 'uploading' && task.startTime && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          • {formatDuration(task.startTime)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {(task.status === 'uploading' || task.status === 'paused') && (
                  <div className="mb-2">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getStatusColor(task)}`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {task.progress}% • {formatBytes(task.uploadedBytes)} / {formatBytes(task.totalBytes)}
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {task.status === 'failed' && task.error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 mb-2">
                    <p className="text-xs text-red-800 dark:text-red-200">{task.error}</p>
                  </div>
                )}

                {/* Success Message */}
                {task.status === 'completed' && (
                  <p className="text-xs text-green-600 dark:text-green-400 mb-2">
                    Completed in {formatDuration(task.startTime, task.endTime)}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {task.status === 'uploading' && (
                    <button
                      onClick={() => uploadQueueManager.pauseUpload(task.id)}
                      className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/40"
                    >
                      <Pause className="w-3 h-3 inline mr-1" />
                      Pause
                    </button>
                  )}
                  {task.status === 'paused' && (
                    <button
                      onClick={() => uploadQueueManager.resumeUpload(task.id)}
                      className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/40"
                    >
                      <Play className="w-3 h-3 inline mr-1" />
                      Resume
                    </button>
                  )}
                  {task.status === 'failed' && (
                    <button
                      onClick={() => uploadQueueManager.retryUpload(task.id)}
                      className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/40"
                    >
                      <RotateCw className="w-3 h-3 inline mr-1" />
                      Retry
                    </button>
                  )}
                  {(task.status === 'pending' || task.status === 'paused' || task.status === 'failed' || task.status === 'completed') && (
                    <button
                      onClick={() => uploadQueueManager.cancelUpload(task.id)}
                      className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/40"
                    >
                      <Trash2 className="w-3 h-3 inline mr-1" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          {stats.completed > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => uploadQueueManager.clearCompleted()}
                className="w-full"
              >
                Clear Completed ({stats.completed})
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
