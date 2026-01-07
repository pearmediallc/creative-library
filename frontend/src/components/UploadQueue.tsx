import React, { useState, useMemo } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  CheckCircle,
  XCircle,
  Loader,
  AlertCircle,
  FileIcon,
  Image as ImageIcon,
  Video,
  File,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import {
  UploadTask,
  formatBytes,
  formatSpeed,
  formatTimeRemaining,
} from '../hooks/useAdvancedUpload';

interface UploadQueueProps {
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
  onPause: (taskId: string) => void;
  onPauseAll: () => void;
  onResume: (taskId: string) => void;
  onResumeAll: () => void;
  onCancel: (taskId: string) => void;
  onRetry: (taskId: string) => void;
  onRemove: (taskId: string) => void;
  onClearCompleted: () => void;
  onClearAll: () => void;
}

export function UploadQueue({
  tasks,
  isUploading,
  stats,
  onPause,
  onPauseAll,
  onResume,
  onResumeAll,
  onCancel,
  onRetry,
  onRemove,
  onClearCompleted,
  onClearAll,
}: UploadQueueProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Don't render if there are no tasks
  if (tasks.length === 0) {
    return null;
  }

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return <ImageIcon size={16} className="text-blue-500" />;
    }
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext || '')) {
      return <Video size={16} className="text-purple-500" />;
    }
    return <File size={16} className="text-gray-500" />;
  };

  const getStatusIcon = (task: UploadTask) => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'uploading':
        return <Loader size={18} className="text-blue-500 animate-spin" />;
      case 'paused':
        return <Pause size={18} className="text-yellow-500" />;
      case 'failed':
      case 'cancelled':
        return <XCircle size={18} className="text-red-500" />;
      case 'queued':
      default:
        return <AlertCircle size={18} className="text-gray-400" />;
    }
  };

  const getStatusBadge = (status: UploadTask['status']) => {
    const badges = {
      queued: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      uploading: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    };

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badges[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const overallProgress = stats.totalBytes > 0 ? (stats.uploadedBytes / stats.totalBytes) * 100 : 0;
  const remainingBytes = stats.totalBytes - stats.uploadedBytes;
  const estimatedTime = formatTimeRemaining(remainingBytes, stats.averageSpeed);

  const activeCount = stats.uploading + stats.queued;
  const hasActiveTasks = activeCount > 0;
  const hasPausedTasks = stats.paused > 0;

  // Minimized view - just a small badge
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow-lg transition-all"
        >
          <Loader size={16} className={hasActiveTasks ? 'animate-spin' : ''} />
          <span className="font-medium">
            {activeCount > 0 ? `${activeCount} uploading` : `${stats.total} files`}
          </span>
          {stats.failed > 0 && (
            <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">
              {stats.failed} failed
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-[420px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl z-50 flex flex-col max-h-[600px] border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileIcon size={20} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Upload Queue</h3>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {stats.total} file{stats.total !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Minimize"
          >
            <Minimize2 size={18} />
          </button>
          <button
            onClick={() => {
              if (hasActiveTasks) {
                if (window.confirm('Uploads are in progress. Cancel all and close?')) {
                  onClearAll();
                }
              } else {
                onClearAll();
              }
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-gray-700"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Overall Progress */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-400">
                  {stats.completed} / {stats.total} completed
                </span>
                {stats.failed > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    ({stats.failed} failed)
                  </span>
                )}
              </div>
              {hasActiveTasks && (
                <span className="text-gray-600 dark:text-gray-400">
                  {formatBytes(stats.uploadedBytes)} / {formatBytes(stats.totalBytes)}
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>

            {/* Speed and ETA */}
            {hasActiveTasks && stats.averageSpeed > 0 && (
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{formatSpeed(stats.averageSpeed)}</span>
                <span>{estimatedTime} remaining</span>
              </div>
            )}

            {/* Control buttons */}
            <div className="flex items-center gap-2">
              {hasActiveTasks && (
                <button
                  onClick={onPauseAll}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors"
                >
                  <Pause size={14} />
                  Pause All
                </button>
              )}
              {hasPausedTasks && (
                <button
                  onClick={onResumeAll}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                >
                  <Play size={14} />
                  Resume All
                </button>
              )}
              {stats.completed > 0 && (
                <button
                  onClick={onClearCompleted}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <Trash2 size={14} />
                  Clear Completed
                </button>
              )}
            </div>
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto">
            {tasks.map((task) => {
              const isExpanded = expandedTasks.has(task.id);
              const truncatedName =
                task.file.name.length > 30
                  ? task.file.name.substring(0, 27) + '...'
                  : task.file.name;

              return (
                <div
                  key={task.id}
                  className="border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <div className="p-3 space-y-2">
                    {/* Task header */}
                    <div className="flex items-start gap-2">
                      {/* Thumbnail or icon */}
                      <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        {task.thumbnail ? (
                          <img
                            src={task.thumbnail}
                            alt={task.file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getFileIcon(task.file.name)
                        )}
                      </div>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(task)}
                          <span
                            className="font-medium text-sm text-gray-900 dark:text-white truncate cursor-pointer hover:text-blue-600"
                            title={task.file.name}
                            onClick={() => toggleTaskExpanded(task.id)}
                          >
                            {isExpanded ? task.file.name : truncatedName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span>{formatBytes(task.totalBytes)}</span>
                          {getStatusBadge(task.status)}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {task.status === 'uploading' && (
                          <button
                            onClick={() => onPause(task.id)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                            title="Pause"
                          >
                            <Pause size={16} className="text-yellow-600" />
                          </button>
                        )}
                        {task.status === 'paused' && (
                          <button
                            onClick={() => onResume(task.id)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                            title="Resume"
                          >
                            <Play size={16} className="text-blue-600" />
                          </button>
                        )}
                        {(task.status === 'failed' || task.status === 'cancelled') && (
                          <button
                            onClick={() => onRetry(task.id)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                            title="Retry"
                          >
                            <RotateCcw size={16} className="text-blue-600" />
                          </button>
                        )}
                        {task.status === 'uploading' && (
                          <button
                            onClick={() => onCancel(task.id)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                            title="Cancel"
                          >
                            <X size={16} className="text-red-600" />
                          </button>
                        )}
                        {(task.status === 'queued' ||
                          task.status === 'completed' ||
                          task.status === 'failed' ||
                          task.status === 'cancelled') && (
                          <button
                            onClick={() => onRemove(task.id)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                            title="Remove"
                          >
                            <Trash2 size={16} className="text-gray-500" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {(task.status === 'uploading' || task.status === 'completed') && (
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            task.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    )}

                    {/* Speed and ETA */}
                    {task.status === 'uploading' && task.speed && (
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatSpeed(task.speed)}</span>
                        <span>
                          {formatTimeRemaining(task.totalBytes - task.uploadedBytes, task.speed)}
                        </span>
                      </div>
                    )}

                    {/* Error message */}
                    {task.error && (task.status === 'failed' || task.status === 'cancelled') && (
                      <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                        {task.error}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
