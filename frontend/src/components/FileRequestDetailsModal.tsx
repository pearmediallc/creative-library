import React, { useEffect, useState } from 'react';
import { X, Copy, Calendar, Folder, Mail, CheckCircle, Clock, FileText, Upload as UploadIcon, Rocket, XCircle, RotateCcw, UserPlus, Edit2 } from 'lucide-react';
import { Button } from './ui/Button';
import { fileRequestApi, mediaApi } from '../lib/api';
import { formatDate } from '../lib/utils';
import { CanvasBrief3Step } from './CanvasBrief3Step';
import { UploadedFileCard } from './UploadedFileCard';
import { UploadHistoryTimeline } from './UploadHistoryTimeline';
import { ReassignFileRequestModal } from './ReassignFileRequestModal';
import { useAuth } from '../contexts/AuthContext';
import { getFileRequestStatusColor, getVerticalBadgeClasses } from '../constants/statusColors';

// Canvas Brief type
interface Canvas {
  id?: string;
  file_request_id: string;
  content: any;
  attachments?: any[];
  created_at?: string;
  updated_at?: string;
}

// Status badge helper using centralized colors
function getStatusBadge(status: string | undefined) {
  const statusColor = getFileRequestStatusColor(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor.full}`}>
      {statusColor.label}
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

interface AssignedEditor {
  id: string;
  name: string;
  display_name: string;
  assigned_at: string;
  status: string;
  assigned_by_name?: string;
  num_creatives_assigned?: number;  // 🆕 Creative distribution
  creatives_completed?: number;     // 🆕 Creative completion tracking
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
  auto_assigned_head?: string;
  reassignment_count?: number;
  // Fulfillment tracking
  fulfillment?: {
    total_assigned: number;
    completed: number;
    in_progress: number;
    pending: number;
    percent: number;
    text: string;
  };
  // Deliverables tracking (main branch feature)
  deliverables_required?: number;
  deliverables_type?: string;
  deliverables?: {
    required: number;
    uploaded: number;
    remaining: number;
    is_complete: boolean;
  };
  // 🆕 Multi-platform/vertical support
  platforms?: string[];
  verticals?: string[];
  platform?: string;  // Backward compatibility
  vertical?: string;  // Backward compatibility
}

export function FileRequestDetailsModal({ requestId, onClose, onUpdate }: FileRequestDetailsModalProps) {
  const { user } = useAuth();
  const [request, setRequest] = useState<FileRequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [show3StepCanvas, setShow3StepCanvas] = useState(false);

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

  // Reassignment state
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignments, setReassignments] = useState<any[]>([]);

  // Edit history state
  const [editHistory, setEditHistory] = useState<any[]>([]);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedRequest, setEditedRequest] = useState<any>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    fetchRequestDetails();
    fetchReassignments();
    fetchEditHistory();
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
        console.log('[Canvas Debug] Full canvas response:', JSON.stringify(canvasResponse.data, null, 2));
        console.log('[Canvas Debug] Has canvas?', !!canvasResponse.data.canvas);
        console.log('[Canvas Debug] isTemplate?', canvasResponse.data.isTemplate);

        if (canvasResponse.data.canvas && !canvasResponse.data.isTemplate) {
          console.log('[Canvas Debug] ✓ Setting canvas state - canvas exists and is not template');
          console.log('[Canvas Debug] Canvas content:', canvasResponse.data.canvas.content);
          setCanvas(canvasResponse.data.canvas);
        } else {
          console.log('[Canvas Debug] ✗ Not setting canvas state');
          console.log('[Canvas Debug] Reason:', !canvasResponse.data.canvas ? 'No canvas object' : 'Is template');
          setCanvas(null); // Explicitly set to null if no canvas exists
        }
      } catch (canvasError: any) {
        // Canvas is optional, ignore error
        console.log('[Canvas Debug] ✗ Canvas fetch error:', canvasError.message);
        console.log('[Canvas Debug] Error response:', canvasError.response?.data);
        setCanvas(null);
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

  const handleRemoveFromRequest = async (upload: FileUpload) => {
    if (!upload.upload_session_id) {
      alert('This upload cannot be removed (missing upload session id).');
      return;
    }

    const ok = window.confirm('Remove this upload from the request? (This will be tracked in history)');
    if (!ok) return;

    try {
      await fileRequestApi.deleteUploadSession(requestId, upload.upload_session_id);
      await fetchRequestDetails();
    } catch (error: any) {
      console.error('Failed to remove upload from request:', error);
      alert(error.response?.data?.error || 'Failed to remove upload');
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

  const fetchReassignments = async () => {
    try {
      const response = await fileRequestApi.getReassignments(requestId);
      setReassignments(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch reassignments:', error);
    }
  };

  const fetchEditHistory = async () => {
    try {
      const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api');
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/file-requests/${requestId}/edit-history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      setEditHistory(result.data || []);
    } catch (error: any) {
      console.error('Failed to fetch edit history:', error);
    }
  };

  const handleReassignSuccess = async () => {
    setShowReassignModal(false);
    await fetchRequestDetails();
    await fetchReassignments();
    onUpdate();
  };

  const handleEditRequest = () => {
    if (!request) return;
    setIsEditMode(true);
    setEditedRequest({
      title: request.title,
      concept_notes: request.description || '',
      num_creatives: request.num_creatives_requested || 0,
      request_type: request.request_type,
      deadline: request.deadline,
      platforms: request.platforms || [],
      verticals: request.verticals || []
    });
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedRequest({});
  };

  const handleSaveEdit = async () => {
    try {
      setIsSavingEdit(true);
      const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api');
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_BASE_URL}/file-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...editedRequest,
          edit_reason: 'Updated request details'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update request');
      }

      alert('Request updated successfully!');
      setIsEditMode(false);
      fetchRequestDetails();
      fetchEditHistory();
    } catch (error) {
      console.error('Error updating request:', error);
      alert('Failed to update request. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSave3StepCanvas = async (content: string, files: File[]) => {
    try {
      const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api');
      const token = localStorage.getItem('token');

      console.log('[Canvas Debug] Saving canvas content (string):', content);

      // Parse the content string back to object for API
      const contentObj = JSON.parse(content);
      console.log('[Canvas Debug] Parsed content (object):', contentObj);

      // Step 1: Save the canvas brief metadata
      const canvasSaveResponse = await fetch(`${API_BASE_URL}/file-requests/${requestId}/canvas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: contentObj })
      });

      console.log('[Canvas Debug] Canvas save response status:', canvasSaveResponse.status);
      const canvasSaveData = await canvasSaveResponse.json();
      console.log('[Canvas Debug] Canvas save response data:', canvasSaveData);

      if (!canvasSaveResponse.ok) {
        throw new Error(canvasSaveData.error || 'Failed to save canvas');
      }

      // Step 2: Upload reference files to "canvas brief reference" folder
      if (files.length > 0) {
        // Count how many samples were in the content before adding new files
        // This helps us know which samples in the array are the newly uploaded ones
        const samplesBeforeUpload = (contentObj.samples || []).length - files.length;

        // First, find or create the "canvas brief reference" folder
        const foldersResponse = await fetch(`${API_BASE_URL}/folders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const foldersData = await foldersResponse.json();

        let canvasFolderId = foldersData.data?.find((f: any) =>
          f.name.toLowerCase() === 'canvas brief reference'
        )?.id;

        // If folder doesn't exist, create it
        if (!canvasFolderId) {
          const createFolderResponse = await fetch(`${API_BASE_URL}/folders`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: 'Canvas Brief Reference' })
          });
          const createdFolder = await createFolderResponse.json();
          canvasFolderId = createdFolder.data.id;
        }

        // Get a valid editor_id (for canvas briefs, we need to find an active editor)
        // If user is a creative, get their editor ID, otherwise use the first assigned editor
        let editorId = '';
        if (user?.role === 'creative') {
          // Get editor profile for creative user
          try {
            const editorResponse = await fetch(`${API_BASE_URL}/editors`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const editorsData = await editorResponse.json();
            const userEditor = editorsData.data?.find((e: any) => e.user_id === user.id);
            if (userEditor) {
              editorId = userEditor.id;
            }
          } catch (err) {
            console.error('Failed to get editor:', err);
          }
        }

        // If still no editor_id, use the first assigned editor from the request
        if (!editorId && request?.assigned_editors && request.assigned_editors.length > 0) {
          editorId = request.assigned_editors[0].id;
        }

        // If still no editor, get any active editor as fallback
        if (!editorId) {
          try {
            const editorResponse = await fetch(`${API_BASE_URL}/editors`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const editorsData = await editorResponse.json();
            const firstEditor = editorsData.data?.find((e: any) => e.is_active);
            if (firstEditor) {
              editorId = firstEditor.id;
            }
          } catch (err) {
            console.error('Failed to get fallback editor:', err);
          }
        }

        // Create folder structure: Canvas Brief Reference / [Date] only
        const now = new Date();
        const dateFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Create dated subfolder under Canvas Brief Reference
        let dateFolderId = canvasFolderId;
        const dateFoldersResponse = await fetch(`${API_BASE_URL}/folders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const allFolders = await dateFoldersResponse.json();

        // Find or create date folder as child of Canvas Brief Reference folder
        const existingDateFolder = allFolders.data?.find((f: any) =>
          f.name === dateFolder && f.parent_id === canvasFolderId
        );

        if (existingDateFolder) {
          dateFolderId = existingDateFolder.id;
        } else {
          // Create date folder
          const createDateFolderResponse = await fetch(`${API_BASE_URL}/folders`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: dateFolder,
              parent_id: canvasFolderId
            })
          });
          const createdDateFolder = await createDateFolderResponse.json();
          dateFolderId = createdDateFolder.data.id;
        }

        // Upload files and collect their IDs
        const uploadedFileIds: string[] = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const instruction = contentObj.samples[samplesBeforeUpload + i]?.instruction || '';

          const formData = new FormData();
          formData.append('file', file);
          formData.append('editor_id', editorId);
          formData.append('folder_id', dateFolderId);  // Upload to date folder
          formData.append('description', `Canvas Brief - ${request?.title || 'Request'}: ${instruction}`);
          formData.append('tags', JSON.stringify(['canvas-brief', `request-${requestId}`, dateFolder]));

          const uploadResponse = await fetch(`${API_BASE_URL}/media/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            console.error('Upload failed:', errorData);
            throw new Error(`Failed to upload ${file.name}: ${errorData.error || 'Unknown error'}`);
          }

          const uploadData = await uploadResponse.json();
          uploadedFileIds.push(uploadData.data.file.id);
        }

        // Update canvas samples with file IDs
        if (uploadedFileIds.length > 0) {
          const updatedContent = { ...contentObj };
          // Ensure samples array exists
          if (!updatedContent.samples) {
            updatedContent.samples = [];
          }
          // Add file_id to the newly uploaded samples
          for (let i = 0; i < uploadedFileIds.length; i++) {
            const sampleIndex = samplesBeforeUpload + i;
            if (updatedContent.samples[sampleIndex]) {
              updatedContent.samples[sampleIndex].file_id = uploadedFileIds[i];
              console.log(`[Canvas Debug] Added file_id ${uploadedFileIds[i]} to sample at index ${sampleIndex}`);
            } else {
              console.warn(`[Canvas Debug] No sample found at index ${sampleIndex} for file_id ${uploadedFileIds[i]}`);
            }
          }

          console.log('[Canvas Debug] Updating canvas with file IDs:', uploadedFileIds);

          // Update canvas with file IDs
          const updateResponse = await fetch(`${API_BASE_URL}/file-requests/${requestId}/canvas`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: updatedContent })
          });

          if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            console.error('[Canvas Debug] Failed to update canvas with file IDs:', errorData);
            // Don't throw - files are already uploaded, just log the error
          } else {
            console.log('[Canvas Debug] Successfully updated canvas with file IDs');
          }
        }
      }

      alert('Canvas Brief saved successfully!');
      setShow3StepCanvas(false);
      fetchRequestDetails(); // Refresh to show updated canvas
    } catch (error: any) {
      console.error('Error saving canvas:', error);
      alert(`Failed to save canvas: ${error.message || 'Please try again.'}`);
    }
  };

  const handleDuplicateRequest = async () => {
    try {
      const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api');
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/file-requests/${requestId}/duplicate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate request');
      }

      const result = await response.json();

      // Show success message
      alert(`Request duplicated successfully! New request ID: ${result.data.id}`);

      // Refresh and notify parent
      onUpdate();
      onClose();

    } catch (error) {
      console.error('Error duplicating request:', error);
      alert('Failed to duplicate request. Please try again.');
    }
  };

  // Determine if user can reassign
  const canReassign = user && request && (
    user.role === 'admin' ||
    request.auto_assigned_head === user.id
  );

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
              {request.deliverables || request.fulfillment ? (
                <span className="space-y-0.5 block">
                  {request.deliverables && (
                    <span className="block">
                      Deliverables: {request.deliverables.uploaded}/{request.deliverables.required}
                      {request.deliverables.remaining > 0 ? ` • ${request.deliverables.remaining} remaining` : ''}
                      {request.deliverables.is_complete ? ' (complete)' : ''}
                    </span>
                  )}
                  {request.fulfillment && (
                    <span className="block">
                      Editors: {request.fulfillment.text} completed
                      {request.fulfillment.in_progress ? ` • ${request.fulfillment.in_progress} in progress` : ''}
                      {request.fulfillment.pending ? ` • ${request.fulfillment.pending} pending` : ''}
                    </span>
                  )}
                </span>
              ) : (
                <span>
                  {request.upload_count} {request.upload_count === 1 ? 'file' : 'files'} uploaded
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                {/* Save Button */}
                <button
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSavingEdit ? 'Saving...' : 'Save'}
                </button>
                {/* Cancel Button */}
                <button
                  onClick={handleCancelEdit}
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {/* Edit Button - Only for buyers and admins */}
                {(user?.role === 'buyer' || user?.role === 'admin') &&
                 request.status !== 'closed' && request.status !== 'launched' && (
                  <button
                    onClick={() => handleEditRequest()}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Edit Request"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}

                {/* Duplicate Button - Only for buyers and admins */}
                {(user?.role === 'buyer' || user?.role === 'admin') && (
                  <button
                    onClick={() => handleDuplicateRequest()}
                    className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 rounded-lg transition-colors"
                    title="Duplicate Request"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </>
            )}

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
              {(request.num_creatives_requested !== undefined && request.num_creatives_requested > 0) || isEditMode ? (
                <div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Creatives Requested:</span>
                  {isEditMode ? (
                    <input
                      type="number"
                      value={editedRequest.num_creatives || ''}
                      onChange={(e) => setEditedRequest({ ...editedRequest, num_creatives: parseInt(e.target.value) || 0 })}
                      className="mt-1 w-full px-2 py-1 text-sm border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-800 text-blue-900 dark:text-blue-100"
                      min="1"
                    />
                  ) : (
                    <p className="text-blue-900 dark:text-blue-100">{request.num_creatives_requested}</p>
                  )}
                </div>
              ) : null}

              {/* Request Type */}
              {(request.request_type || isEditMode) && (
                <div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Type:</span>
                  {isEditMode ? (
                    <select
                      value={editedRequest.request_type || ''}
                      onChange={(e) => setEditedRequest({ ...editedRequest, request_type: e.target.value })}
                      className="mt-1 w-full px-2 py-1 text-sm border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-800 text-blue-900 dark:text-blue-100"
                    >
                      <option value="UGC">UGC</option>
                      <option value="Special Request">Special Request</option>
                      <option value="Static">Static</option>
                      <option value="Video">Video</option>
                    </select>
                  ) : (
                    <p className="text-blue-900 dark:text-blue-100 capitalize">{request.request_type}</p>
                  )}
                </div>
              )}

              {/* Platforms */}
              {(request.platforms && request.platforms.length > 0) || request.platform ? (
                <div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Platforms:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(request.platforms || (request.platform ? [request.platform] : [])).map((platform, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100">
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Verticals */}
              {(request.verticals && request.verticals.length > 0) || request.vertical ? (
                <div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Verticals:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(request.verticals || (request.vertical ? [request.vertical] : [])).map((vertical, idx) => (
                      <span key={idx} className={getVerticalBadgeClasses(vertical)}>
                        {vertical}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

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

                {/* Close step removed: Launch is equivalent to Close in this workflow */}

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

                {/* Reassign - Only for vertical head or assigned editors */}
                {canReassign && request.status !== 'closed' && (
                  <Button
                    onClick={() => setShowReassignModal(true)}
                    size="sm"
                    variant="outline"
                    className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Reassign
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Reassignment History */}
          {reassignments.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Reassignment History ({reassignments.length} {reassignments.length === 1 ? 'change' : 'changes'})
              </h4>

              {/* Current Assignments Section */}
              {request.assigned_editors && request.assigned_editors.length > 0 && (
                <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-3">
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Currently Assigned:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {request.assigned_editors.map((editor: any) => (
                      <span
                        key={editor.id}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100"
                      >
                        {editor.display_name || editor.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* History Timeline */}
              <div className="space-y-2">
                {reassignments.map((r: any, index: number) => (
                  <div key={r.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 relative">
                    {/* Timeline connector */}
                    {index < reassignments.length - 1 && (
                      <div className="absolute left-3 top-full h-2 w-0.5 bg-gray-300 dark:bg-gray-600" />
                    )}

                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-200">
                          <strong className="text-gray-900 dark:text-white">{r.from_name}</strong>
                          <span className="text-gray-500 dark:text-gray-400"> → </span>
                          <strong className="text-blue-600 dark:text-blue-400">{r.to_name}</strong>
                        </p>
                        {r.reassignment_note && (
                          <div className="mt-1.5 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded px-2 py-1 border border-gray-200 dark:border-gray-700">
                            <span className="font-medium">Note: </span>
                            <span className="italic whitespace-pre-wrap">{r.reassignment_note}</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(r.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Canvas Brief */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Canvas Brief
              </h3>
              {canvas?.created_at && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Created: {formatDate(canvas.created_at)}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {canvas ? (
                <>
                  {/* Edit Canvas - Only buyers and admins can edit */}
                  {(user?.role === 'buyer' || user?.role === 'admin') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShow3StepCanvas(true)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Edit Canvas
                    </Button>
                  )}
                  {/* View-only for creatives */}
                  {user?.role === 'creative' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShow3StepCanvas(true)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Canvas
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {/* Create Canvas - Only buyers and admins can create */}
                  {(user?.role === 'buyer' || user?.role === 'admin') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShow3StepCanvas(true)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Create Canvas Brief
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Canvas Brief Content Summary */}
            {canvas && (() => {
              try {
                const content = typeof canvas.content === 'string' ? JSON.parse(canvas.content) : canvas.content;
                return (
                  <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    {content.headline && (
                      <div className="mb-3">
                        <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">HEADLINE</h4>
                        <p className="text-sm text-blue-900 dark:text-blue-100">{content.headline}</p>
                      </div>
                    )}
                    {content.script && (
                      <div className="mb-3">
                        <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">SCRIPT</h4>
                        <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap">{content.script}</p>
                      </div>
                    )}
                    {content.samples && content.samples.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">REFERENCE SAMPLES ({content.samples.length})</h4>
                        <div className="space-y-2">
                          {content.samples.map((sample: any, idx: number) => (
                            <div key={idx} className="bg-white dark:bg-gray-800 rounded p-2 border border-blue-200 dark:border-blue-700">
                              <p className="text-xs font-medium text-gray-900 dark:text-white">{sample.filename}</p>
                              {sample.instruction && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{sample.instruction}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              } catch (e) {
                console.error('Failed to parse canvas content:', e);
                return null;
              }
            })()}
          </div>

          {/* Request Info */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
            {(request.description || isEditMode) && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </h3>
                {isEditMode ? (
                  <textarea
                    value={editedRequest.concept_notes || ''}
                    onChange={(e) => setEditedRequest({ ...editedRequest, concept_notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    rows={4}
                    placeholder="Enter request description..."
                  />
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{request.description}</p>
                )}
              </div>
            )}

            {request.custom_message && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Custom Message
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{request.custom_message}</p>
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
                      <div className="flex-1">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {editor.display_name || editor.name}
                        </span>
                        {/* Creative Distribution Display with Progress Bar */}
                        {editor.num_creatives_assigned !== undefined && editor.num_creatives_assigned > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 dark:text-gray-400">
                                Progress: <span className="font-medium text-blue-600 dark:text-blue-400">{editor.creatives_completed || 0}/{editor.num_creatives_assigned}</span> creatives
                              </span>
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {Math.round(((editor.creatives_completed || 0) / editor.num_creatives_assigned) * 100)}%
                              </span>
                            </div>
                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  editor.creatives_completed === editor.num_creatives_assigned
                                    ? 'bg-green-600'
                                    : editor.creatives_completed && editor.creatives_completed > 0
                                    ? 'bg-yellow-500'
                                    : 'bg-gray-400'
                                }`}
                                style={{ width: `${Math.round(((editor.creatives_completed || 0) / editor.num_creatives_assigned) * 100)}%` }}
                              />
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {editor.creatives_completed === editor.num_creatives_assigned ? (
                                <span className="text-green-600 dark:text-green-400 font-medium">✓ Completed</span>
                              ) : editor.creatives_completed && editor.creatives_completed > 0 ? (
                                <span className="text-yellow-600 dark:text-yellow-400">In Progress</span>
                              ) : (
                                <span>Not Started</span>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Per-Editor Notes */}
                        {editor.reassignment_notes && (
                          <div className="mt-2 text-xs">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Notes: </span>
                            <span className="text-gray-600 dark:text-gray-400 italic whitespace-pre-wrap">
                              {editor.reassignment_notes}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                        {formatDate(editor.assigned_at)}
                        {editor.assigned_by_name && (
                          <div className="mt-0.5">by {editor.assigned_by_name}</div>
                        )}
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

              {request.launched_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Rocket className="w-4 h-4 text-green-500" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Launched: {formatDate(request.launched_at)}
                  </span>
                </div>
              )}

              {request.closed_at && (
                <div className="flex items-center gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Closed: {formatDate(request.closed_at)}
                  </span>
                </div>
              )}

              {request.reopened_at && (
                <div className="flex items-center gap-2 text-sm">
                  <RotateCcw className="w-4 h-4 text-orange-500" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Reopened: {formatDate(request.reopened_at)} {request.reopen_count ? `(${request.reopen_count} times)` : ''}
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
                        onRemoveFromRequest={user?.role === 'creative' ? handleRemoveFromRequest : undefined}
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

          {/* Edit History Timeline */}
          {editHistory.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Edit History
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
                {editHistory.map((edit: any) => (
                  <div key={edit.id} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {edit.edited_by_name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(edit.edited_at)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      {Object.keys(edit.changes).map((field: string) => (
                        <div key={field}>
                          <span className="font-medium capitalize">{field.replace(/_/g, ' ')}:</span>
                          <span className="text-red-600 dark:text-red-400 line-through ml-2">
                            {JSON.stringify(edit.previous_values[field])}
                          </span>
                          <span className="text-green-600 dark:text-green-400 ml-2">
                            {JSON.stringify(edit.changes[field])}
                          </span>
                        </div>
                      ))}
                      {edit.edit_reason && (
                        <div className="mt-2 italic text-gray-500">
                          Reason: {edit.edit_reason}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Reassignment Modal - multi-editor with creative distribution */}
      {showReassignModal && request && (
        <ReassignFileRequestModal
          requestId={requestId}
          requestTitle={request.title}
          currentEditors={
            request.assigned_editors
              ? request.assigned_editors.map(e => ({ id: e.id, name: e.display_name || e.name }))
              : []
          }
          numCreatives={request.num_creatives_requested || 0}
          onClose={() => setShowReassignModal(false)}
          onSuccess={handleReassignSuccess}
        />
      )}

      {/* 3-Step Canvas Brief Modal */}
      {show3StepCanvas && (
        <CanvasBrief3Step
          requestId={requestId}
          initialContent={
            canvas?.content
              ? typeof canvas.content === 'string'
                ? canvas.content
                : JSON.stringify(canvas.content)
              : undefined
          }
          onSave={handleSave3StepCanvas}
          onClose={() => setShow3StepCanvas(false)}
          readOnly={user?.role === 'creative'}
        />
      )}
    </div>
  );
}
