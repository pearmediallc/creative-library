import React from 'react';
import { X, ChevronUp, ChevronDown, CheckCircle, XCircle, Loader, Upload } from 'lucide-react';
import { useGlobalUpload } from '../contexts/UploadContext';
import { formatBytes } from '../hooks/useFileUpload';

export function UploadProgressWidget() {
  const { uploadFiles, isUploading, stats, isMinimized, setMinimized, clearCompleted, cancelUpload, removeFile, clearAll } = useGlobalUpload();

  // Don't show widget if no files
  if (uploadFiles.length === 0) return null;

  const overallProgress = stats.totalSize > 0
    ? Math.round((stats.uploadedSize / stats.totalSize) * 100)
    : 0;

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 right-4 z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 px-4 py-3 cursor-pointer hover:shadow-3xl transition-shadow flex items-center gap-3 min-w-[280px]"
        onClick={() => setMinimized(false)}
      >
        <div className="relative">
          <Upload className="w-5 h-5 text-blue-500" />
          {isUploading && (
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {isUploading ? `Uploading ${stats.uploading} of ${stats.total}` : `${stats.success}/${stats.total} complete`}
            </span>
            <span className="text-gray-500">{overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
            <div
              className={`h-1.5 rounded-full transition-all ${stats.error > 0 ? 'bg-orange-500' : 'bg-blue-500'}`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
        <ChevronUp className="w-4 h-4 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-96 max-h-[50vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {isUploading ? 'Uploading...' : 'Upload Complete'}
          </span>
          <span className="text-xs text-gray-500">
            {stats.success}/{stats.total}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Minimize">
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {!isUploading && (
            <button onClick={() => clearAll()} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Close">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Overall Progress */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700/50">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${stats.error > 0 ? 'bg-orange-500' : 'bg-blue-500'}`}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>{formatBytes(stats.uploadedSize)} / {formatBytes(stats.totalSize)}</span>
          <span>{overallProgress}%</span>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto max-h-[250px]">
        {uploadFiles.map(file => (
          <div key={file.id} className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 dark:border-gray-700/30 last:border-b-0">
            <div className="flex-shrink-0">
              {file.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
              {file.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
              {file.status === 'uploading' && <Loader className="w-4 h-4 text-blue-500 animate-spin" />}
              {file.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{file.file.name}</p>
              {file.status === 'uploading' && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-1">
                  <div className="h-1 rounded-full bg-blue-500 transition-all" style={{ width: `${file.progress}%` }} />
                </div>
              )}
              {file.status === 'error' && (
                <p className="text-[10px] text-red-500 truncate">{file.error}</p>
              )}
            </div>
            <span className="text-[10px] text-gray-400 flex-shrink-0">{formatBytes(file.file.size)}</span>
            {file.status === 'uploading' && (
              <button onClick={() => cancelUpload(file.id)} className="p-0.5 hover:bg-gray-100 rounded" title="Cancel">
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
            {(file.status === 'success' || file.status === 'error') && !isUploading && (
              <button onClick={() => removeFile(file.id)} className="p-0.5 hover:bg-gray-100 rounded" title="Remove">
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      {!isUploading && stats.success > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={clearCompleted}
            className="text-xs text-blue-600 hover:underline"
          >
            Clear completed
          </button>
        </div>
      )}
    </div>
  );
}
