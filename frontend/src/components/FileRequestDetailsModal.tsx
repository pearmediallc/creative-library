import React, { useEffect, useState } from 'react';
import { X, Copy, Download, Calendar, Folder, Mail, CheckCircle, Clock, FileText } from 'lucide-react';
import { Button } from './ui/Button';
import { fileRequestApi } from '../lib/api';
import { formatDate, formatBytes } from '../lib/utils';
import { CanvasEditor } from './CanvasEditor';
import { CanvasRenderer } from './CanvasRenderer';
import type { Canvas } from '../lib/canvasTemplates';

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
  created_at: string;
  assigned_at?: string;
  picked_up_at?: string;
  completed_at?: string;
  delivery_note?: string;
  time_to_complete_hours?: string;
  uploads: FileUpload[];
  assigned_editors?: AssignedEditor[];
}

export function FileRequestDetailsModal({ requestId, onClose, onUpdate }: FileRequestDetailsModalProps) {
  const [request, setRequest] = useState<FileRequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const [canvasMode, setCanvasMode] = useState<'view' | 'edit'>('view');

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);

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

  const handleDownload = (file: FileUpload) => {
    const link = document.createElement('a');
    link.href = file.cloudfront_url;
    link.download = file.original_filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {request.title}
            </h2>
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
                    {request.assigned_editors.map((editor, index) => (
                      <div key={editor.id} className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">
                        <span className="text-sm text-blue-900 dark:text-blue-100">
                          {editor.display_name || editor.name}
                        </span>
                        {index === 0 && request.assigned_editors && request.assigned_editors.length > 1 && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">(Initial)</span>
                        )}
                        {index > 0 && (
                          <span className="text-xs text-orange-600 dark:text-orange-400">(Reassigned)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

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
                  {request.assigned_editors.map((editor, index) => (
                    <div key={editor.id} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {editor.display_name || editor.name}
                        </span>
                        {index === 0 && request.assigned_editors && request.assigned_editors.length > 1 && (
                          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Initial)</span>
                        )}
                        {index > 0 && (
                          <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">(Reassigned)</span>
                        )}
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

              {request.deadline && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Deadline: {formatDate(request.deadline)}
                  </span>
                </div>
              )}

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

          {/* Uploaded Files */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Uploaded Files ({request.uploads.length})
            </h3>

            {request.uploads.length > 0 ? (
              <div className="space-y-2">
                {request.uploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {/* Thumbnail */}
                    {upload.thumbnail_url ? (
                      <img
                        src={upload.thumbnail_url}
                        alt={upload.original_filename}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {upload.file_type.toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {upload.original_filename}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatBytes(upload.file_size)}</span>
                        <span>•</span>
                        <span>{formatDate(upload.created_at)}</span>
                        {upload.uploaded_by_email && (
                          <>
                            <span>•</span>
                            <span>{upload.uploaded_by_email}</span>
                          </>
                        )}
                        {upload.uploaded_by_name && (
                          <>
                            <span>•</span>
                            <span>{upload.uploaded_by_name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Download Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(upload)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-muted-foreground">No files uploaded yet</p>
              </div>
            )}
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
