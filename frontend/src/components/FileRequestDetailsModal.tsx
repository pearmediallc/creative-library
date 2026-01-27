import React, { useEffect, useState } from 'react';
import { X, Copy, Calendar, Folder, Mail, CheckCircle, Clock, FileText, Upload as UploadIcon, Rocket, XCircle, RotateCcw } from 'lucide-react';
import { Button } from './ui/Button';
import { fileRequestApi, mediaApi } from '../lib/api';
import { formatDate } from '../lib/utils';
import { CanvasEditor } from './CanvasEditor';
import { CanvasRenderer } from './CanvasRenderer';
import { UploadedFileCard } from './UploadedFileCard';
import { UploadHistoryTimeline } from './UploadHistoryTimeline';
import type { Canvas } from '../lib/canvasTemplates';
import { useAuth } from '../contexts/AuthContext';

// Status badge helper
function getStatusBadge(status: string | undefined) {
  if (!status) status = 'open';

  const badges = {
    open: { label: 'Open', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
    in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
    uploaded: { label: 'Uploaded', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
    launched: { label: 'Launched', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
    closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    reopened: { label: 'Reopened', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' }
  };

  const badge = badges[status as keyof typeof badges] || badges.open;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
      {badge.label}
    </span>
  );
}

interface FileRequestDetailsModalProps {
  requestId: string;
  onClose: () => void;
  onUpdate: () => void;
}

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

interface AssignedEditor {
  id: string;
  name: string;
  display_name: string;
  assigned_at: string;
  status: string;
  assigned_by_name?: string;
}

interface FileRequestDetails {
  id: string;
  title: string;
  description?: string;
  request_type?: string;
  request_token: string;
  is_active: boolean;
  deadline?: string;
  folder_name?: string;
  allow_multiple_uploads: boolean;
  require_email: boolean;
  custom_message?: string;
  upload_count: number;
  num_creatives_requested?: number;
  creator_name?: string;
  creator_email?: string;
  created_by?: string;
  created_at: string;
  assigned_at?: string;
  picked_up_at?: string;
  completed_at?: string;
  delivery_note?: string;
  time_to_complete_hours?: string;
  uploads: FileUpload[];
  assigned_editors?: AssignedEditor[];
  // New status lifecycle fields
  status?: 'open' | 'in_progress' | 'uploaded' | 'launched' | 'closed' | 'reopened';
  uploaded_at?: string;
  uploaded_by?: string;
  launched_at?: string;
  launched_by?: string;
  closed_at?: string;
  closed_by?: string;
  reopened_at?: string;
  reopened_by?: string;
  reopen_count?: number;
  assigned_buyer_id?: string;
}

export function FileRequestDetailsModal({ requestId, onClose, onUpdate }: FileRequestDetailsModalProps) {
  const { user } = useAuth();
  const [request, setRequest] = useState<FileRequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const [canvasMode, setCanvasMode] = useState<'view' | 'edit'>('view');

  // Upload state
  const [showUploadForm, setShowUploadForm] = useState(true); // Show by default for better UX
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadComments, setUploadComments] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Bulk actions state
  const [selectedUploads, setSelectedUploads] = useState<Set<string>>(new Set());
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);

  // Deadline editing state
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);
  const [newDeadline, setNewDeadline] = useState('');
  const [savingDeadline, setSavingDeadline] = useState(false);

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);

  // Subscribe to upload queue to refresh when uploads complete
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupQueueSubscription = async () => {
      const { uploadQueueManager } = await import('../services/uploadQueueManager');

      unsubscribe = uploadQueueManager.subscribe((queue) => {
        // Check if any uploads for this request just completed
        const requestUploads = queue.filter(task => task.requestId === requestId);
        const hasCompletedUploads = requestUploads.some(task => task.status === 'completed');

        if (hasCompletedUploads) {
          // Refresh request details to show newly uploaded files
          fetchRequestDetails();
        }
      });
    };

    setupQueueSubscription();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [requestId]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];

    // Process all dropped items (files and folders)
    const processItems = async () => {
      for (const item of items) {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            await traverseFileTree(entry, files);
          }
        }
      }
      setSelectedFiles(files);
    };

    processItems();
  };

  const traverseFileTree = async (item: any, files: File[]): Promise<void> => {
    return new Promise((resolve) => {
      if (item.isFile) {
        item.file((file: File) => {
          files.push(file);
          resolve();
        });
      } else if (item.isDirectory) {
        const dirReader = item.createReader();
        dirReader.readEntries(async (entries: any[]) => {
          for (const entry of entries) {
            await traverseFileTree(entry, files);
          }
          resolve();
        });
      }
    });
  };

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      const response = await fileRequestApi.getOne(requestId);
      setRequest(response.data.data);

      // Try to load canvas
      try {
        const canvasResponse = await fileRequestApi.canvas.get(requestId);
        if (canvasResponse.data.canvas && !canvasResponse.data.isTemplate) {
          setCanvas(canvasResponse.data.canvas);
        }
      } catch (canvasError) {
        // Canvas is optional, ignore error
        console.log('No canvas found for this request');
      }
    } catch (error: any) {
      console.error('Failed to fetch request details:', error);
      alert(error.response?.data?.error || 'Failed to fetch request details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const getPublicUrl = () => {
    if (!request) return '';
    return `${window.location.origin}/request/${request.request_token}`;
  };

  const handleCopyLink = () => {
    const url = getPublicUrl();
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const handleDownload = async (file: FileUpload) => {
    try {
      // Use authenticated fetch with Bearer token to download file
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const downloadUrl = `${API_BASE}/media/${file.file_id}/download`;
      const token = localStorage.getItem('token');

      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.original_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  const handleAddToLibrary = async (upload: FileUpload) => {
    try {
      // Add file to media library (makes it visible in the target folder)
      await mediaApi.addFileRequestUploadToLibrary(upload.file_id);
      alert(`"${upload.original_filename}" has been added to your Media Library in the target folder!`);

      // Refresh the request details to update the upload list
      await fetchRequestDetails();
    } catch (error: any) {
      console.error('Failed to add to library:', error);
      alert(error.response?.data?.error || 'Failed to add file to Media Library');
    }
  };

  // Bulk selection handlers
  const toggleSelectUpload = (uploadId: string) => {
    const newSelected = new Set(selectedUploads);
    if (newSelected.has(uploadId)) {
      newSelected.delete(uploadId);
    } else {
      newSelected.add(uploadId);
    }
    setSelectedUploads(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedUploads.size === request?.uploads.length) {
      setSelectedUploads(new Set());
    } else {
      setSelectedUploads(new Set(request?.uploads.map(u => u.id) || []));
    }
  };

  const handleBulkDownload = async () => {
    if (!request || selectedUploads.size === 0) return;

    setBulkActionInProgress(true);
    try {
      const uploadsToDownload = request.uploads.filter(u => selectedUploads.has(u.id));

      // Download each file using backend download endpoint
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      for (const upload of uploadsToDownload) {
        const downloadUrl = `${API_BASE}/media/${upload.file_id}/download`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = upload.original_filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Small delay between downloads to avoid browser blocking
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      alert(`Successfully initiated download for ${uploadsToDownload.length} file(s)!`);
    } catch (error) {
      console.error('Bulk download error:', error);
      alert('Failed to download files. Please try again.');
    } finally {
      setBulkActionInProgress(false);
    }
  };

  const handleBulkAddToLibrary = async () => {
    if (!request || selectedUploads.size === 0) return;

    setBulkActionInProgress(true);
    try {
      const uploadsToAdd = request.uploads.filter(u => selectedUploads.has(u.id));

      // Add each file to library (makes them visible in their target folders)
      const results = await Promise.allSettled(
        uploadsToAdd.map(upload =>
          mediaApi.addFileRequestUploadToLibrary(upload.file_id)
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed > 0) {
        alert(`Added ${successful} file(s) to Media Library in their target folders. ${failed} file(s) failed.`);
      } else {
        alert(`Successfully added ${successful} file(s) to your Media Library in their target folders!`);
      }

      // Clear selection and refresh to show updated status
      setSelectedUploads(new Set());
      await fetchRequestDetails();
    } catch (error: any) {
      console.error('Bulk add to library error:', error);
      alert('Failed to add files to Media Library. Please try again.');
    } finally {
      setBulkActionInProgress(false);
    }
  };

  const handleSaveDeadline = async () => {
    if (!request || !newDeadline) return;

    setSavingDeadline(true);
    try {
      await fileRequestApi.update(request.id, { deadline: newDeadline });
      alert('Deadline updated successfully!');
      setIsEditingDeadline(false);
      fetchRequestDetails(); // Refresh to show new deadline
    } catch (error: any) {
      console.error('Failed to update deadline:', error);
      alert(error.response?.data?.error || 'Failed to update deadline');
    } finally {
      setSavingDeadline(false);
    }
  };

  const handleCancelDeadlineEdit = () => {
    setIsEditingDeadline(false);
    setNewDeadline('');
  };

  const formatDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      const remainingHours = diffHours % 24;
      return `${diffDays}d ${remainingHours}h`;
    } else if (diffHours > 0) {
      const remainingMins = diffMins % 60;
      return `${diffHours}h ${remainingMins}m`;
    } else {
      return `${diffMins}m`;
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedFiles.length === 0) {
      setUploadError('Please select at least one file');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);

    try {
      // Import upload queue manager dynamically
      const { uploadQueueManager } = await import('../services/uploadQueueManager');

      // Add files to upload queue (will handle parallel uploads automatically)
      const taskIds = uploadQueueManager.addToQueue(
        selectedFiles,
        requestId,
        uploadComments || undefined
      );

      console.log(`Added ${selectedFiles.length} files to upload queue`, taskIds);

      // Show success message
      setUploadSuccess(true);
      setSelectedFiles([]);
      setUploadComments('');

      // Close form and refresh after short delay
      setTimeout(() => {
        setUploadSuccess(false);
        setShowUploadForm(false);
        fetchRequestDetails();
        onUpdate();
      }, 1500);
    } catch (error: any) {
      console.error('Upload failed:', error);
      setUploadError(error.response?.data?.error || 'Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Status transition handlers
  const handleMarkAsUploaded = async () => {
    if (!window.confirm('Mark this request as uploaded? This indicates that all files have been uploaded.')) return;

    try {
      await fileRequestApi.markAsUploaded(requestId);
      await fetchRequestDetails();
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to mark as uploaded');
    }
  };

  const handleLaunch = async () => {
    if (!window.confirm('Launch this request? This indicates acceptance of the uploaded files.')) return;

    try {
      await fileRequestApi.launch(requestId);
      await fetchRequestDetails();
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to launch request');
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Close this request? You can reopen it later if needed.')) return;

    try {
      await fileRequestApi.closeRequest(requestId);
      await fetchRequestDetails();
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to close request');
    }
  };

  const handleReopen = async () => {
    if (!window.confirm('Reopen this closed request?')) return;

    try {
      await fileRequestApi.reopenRequest(requestId);
      await fetchRequestDetails();
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reopen request');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <p className="text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!request) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {request.title}
              </h2>
              {getStatusBadge(request.status)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {request.upload_count} {request.upload_count === 1 ? 'file' : 'files'} uploaded
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Request Summary - Key Information */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">Request Summary</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {/* Media Buyer */}
              {request.creator_name && (
                <div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Requested By:</span>
                  <p className="text-blue-900 dark:text-blue-100">{request.creator_name}</p>
                  {request.creator_email && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">{request.creator_email}</p>
                  )}
                </div>
              )}

              {/* Number of Creatives */}
              {request.num_creatives_requested !== undefined && request.num_creatives_requested > 0 && (
                <div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Creatives Requested:</span>
                  <p className="text-blue-900 dark:text-blue-100">{request.num_creatives_requested}</p>
                </div>
              )}

              {/* Request Type */}
              {request.request_type && (
                <div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Type:</span>
                  <p className="text-blue-900 dark:text-blue-100 capitalize">{request.request_type}</p>
                </div>
              )}

              {/* Created Date */}
              <div>
                <span className="text-blue-700 dark:text-blue-300 font-medium">Created:</span>
                <p className="text-blue-900 dark:text-blue-100">{formatDate(request.created_at)}</p>
              </div>

              {/* Completed Date */}
              {request.completed_at && (
                <div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Completed:</span>
                  <p className="text-blue-900 dark:text-blue-100">{formatDate(request.completed_at)}</p>
                </div>
              )}

              {/* Total Time to Complete */}
              {request.time_to_complete_hours && (
                <div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Time to Complete:</span>
                  <p className="text-blue-900 dark:text-blue-100 font-semibold">{request.time_to_complete_hours} hours</p>
                </div>
              )}

              {/* Assigned To (Editors) */}
              {request.assigned_editors && request.assigned_editors.length > 0 && (
                <div className="col-span-2">
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Assigned To:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {request.assigned_editors.map((editor) => (
                      <div key={editor.id} className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">
                        <span className="text-sm text-blue-900 dark:text-blue-100">
                          {editor.display_name || editor.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Action Buttons */}
          {user && (
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Actions</h3>
              <div className="flex flex-wrap gap-2">
                {/* Mark as Uploaded - Only for assigned editors when status is open/in_progress */}
                {request.assigned_editors?.some(e => e.id === user.id) &&
                  (request.status === 'open' || request.status === 'in_progress') && (
                  <Button
                    onClick={handleMarkAsUploaded}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark as Uploaded
                  </Button>
                )}

                {/* Launch - Only for creator/assigned buyer when status is uploaded */}
                {(request.created_by === user.id || request.assigned_buyer_id === user.id) &&
                  request.status === 'uploaded' && (
                  <Button
                    onClick={handleLaunch}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Rocket className="w-4 h-4 mr-2" />
                    Launch
                  </Button>
                )}

                {/* Close - Only for creator/assigned buyer when status is launched */}
                {(request.created_by === user.id || request.assigned_buyer_id === user.id) &&
                  request.status === 'launched' && (
                  <Button
                    onClick={handleClose}
                    size="sm"
                    variant="outline"
                    className="border-gray-400 text-gray-700 dark:text-gray-300"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Close Request
                  </Button>
                )}

                {/* Reopen - Only for creator/assigned buyer when status is closed */}
                {(request.created_by === user.id || request.assigned_buyer_id === user.id) &&
                  request.status === 'closed' && (
                  <Button
                    onClick={handleReopen}
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reopen Request
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Canvas Brief */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Canvas Brief
              </h3>
            </div>
            <div className="flex gap-2">
              {canvas ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCanvasMode('view');
                      setShowCanvas(true);
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Canvas
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCanvasMode('edit');
                      setShowCanvas(true);
                    }}
                  >
                    Edit Canvas
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCanvasMode('edit');
                    setShowCanvas(true);
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Create Canvas Brief
                </Button>
              )}
            </div>
          </div>

          {/* Request Info */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
            {request.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{request.description}</p>
              </div>
            )}

            {request.custom_message && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Custom Message
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{request.custom_message}</p>
              </div>
            )}

            {request.assigned_editors && request.assigned_editors.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assigned Creatives ({request.num_creatives_requested || request.assigned_editors.length})
                </h3>
                <div className="space-y-2">
                  {request.assigned_editors.map((editor) => (
                    <div key={editor.id} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {editor.display_name || editor.name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(editor.assigned_at)}
                        {editor.assigned_by_name && ` by ${editor.assigned_by_name}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {request.delivery_note && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Delivery Note
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{request.delivery_note}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-gray-700 dark:text-gray-300">
                  Created: {formatDate(request.created_at)}
                </span>
              </div>

              {request.request_type && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    Type: <span className="font-medium capitalize">{request.request_type}</span>
                  </span>
                </div>
              )}

              {request.folder_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Folder className="w-4 h-4 text-muted-foreground" />
                  <span className="text-gray-700 dark:text-gray-300">{request.folder_name}</span>
                </div>
              )}

              {/* Deadline Section with Edit Capability */}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                {isEditingDeadline ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveDeadline}
                      disabled={savingDeadline || !newDeadline}
                    >
                      {savingDeadline ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelDeadlineEdit}
                      disabled={savingDeadline}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300">
                      Deadline: {request.deadline ? formatDate(request.deadline) : 'Not set'}
                    </span>
                    {user?.role !== 'creative' && (
                      <button
                        onClick={() => {
                          setIsEditingDeadline(true);
                          setNewDeadline(request.deadline || '');
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {request.require_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-gray-700 dark:text-gray-300">Email required</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-gray-700 dark:text-gray-300">
                  {request.allow_multiple_uploads ? 'Multiple uploads allowed' : 'Single upload only'}
                </span>
              </div>

              {request.picked_up_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Picked up: {formatDate(request.picked_up_at)}
                  </span>
                </div>
              )}

              {request.completed_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Completed: {formatDate(request.completed_at)}
                  </span>
                </div>
              )}

              {request.picked_up_at && request.completed_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    Duration: {formatDuration(request.picked_up_at, request.completed_at)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Public Link */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Public Upload Link
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={getPublicUrl()}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-sm"
              />
              <Button onClick={handleCopyLink}>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>

          {/* Direct Upload for Editors - Only editors/creatives can upload, not buyers */}
          {request.is_active && user?.role !== 'buyer' && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload Files {request.allow_multiple_uploads && '(Multiple files/folders allowed)'}
              </h3>

              {showUploadForm && (
                <form onSubmit={handleFileUpload} className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  {/* File Selection with Drag & Drop */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Files or Folder * {request.allow_multiple_uploads && '(Multiple files/folders allowed)'}
                    </label>

                    {/* Drag & Drop Zone */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative space-y-2 p-4 border-2 border-dashed rounded-lg transition-colors ${
                        isDragging
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {isDragging && (
                        <div className="absolute inset-0 flex items-center justify-center bg-blue-50/90 dark:bg-blue-900/40 rounded-lg pointer-events-none z-10">
                          <div className="text-center">
                            <UploadIcon className="w-12 h-12 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                            <p className="text-lg font-medium text-blue-700 dark:text-blue-300">
                              Drop files or folders here
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Regular file upload */}
                      <input
                        type="file"
                        multiple={request.allow_multiple_uploads}
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setSelectedFiles(files);
                        }}
                        className="w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-200"
                        disabled={uploading}
                      />

                      {/* Folder upload */}
                      {request.allow_multiple_uploads && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Or select entire folder:</span>
                          <input
                            type="file"
                            // @ts-ignore - webkitdirectory is not in TypeScript types but works in all modern browsers
                            webkitdirectory="true"
                            directory="true"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              setSelectedFiles(files);
                            }}
                            className="text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100 dark:file:bg-green-900 dark:file:text-green-200"
                            disabled={uploading}
                          />
                        </div>
                      )}

                      {/* Drag & Drop Hint */}
                      {request.allow_multiple_uploads && !isDragging && selectedFiles.length === 0 && (
                        <div className="text-center py-2 text-sm text-gray-500 dark:text-gray-400">
                          <UploadIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                          <p>Or drag and drop files/folders here</p>
                        </div>
                      )}
                    </div>
                    {selectedFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Selected {selectedFiles.length} file(s):
                        </p>
                        {selectedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            <span className="truncate">{file.name}</span>
                            <span className="text-xs text-gray-500 ml-2">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Comments */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Comments / Remarks (optional)
                    </label>
                    <textarea
                      value={uploadComments}
                      onChange={(e) => setUploadComments(e.target.value)}
                      placeholder="Add any notes about this upload..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      disabled={uploading}
                    />
                  </div>

                  {/* Error Message */}
                  {uploadError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <p className="text-sm text-red-800 dark:text-red-200">{uploadError}</p>
                    </div>
                  )}

                  {/* Success Message */}
                  {uploadSuccess && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-sm text-green-800 dark:text-green-200">
                          File uploaded successfully!
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={selectedFiles.length === 0 || uploading}
                    >
                      {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowUploadForm(false);
                        setSelectedFiles([]);
                        setUploadComments('');
                        setUploadError('');
                      }}
                      disabled={uploading}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Uploaded Files */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Uploaded Files ({request.uploads.length})
              </h3>

              {request.uploads.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUploads.size === request.uploads.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    Select All
                  </label>

                  {selectedUploads.size > 0 && (
                    <>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({selectedUploads.size} selected)
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkDownload}
                        disabled={bulkActionInProgress}
                      >
                        Download Selected
                      </Button>
                      {user?.role !== 'creative' && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={handleBulkAddToLibrary}
                          disabled={bulkActionInProgress}
                        >
                          Add Selected to Library
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {request.uploads.length > 0 ? (
              <div className="space-y-2">
                {request.uploads.map((upload) => (
                  <div key={upload.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedUploads.has(upload.id)}
                      onChange={() => toggleSelectUpload(upload.id)}
                      className="mt-3 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <div className="flex-1">
                      <UploadedFileCard
                        upload={upload}
                        onDownload={handleDownload}
                        onAddToLibrary={user?.role !== 'creative' ? handleAddToLibrary : undefined}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-muted-foreground">No files uploaded yet</p>
              </div>
            )}
          </div>

          {/* Upload History Timeline */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Upload History
            </h3>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <UploadHistoryTimeline requestId={requestId} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Canvas Modal */}
      {showCanvas && (
        canvasMode === 'edit' ? (
          <CanvasEditor
            requestId={requestId}
            onClose={() => {
              setShowCanvas(false);
              fetchRequestDetails(); // Refresh to get updated canvas
            }}
            onSave={(savedCanvas) => {
              setCanvas(savedCanvas);
            }}
          />
        ) : (
          canvas && (
            <CanvasRenderer
              content={canvas.content}
              attachments={canvas.attachments}
              onClose={() => setShowCanvas(false)}
              readOnly={true}
            />
          )
        )
      )}
    </div>
  );
}
