import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Maximize2,
  Minimize2,
  FileText
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface PDFViewerProps {
  url: string;
  filename: string;
  onDownload?: () => void;
}

type ZoomLevel = 'fit-width' | 'fit-page' | 50 | 100 | 150 | 200;

export function PDFViewer({ url, filename, onDownload }: PDFViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pageInput, setPageInput] = useState('1');
  const [zoom, setZoom] = useState<ZoomLevel>('fit-width');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  // Load PDF document
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    pdfjsLib
      .getDocument(url)
      .promise.then((loadedPdf) => {
        if (isMounted) {
          setPdf(loadedPdf);
          setNumPages(loadedPdf.numPages);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading PDF:', err);
        if (isMounted) {
          setError('Failed to load PDF. The file may be corrupted or unsupported.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;

    // Cancel previous render task
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    pdf.getPage(currentPage).then((page: PDFPageProxy) => {
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      let scale = 1;

      // Calculate scale based on zoom level
      if (zoom === 'fit-width') {
        scale = (containerWidth - 40) / viewport.width;
      } else if (zoom === 'fit-page') {
        const widthScale = (containerWidth - 40) / viewport.width;
        const heightScale = (containerHeight - 40) / viewport.height;
        scale = Math.min(widthScale, heightScale);
      } else {
        scale = zoom / 100;
      }

      const scaledViewport = page.getViewport({ scale });

      // Set canvas dimensions
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      const context = canvas.getContext('2d');
      if (!context) return;

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };

      renderTaskRef.current = page.render(renderContext);
      renderTaskRef.current.promise
        .then(() => {
          renderTaskRef.current = null;
        })
        .catch((err: any) => {
          if (err.name !== 'RenderingCancelledException') {
            console.error('Error rendering page:', err);
          }
        });
    });

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdf, currentPage, zoom]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        handlePreviousPage();
      } else if (e.key === 'ArrowRight' && currentPage < numPages) {
        handleNextPage();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, zoom]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      setPageInput(newPage.toString());
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      setPageInput(newPage.toString());
    }
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNumber = parseInt(pageInput, 10);
    if (pageNumber >= 1 && pageNumber <= numPages) {
      setCurrentPage(pageNumber);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const handleZoomIn = () => {
    if (typeof zoom === 'number') {
      if (zoom < 200) {
        setZoom((zoom + 50) as ZoomLevel);
      }
    } else {
      setZoom(100);
    }
  };

  const handleZoomOut = () => {
    if (typeof zoom === 'number') {
      if (zoom > 50) {
        setZoom((zoom - 50) as ZoomLevel);
      }
    } else {
      setZoom(100);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <FileText className="w-16 h-16 text-white/50 mx-auto mb-4 animate-pulse" />
          <p className="text-white text-lg">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md px-4">
          <FileText className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-white text-lg mb-2">Error Loading PDF</p>
          <p className="text-white/70 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="bg-black/80 backdrop-blur p-3 flex items-center justify-between gap-4 flex-shrink-0">
        {/* Left: Page Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousPage}
            disabled={currentPage <= 1}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous Page (←)"
          >
            <ChevronLeft size={20} />
          </button>

          <form onSubmit={handlePageInputSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={pageInput}
              onChange={handlePageInputChange}
              className="w-12 px-2 py-1 bg-white/10 text-white text-center rounded border border-white/20 focus:outline-none focus:border-blue-500"
            />
            <span className="text-white text-sm">/ {numPages}</span>
          </form>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= numPages}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next Page (→)"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Center: Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom === 50}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom Out (-)"
          >
            <ZoomOut size={20} />
          </button>

          <select
            value={zoom}
            onChange={(e) => setZoom(e.target.value as ZoomLevel)}
            className="px-3 py-1 bg-white/10 text-white rounded border border-white/20 focus:outline-none focus:border-blue-500"
          >
            <option value="fit-width">Fit Width</option>
            <option value="fit-page">Fit Page</option>
            <option value={50}>50%</option>
            <option value={100}>100%</option>
            <option value={150}>150%</option>
            <option value={200}>200%</option>
          </select>

          <button
            onClick={handleZoomIn}
            disabled={zoom === 200}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom In (+)"
          >
            <ZoomIn size={20} />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            title="Toggle Thumbnails"
          >
            <FileText size={20} />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            title="Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>

          {onDownload && (
            <button
              onClick={onDownload}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              title="Download"
            >
              <Download size={20} />
            </button>
          )}
        </div>
      </div>

      {/* PDF Canvas Container */}
      <div className="flex-1 overflow-auto bg-gray-900 flex items-start justify-center p-4">
        <canvas
          ref={canvasRef}
          className="shadow-2xl"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>

      {/* Thumbnails Sidebar (Optional) */}
      {showThumbnails && numPages > 1 && (
        <div className="absolute left-0 top-16 bottom-0 w-48 bg-black/90 backdrop-blur p-2 overflow-y-auto">
          <div className="space-y-2">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => {
                  setCurrentPage(pageNum);
                  setPageInput(pageNum.toString());
                }}
                className={`w-full p-2 rounded transition-colors ${
                  pageNum === currentPage
                    ? 'bg-blue-500/30 border-2 border-blue-500'
                    : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                }`}
              >
                <div className="aspect-[8.5/11] bg-white/10 rounded mb-1 flex items-center justify-center">
                  <FileText className="text-white/50" size={24} />
                </div>
                <p className="text-white text-xs text-center">Page {pageNum}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
