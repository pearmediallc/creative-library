import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Trash2, Info, Share2, Star, Tag } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { MediaFile } from '../types';
import { Button } from './ui/Button';
import { RequestAccessButton } from './RequestAccessButton';

interface MediaLightboxProps {
  files: MediaFile[];
  initialIndex: number;
  onClose: () => void;
  onDelete?: (fileId: string) => void;
  onStar?: (fileId: string) => void;
  onShare?: (file: MediaFile) => void;
  onInfo?: (file: MediaFile) => void;
  onTags?: (file: MediaFile) => void;
}

export function MediaLightbox({
  files,
  initialIndex,
  onClose,
  onDelete,
  onStar,
  onShare,
  onInfo,
  onTags
}: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageLoaded, setImageLoaded] = useState(false);

  const currentFile = files[currentIndex];
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < files.length - 1;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && canGoPrev) {
        goToPrevious();
      } else if (e.key === 'ArrowRight' && canGoNext) {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, canGoPrev, canGoNext]);

  // Reset image loaded state when file changes
  useEffect(() => {
    setImageLoaded(false);
  }, [currentIndex]);

  const goToPrevious = useCallback(() => {
    if (canGoPrev) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [canGoPrev]);

  const goToNext = useCallback(() => {
    if (canGoNext) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [canGoNext]);

  const handleDownload = () => {
    try {
      // Use backend download endpoint which sets proper Content-Disposition: attachment headers
      // This ensures files are downloaded instead of opening in browser
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const downloadUrl = `${API_BASE}/media/${currentFile.id}/download`;

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = currentFile.original_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur-sm">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">
            {currentFile.original_filename}
          </h3>
          <p className="text-gray-400 text-sm">
            {currentIndex + 1} of {files.length}
          </p>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {/* Action buttons */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="text-white hover:bg-white/10"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </Button>

          {onStar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStar(currentFile.id)}
              className="text-white hover:bg-white/10"
              title="Star"
            >
              <Star className="w-5 h-5" />
            </Button>
          )}

          {onShare && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onShare(currentFile)}
              className="text-white hover:bg-white/10"
              title="Share"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          )}

          {onTags && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTags(currentFile)}
              className="text-white hover:bg-white/10"
              title="Tags"
            >
              <Tag className="w-5 h-5" />
            </Button>
          )}

          {onInfo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onInfo(currentFile)}
              className="text-white hover:bg-white/10"
              title="Info"
            >
              <Info className="w-5 h-5" />
            </Button>
          )}

          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this file?')) {
                  onDelete(currentFile.id);
                  // Move to next file or close if it was the last one
                  if (files.length === 1) {
                    onClose();
                  } else if (currentIndex === files.length - 1) {
                    setCurrentIndex(prev => prev - 1);
                  }
                }
              }}
              className="text-red-500 hover:bg-red-500/10"
              title="Delete"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}

          {/* Request Access Button - shows when user doesn't have permission */}
          {!onDelete && !onShare && (
            <RequestAccessButton
              resourceType="media_file"
              resourceId={currentFile.id}
              resourceName={currentFile.original_filename}
              requestedPermission="download"
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
            />
          )}

          <div className="w-px h-6 bg-gray-600 mx-2" />

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/10"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center relative px-4 py-4">
        {/* Previous button */}
        {canGoPrev && (
          <button
            onClick={goToPrevious}
            className="absolute left-4 z-10 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-sm"
            title="Previous (Arrow Left)"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
        )}

        {/* Media display */}
        <div className="max-w-7xl max-h-full w-full h-full flex items-center justify-center">
          {currentFile.file_type === 'video' ? (
            <div className="w-full h-full flex items-center justify-center">
              <VideoPlayer
                src={currentFile.s3_url}
                poster={currentFile.thumbnail_url}
              />
            </div>
          ) : currentFile.file_type === 'image' ? (
            <div className="relative w-full h-full flex items-center justify-center">
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                </div>
              )}
              <img
                src={currentFile.s3_url}
                alt={currentFile.original_filename}
                className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
              />
            </div>
          ) : (
            <div className="text-center text-white">
              <p className="text-xl mb-4">Preview not available</p>
              <p className="text-gray-400 mb-6">
                This file type cannot be previewed in the browser
              </p>
              <Button onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download File
              </Button>
            </div>
          )}
        </div>

        {/* Next button */}
        {canGoNext && (
          <button
            onClick={goToNext}
            className="absolute right-4 z-10 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-sm"
            title="Next (Arrow Right)"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        )}
      </div>

      {/* Footer with file info */}
      <div className="px-6 py-4 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-6">
            <span>
              <span className="text-gray-500">Editor:</span>{' '}
              <span className="text-white">{currentFile.editor_name || 'Unknown'}</span>
            </span>
            <span>
              <span className="text-gray-500">Type:</span>{' '}
              <span className="text-white uppercase">{currentFile.file_type}</span>
            </span>
            <span>
              <span className="text-gray-500">Size:</span>{' '}
              <span className="text-white">{formatFileSize(currentFile.file_size)}</span>
            </span>
            {currentFile.created_at && (
              <span>
                <span className="text-gray-500">Uploaded:</span>{' '}
                <span className="text-white">{formatDate(currentFile.created_at)}</span>
              </span>
            )}
          </div>
          <div className="text-gray-500">
            Use arrow keys to navigate • Press ESC to close
          </div>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default MediaLightbox;
