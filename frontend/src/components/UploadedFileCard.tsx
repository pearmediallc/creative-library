/**
 * Uploaded File Card
 * Displays uploaded file with video player, preview, and actions
 */

import React, { useState } from 'react';
import { Download, Eye, Plus, Play, X, Edit2, Check, XCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { formatBytes, formatDate } from '../lib/utils';
import { VideoPlayer } from './VideoPlayer';

interface FileUpload {
  id: string;
  file_id: string;
  upload_session_id?: string;
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
  onRemoveFromRequest?: (upload: FileUpload) => Promise<void> | void;
  onRename?: (upload: FileUpload, newFilename: string) => Promise<void> | void;
}

export function UploadedFileCard({ upload, onDownload, onAddToLibrary, onRemoveFromRequest, onRename }: UploadedFileCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [adding, setAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newFilename, setNewFilename] = useState(upload.original_filename);
  const [renaming, setRenaming] = useState(false);

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

  const handleRemoveFromRequest = async () => {
    if (!onRemoveFromRequest) return;
    await onRemoveFromRequest(upload);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setNewFilename(upload.original_filename);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setNewFilename(upload.original_filename);
  };

  const handleSaveRename = async () => {
    if (!onRename || !newFilename.trim() || newFilename === upload.original_filename) {
      setIsEditing(false);
      return;
    }

    setRenaming(true);
    try {
      await onRename(upload, newFilename.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to rename file:', error);
      alert('Failed to rename file. Please try again.');
    } finally {
      setRenaming(false);
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
          {isEditing ? (
            <div className="flex items-center gap-2 mb-1">
              <input
                type="text"
                value={newFilename}
                onChange={(e) => setNewFilename(e.target.value)}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Enter filename"
                disabled={renaming}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                autoFocus
              />
              <button
                onClick={handleSaveRename}
                disabled={renaming}
                className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 rounded disabled:opacity-50"
                title="Save"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={renaming}
                className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                title="Cancel"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                {upload.original_filename}
              </p>
              {onRename && (
                <button
                  onClick={handleStartEdit}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded transition-opacity"
                  title="Rename file"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
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

          {/* Remove from request (keeps history; soft-delete) */}
          {onRemoveFromRequest && upload.upload_session_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveFromRequest}
              title="Remove from request"
            >
              <X className="w-4 h-4" />
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
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[100]"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="relative w-full h-full flex items-center justify-center p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowPreview(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-20 bg-black/50 rounded-full p-2"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Content */}
            {isVideo ? (
              <div className="w-full h-full max-w-[90vw] max-h-[80vh] flex items-center justify-center">
                <VideoPlayer
                  src={upload.cloudfront_url}
                  poster={upload.thumbnail_url}
                  autoPlay={true}
                  className="w-full h-full"
                />
              </div>
            ) : isImage ? (
              <img
                src={upload.cloudfront_url}
                alt={upload.original_filename}
                className="max-w-full max-h-full rounded-lg object-contain shadow-2xl"
                style={{ maxHeight: '90vh', maxWidth: '90vw' }}
              />
            ) : null}

            {/* File Info Overlay */}
            <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-4 rounded-lg max-w-2xl mx-auto">
              <p className="font-medium truncate">{upload.original_filename}</p>
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
