/**
 * Uploaded File Card
 * Displays uploaded file with video player, preview, and actions
 */

import React, { useState } from 'react';
import { Download, Eye, Plus, Play, X } from 'lucide-react';
import { Button } from './ui/Button';
import { formatBytes, formatDate } from '../lib/utils';

interface FileUpload {
  id: string;
  file_id: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  thumbnail_url?: string;
  cloudfront_url: string;
  uploaded_by_email?: string;
  uploaded_by_name?: string;
  created_at: string;
}

interface UploadedFileCardProps {
  upload: FileUpload;
  onDownload: (upload: FileUpload) => void;
  onAddToLibrary?: (upload: FileUpload) => void;
}

export function UploadedFileCard({ upload, onDownload, onAddToLibrary }: UploadedFileCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [adding, setAdding] = useState(false);

  const isVideo = upload.file_type.startsWith('video/') ||
                  upload.original_filename.match(/\.(mp4|mov|avi|webm|mkv)$/i);

  const isImage = upload.file_type.startsWith('image/') ||
                  upload.original_filename.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  const handleAddToLibrary = async () => {
    if (!onAddToLibrary) return;

    setAdding(true);
    try {
      await onAddToLibrary(upload);
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700">
        {/* Thumbnail/Preview */}
        <div className="flex-shrink-0">
          {isVideo ? (
            <div
              className="w-16 h-16 bg-gray-800 rounded flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors"
              onClick={() => setShowPreview(true)}
            >
              <Play className="w-8 h-8 text-white" />
            </div>
          ) : isImage && upload.thumbnail_url ? (
            <img
              src={upload.thumbnail_url}
              alt={upload.original_filename}
              className="w-16 h-16 object-cover rounded cursor-pointer"
              onClick={() => setShowPreview(true)}
            />
          ) : upload.thumbnail_url ? (
            <img
              src={upload.thumbnail_url}
              alt={upload.original_filename}
              className="w-16 h-16 object-cover rounded"
            />
          ) : (
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {upload.file_type.split('/')[1]?.toUpperCase() || 'FILE'}
              </span>
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {upload.original_filename}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>{formatBytes(upload.file_size)}</span>
            <span>•</span>
            <span>{formatDate(upload.created_at)}</span>
            {(upload.uploaded_by_name || upload.uploaded_by_email) && (
              <>
                <span>•</span>
                <span className="truncate max-w-[200px]">
                  {upload.uploaded_by_name || upload.uploaded_by_email}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Preview Button for videos/images */}
          {(isVideo || isImage) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(true)}
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </Button>
          )}

          {/* Add to Media Library */}
          {onAddToLibrary && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddToLibrary}
              disabled={adding}
              title="Add to Media Library"
            >
              <Plus className="w-4 h-4" />
              {adding ? 'Adding...' : 'Add to Library'}
            </Button>
          )}

          {/* Download Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownload(upload)}
            title="Download"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[70]">
          <div className="relative max-w-6xl w-full max-h-screen p-4">
            {/* Close Button */}
            <button
              onClick={() => setShowPreview(false)}
              className="absolute top-6 right-6 text-white hover:text-gray-300 z-10"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Content */}
            <div className="flex items-center justify-center h-full">
              {isVideo ? (
                <video
                  src={upload.cloudfront_url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[90vh] rounded-lg"
                >
                  Your browser does not support the video tag.
                </video>
              ) : isImage ? (
                <img
                  src={upload.cloudfront_url}
                  alt={upload.original_filename}
                  className="max-w-full max-h-[90vh] rounded-lg object-contain"
                />
              ) : null}
            </div>

            {/* File Info Overlay */}
            <div className="absolute bottom-6 left-6 right-6 bg-black/70 text-white p-4 rounded-lg">
              <p className="font-medium">{upload.original_filename}</p>
              <p className="text-sm text-gray-300 mt-1">
                {formatBytes(upload.file_size)} • {formatDate(upload.created_at)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
