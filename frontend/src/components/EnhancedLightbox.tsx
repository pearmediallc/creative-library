import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, Maximize2 } from 'lucide-react';
import { PDFViewer } from './PDFViewer';
import { VideoPlayer } from './VideoPlayer';

interface MediaFile {
  id: string;
  original_filename: string;
  file_type: string;
  s3_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

interface EnhancedLightboxProps {
  files: MediaFile[];
  currentIndex: number;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

export function EnhancedLightbox({ files, currentIndex, onClose, onNavigate }: EnhancedLightboxProps) {
  const [index, setIndex] = useState(currentIndex);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const currentFile = files[index];

  useEffect(() => {
    setIndex(currentIndex);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) handlePrevious();
      if (e.key === 'ArrowRight' && index < files.length - 1) handleNext();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, files.length]);

  const handlePrevious = () => {
    if (index > 0) {
      const newIndex = index - 1;
      setIndex(newIndex);
      onNavigate?.(newIndex);
      resetView();
    }
  };

  const handleNext = () => {
    if (index < files.length - 1) {
      const newIndex = index + 1;
      setIndex(newIndex);
      onNavigate?.(newIndex);
      resetView();
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const resetView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleDownload = () => {
    // Use backend download endpoint which sets proper Content-Disposition: attachment headers
    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
    const downloadUrl = `${API_BASE}/media/${currentFile.id}/download`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = currentFile.original_filename;
    // DO NOT set target='_blank' as it opens in new tab instead of downloading
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!currentFile) return null;

  const isPDF = currentFile.file_type === 'pdf' || currentFile.original_filename.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header - Only show for non-PDF files (PDF has its own toolbar) */}
      {!isPDF && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-4 text-white">
            <h3 className="text-lg font-semibold truncate max-w-md">
              {currentFile.original_filename}
            </h3>
            <span className="text-sm opacity-75">
              {index + 1} / {files.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              title="Download"
            >
              <Download size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {isPDF ? (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* PDF Header */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between z-20">
            <div className="flex items-center gap-4 text-white">
              <h3 className="text-lg font-semibold truncate max-w-md">
                {currentFile.original_filename}
              </h3>
              <span className="text-sm opacity-75">
                {index + 1} / {files.length}
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 mt-16">
            <PDFViewer
              url={currentFile.s3_url}
              filename={currentFile.original_filename}
              onDownload={handleDownload}
            />
          </div>
        </div>
      ) : (
        <div
          className="flex-1 flex items-center justify-center overflow-hidden relative"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {currentFile.file_type === 'video' ? (
            <div className="w-full max-w-5xl mx-auto">
              <VideoPlayer
                src={currentFile.s3_url}
                poster={currentFile.thumbnail_url}
                autoPlay
                className="w-full"
              />
            </div>
          ) : (
            <img
              src={currentFile.s3_url}
              alt={currentFile.original_filename}
              className="max-w-full max-h-full object-contain transition-transform"
              style={{
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default'
              }}
              draggable={false}
            />
          )}
        </div>
      )}

      {/* Navigation - Hide for PDFs as they have their own navigation */}
      {!isPDF && index > 0 && (
        <button
          onClick={handlePrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
          title="Previous (←)"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {!isPDF && index < files.length - 1 && (
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
          title="Next (→)"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Zoom Controls - Only for images */}
      {!isPDF && currentFile.file_type === 'image' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur rounded-full p-2 flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom Out (-)"
          >
            <ZoomOut size={20} />
          </button>

          <span className="text-white text-sm px-3 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom In (+)"
          >
            <ZoomIn size={20} />
          </button>

          <div className="w-px h-6 bg-white/20 mx-1" />

          <button
            onClick={handleResetZoom}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            title="Fit to Screen"
          >
            <Maximize2 size={20} />
          </button>
        </div>
      )}

      {/* Thumbnails - Hide for PDFs as they have their own thumbnail sidebar */}
      {!isPDF && files.length > 1 && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center">
          <div className="bg-black/80 backdrop-blur rounded-lg p-2 flex gap-2 max-w-full overflow-x-auto">
            {files.slice(Math.max(0, index - 5), Math.min(files.length, index + 6)).map((file, i) => {
              const actualIndex = Math.max(0, index - 5) + i;
              return (
                <button
                  key={file.id}
                  onClick={() => {
                    setIndex(actualIndex);
                    onNavigate?.(actualIndex);
                    resetView();
                  }}
                  className={`w-16 h-16 rounded overflow-hidden border-2 transition-all ${
                    actualIndex === index
                      ? 'border-blue-500 scale-110'
                      : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                >
                  {file.thumbnail_url ? (
                    <img
                      src={file.thumbnail_url}
                      alt={file.original_filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white text-xs">
                      {file.file_type}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
