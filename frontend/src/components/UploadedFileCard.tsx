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
      <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 dark:bg-gray-900 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-100 dark:border-gray-700/50 group">
        {/* Compact Thumbnail */}
        <div className="flex-shrink-0 cursor-pointer" onClick={() => setShowPreview(true)}>
          {isVideo ? (
            <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center">
              <Play className="w-4 h-4 text-white" />
            </div>
          ) : (isImage && upload.thumbnail_url) ? (
            <img src={upload.thumbnail_url} alt="" className="w-8 h-8 object-cover rounded" />
          ) : upload.thumbnail_url ? (
            <img src={upload.thumbnail_url} alt="" className="w-8 h-8 object-cover rounded" />
          ) : (
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
              <span className="text-[9px] font-bold text-gray-400">{upload.file_type.split('/')[1]?.toUpperCase()?.slice(0, 3) || 'FILE'}</span>
            </div>
          )}
        </div>

        {/* File Info - single line */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input type="text" value={newFilename} onChange={(e) => setNewFilename(e.target.value)}
                className="flex-1 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                disabled={renaming} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(); if (e.key === 'Escape') handleCancelEdit(); }} autoFocus />
              <button onClick={handleSaveRename} disabled={renaming} className="p-0.5 text-green-600 rounded" title="Save"><Check className="w-3 h-3" /></button>
              <button onClick={handleCancelEdit} disabled={renaming} className="p-0.5 text-red-600 rounded" title="Cancel"><XCircle className="w-3 h-3" /></button>
            </div>
          ) : (
            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{upload.original_filename}</p>
          )}
        </div>

        {/* Size */}
        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 w-16 text-right">{formatBytes(upload.file_size)}</span>

        {/* Date */}
        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 w-20 text-right hidden sm:block">{formatDate(upload.created_at)}</span>

        {/* Compact icon-only actions - visible on hover */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onRename && !isEditing && (
            <button onClick={handleStartEdit} className="p-1 text-gray-400 hover:text-blue-600 rounded" title="Rename"><Edit2 className="w-3 h-3" /></button>
          )}
          {(isVideo || isImage) && (
            <button onClick={() => setShowPreview(true)} className="p-1 text-gray-400 hover:text-blue-600 rounded" title="Preview"><Eye className="w-3 h-3" /></button>
          )}
          {onRemoveFromRequest && upload.upload_session_id && (
            <button onClick={handleRemoveFromRequest} className="p-1 text-gray-400 hover:text-red-600 rounded" title="Remove"><X className="w-3 h-3" /></button>
          )}
          <button onClick={() => onDownload(upload)} className="p-1 text-gray-400 hover:text-blue-600 rounded" title="Download"><Download className="w-3 h-3" /></button>
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
