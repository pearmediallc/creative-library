import React, { useState, useEffect } from 'react';
import {
  X, Upload, CheckCircle, RefreshCw, UserPlus, FileText,
  ChevronDown, ChevronUp, Paperclip, FolderOpen, Users,
  Loader2, AlertCircle
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { launchRequestApi, editorApi, authApi } from '../lib/api';
import { formatDateTime, formatDate } from '../lib/utils';
import { getLaunchRequestStatusBadgeClasses } from '../constants/statusColors';
import { getVerticalBadgeClasses } from '../constants/statusColors';
import { useAuth } from '../contexts/AuthContext';
import { CanvasEditor } from './CanvasEditor';

interface Editor {
  id: string;
  editor_user_id?: string;  // user_id from editors table (from getOne query)
  editor_name?: string;
  display_name?: string;
  num_creatives_assigned?: number;
  creatives_completed?: number;
  editor_status?: string;
}

interface BuyerAssignment {
  id: string;
  buyer_id: string;
  buyer_name?: string;
  buyer_email?: string;
  run_qty?: number;
  test_deadline?: string;
  status?: string;
  assigned_file_ids?: string[];
}

interface UploadFile {
  id: string;
  original_filename?: string;
  s3_url?: string;
  file_size?: number;
  mime_type?: string;
  uploader_name?: string;
  created_at: string;
  comments?: string;
}

interface LaunchRequest {
  id: string;
  title?: string;
  request_type?: string;
  concept_notes?: string;
  num_creatives?: number;
  suggested_run_qty?: number;
  notes_to_creative?: string;
  notes_to_buyer?: string;
  platforms?: string[];
  verticals?: string[];
  primary_vertical?: string;
  delivery_deadline?: string;
  test_deadline?: string;
  committed_run_qty?: number;
  committed_test_deadline?: string;
  creative_head_id?: string;
  creative_head_name?: string;
  buyer_head_id?: string;
  buyer_head_name?: string;
  strategist_name?: string;
  created_by?: string;
  created_at: string;
  status: string;
  editors?: Editor[];
  buyers?: BuyerAssignment[];
  uploads?: UploadFile[];
  reassignments?: any[];
  upload_count?: number;
}

interface Props {
  request: LaunchRequest;
  onClose: () => void;
  onUpdate: () => void;
}

export function LaunchRequestDetailsModal({ request: initialRequest, onClose, onUpdate }: Props) {
  const { user } = useAuth();
  const [request, setRequest] = useState<LaunchRequest>(initialRequest);
  const [loading, setLoading] = useState(true); // true until getOne resolves
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  // ── reassign state ────────────────────────────────────────────────────────
  const [showReassignCreative, setShowReassignCreative] = useState(false);
  const [showReassignBuyer, setShowReassignBuyer] = useState(false);
  const [newCreativeHeadId, setNewCreativeHeadId] = useState('');
  const [newBuyerHeadId, setNewBuyerHeadId] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  // ── buyer commit state ────────────────────────────────────────────────────
  const [showBuyerCommit, setShowBuyerCommit] = useState(false);
  const [committedRunQty, setCommittedRunQty] = useState(String(request.committed_run_qty || ''));
  const [committedTestDeadline, setCommittedTestDeadline] = useState(
    request.committed_test_deadline ? request.committed_test_deadline.slice(0, 16) : ''
  );
  const [buyerAssignments, setBuyerAssignments] = useState<Array<{
    buyer_id: string; buyer_name: string; run_qty: string; test_deadline: string; selected_files: string[];
  }>>([]);

  // ── canvas state ──────────────────────────────────────────────────────────
  const [showCanvas, setShowCanvas] = useState(false);

  // ── upload state (drag/drop, multiple files, folder) ─────────────────────
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadComment, setUploadComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ── upload queue (progress sidebar) ──────────────────────────────────────
  const [uploadQueue, setUploadQueue] = useState<Array<{ name: string; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string }>>([]);
  const [showUploadQueue, setShowUploadQueue] = useState(false);

  // ── buyer file access / testing assignment ────────────────────────────────
  const [selectedUploadIds, setSelectedUploadIds] = useState<string[]>([]);
  const [showTestingAssign, setShowTestingAssign] = useState(false);
  const [testingBuyerId, setTestingBuyerId] = useState('');
  const [testingDueDate, setTestingDueDate] = useState('');
  const [testingAssigning, setTestingAssigning] = useState(false);

  // ── assign editors state ──────────────────────────────────────────────────
  const [showAssignEditors, setShowAssignEditors] = useState(false);
  const [availableEditors, setAvailableEditors] = useState<any[]>([]);
  const [editorDistribution, setEditorDistribution] = useState<Array<{ editor_id: string; num_creatives: number }>>([]);

  // ── data ──────────────────────────────────────────────────────────────────
  const [availableBuyers, setAvailableBuyers] = useState<any[]>([]);
  const [availableCreativeUsers, setAvailableCreativeUsers] = useState<any[]>([]);
  const [showSection, setShowSection] = useState<Record<string, boolean>>({
    summary: true, creative: true, buyer: false, uploads: false, history: false
  });

  const toggleSection = (key: string) =>
    setShowSection(s => ({ ...s, [key]: !s[key] }));

  // ── fetch fresh data ──────────────────────────────────────────────────────
  const refresh = async () => {
    try {
      const res = await launchRequestApi.getOne(request.id);
      setRequest(res.data.data);
    } catch (err) {
      console.error('Failed to refresh:', err);
    }
  };

  // Load full request + supporting data on mount
  // (list query returns summary only — editors array with editor_user_id requires getOne)
  useEffect(() => {
    const loadData = async () => {
      try {
        const [fullReqRes, buyersRes, creativeRes, editorsRes] = await Promise.all([
          launchRequestApi.getOne(initialRequest.id),
          authApi.getBuyers(),
          authApi.getUsersByRole('creative'),
          editorApi.getAll()
        ]);
        setRequest(fullReqRes.data.data);
        setAvailableBuyers(buyersRes.data.data || buyersRes.data || []);
        setAvailableCreativeUsers(creativeRes.data.data || creativeRes.data || []);
        setAvailableEditors(editorsRes.data.data || editorsRes.data || []);
      } catch (err) {
        console.error('Failed to load modal data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [initialRequest.id]);

  const isAdmin = user?.role === 'admin';
  const isCreativeHead = user?.id === request.creative_head_id;
  const isBuyerHead = user?.id === request.buyer_head_id;
  const isStrategist = user?.id === request.created_by || isAdmin;
  const isBuyer = user?.role === 'buyer';

  // ── action handlers ───────────────────────────────────────────────────────

  const doAction = async (action: string, fn: () => Promise<any>) => {
    setActionLoading(action);
    setError('');
    try {
      await fn();
      await refresh();
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed: ${action}`);
    } finally {
      setActionLoading('');
    }
  };

  const handleSubmit = () => doAction('submit', () => launchRequestApi.submit(request.id));
  const handleAccept = () => doAction('accept', () => launchRequestApi.acceptByCreativeHead(request.id));
  const handleMarkReady = () => doAction('mark-ready', () => launchRequestApi.markReadyToLaunch(request.id));
  const handleLaunch = () => doAction('launch', () => launchRequestApi.launch(request.id));
  const handleClose = () => doAction('close', () => launchRequestApi.close(request.id));
  const handleReopen = () => doAction('reopen', () => launchRequestApi.reopen(request.id));

  const handleReassignCreative = async () => {
    if (!newCreativeHeadId) return;
    await doAction('reassign-creative', () =>
      launchRequestApi.reassignCreativeHead(request.id, { new_creative_head_id: newCreativeHeadId, reason: reassignReason })
    );
    setShowReassignCreative(false);
    setNewCreativeHeadId('');
    setReassignReason('');
  };

  const handleReassignBuyer = async () => {
    if (!newBuyerHeadId) return;
    await doAction('reassign-buyer', () =>
      launchRequestApi.reassignBuyerHead(request.id, { new_buyer_head_id: newBuyerHeadId, reason: reassignReason })
    );
    setShowReassignBuyer(false);
    setNewBuyerHeadId('');
    setReassignReason('');
  };

  const handleAssignBuyers = async () => {
    const assignments = buyerAssignments.map(a => ({
      buyer_id: a.buyer_id,
      file_ids: a.selected_files,
      run_qty: a.run_qty ? Number(a.run_qty) : undefined,
      test_deadline: a.test_deadline || undefined
    }));
    await doAction('assign-buyers', () =>
      launchRequestApi.assignBuyers(request.id, {
        buyer_assignments: assignments,
        committed_run_qty: committedRunQty ? Number(committedRunQty) : undefined,
        committed_test_deadline: committedTestDeadline || undefined
      })
    );
    setShowBuyerCommit(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);

    // Initialize queue
    const queue = selectedFiles.map(f => ({ name: f.name, status: 'pending' as const }));
    setUploadQueue(queue);
    setShowUploadQueue(true);

    let anyError = false;
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      // Mark current file as uploading
      setUploadQueue(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'uploading' } : item
      ));
      try {
        await launchRequestApi.upload(request.id, file, uploadComment);
        setUploadQueue(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'done' } : item
        ));
      } catch (err: any) {
        const errMsg = err.response?.data?.error || 'Upload failed';
        setUploadQueue(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'error', error: errMsg } : item
        ));
        anyError = true;
      }
    }

    setSelectedFiles([]);
    setUploadComment('');
    if (!anyError) {
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } else {
      setUploadError('Some files failed to upload. Check the queue for details.');
    }
    await refresh();
    onUpdate();
    setUploading(false);
    // Auto-hide queue after 5s if all done
    if (!anyError) {
      setTimeout(() => setShowUploadQueue(false), 5000);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setSelectedFiles(prev => [...prev, ...files]);
  };

  // Assign selected files to a buyer for testing (uses existing assignBuyers endpoint)
  const handleTestingAssign = async () => {
    if (!testingBuyerId || selectedUploadIds.length === 0) return;
    setTestingAssigning(true);
    try {
      // Merge with existing buyer assignments — add/update this buyer's files
      const existingBuyers = (request.buyers || []).map(b => ({
        buyer_id: b.buyer_id,
        file_ids: (b.assigned_file_ids || []).map(String),
        run_qty: b.run_qty,
        test_deadline: b.test_deadline || undefined
      }));
      // Find if buyer already exists in assignments
      const existingIdx = existingBuyers.findIndex(b => b.buyer_id === testingBuyerId);
      if (existingIdx >= 0) {
        // Merge file IDs (deduplicate)
        const merged = Array.from(new Set([...existingBuyers[existingIdx].file_ids, ...selectedUploadIds]));
        existingBuyers[existingIdx] = {
          ...existingBuyers[existingIdx],
          file_ids: merged,
          test_deadline: testingDueDate || existingBuyers[existingIdx].test_deadline
        };
      } else {
        existingBuyers.push({
          buyer_id: testingBuyerId,
          file_ids: selectedUploadIds,
          run_qty: undefined,
          test_deadline: testingDueDate || undefined
        });
      }
      await launchRequestApi.assignBuyers(request.id, { buyer_assignments: existingBuyers });
      await refresh();
      onUpdate();
      setSelectedUploadIds([]);
      setShowTestingAssign(false);
      setTestingBuyerId('');
      setTestingDueDate('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign files');
    } finally {
      setTestingAssigning(false);
    }
  };

  const handleAssignEditors = async () => {
    if (editorDistribution.length === 0) return;
    await doAction('assign-editors', () =>
      launchRequestApi.assignEditors(request.id, { editor_distribution: editorDistribution })
    );
    setShowAssignEditors(false);
    setEditorDistribution([]);
  };

  // init buyer assignments when opening commit panel
  useEffect(() => {
    if (showBuyerCommit && request.buyers) {
      setBuyerAssignments(
        (request.buyers || []).map(b => ({
          buyer_id: b.buyer_id,
          buyer_name: b.buyer_name || '',
          run_qty: String(b.run_qty || ''),
          test_deadline: b.test_deadline ? b.test_deadline.slice(0, 16) : '',
          selected_files: b.assigned_file_ids?.map(String) || []
        }))
      );
    }
  }, [showBuyerCommit]);

  const statusLabel = (request.status || 'draft').replace(/_/g, ' ');

  // ── progress bar helper ───────────────────────────────────────────────────
  const ProgressBar = ({ uploaded, total }: { uploaded: number; total: number }) => {
    const pct = total > 0 ? Math.min(100, Math.round((uploaded / total) * 100)) : 0;
    const barColor = pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-blue-500';
    return (
      <div className="min-w-[100px]">
        <div className="flex justify-between text-xs mb-1">
          <span>{uploaded}/{total}</span>
          <span className="font-medium">{pct}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div className={`${barColor} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  const SectionHeader = ({ title, sectionKey }: { title: string; sectionKey: string }) => (
    <button
      className="flex items-center justify-between w-full py-2 text-sm font-semibold text-left"
      onClick={() => toggleSection(sectionKey)}
    >
      <span>{title}</span>
      {showSection[sectionKey] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );

  // Loading spinner shown while getOne resolves
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background rounded-xl p-8 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  // Canvas brief overlay — renders on top of everything
  if (showCanvas) {
    return (
      <CanvasEditor
        requestId={request.id}
        canvasApiOverride={launchRequestApi.canvas}
        onClose={() => setShowCanvas(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-background rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-3xl max-h-[90vh] flex flex-col">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between p-6 border-b shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={getLaunchRequestStatusBadgeClasses(request.status)}>
                {statusLabel}
              </span>
              {request.platforms?.map((p, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {p}
                </span>
              ))}
              {request.verticals?.map((v, i) => (
                <span key={i} className={getVerticalBadgeClasses(v)}>{v}</span>
              ))}
            </div>
            <h2 className="text-lg font-semibold mt-2 truncate">
              {request.title || request.request_type || 'Launch Request'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              By {request.strategist_name || 'Strategist'} · {formatDateTime(request.created_at)}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-6 mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg">{error}</div>
          )}

          {/* ─── Action Buttons ─────────────────────────────────────────── */}
          <div className="px-6 py-4 border-b flex flex-wrap gap-2">
            {/* Strategist: submit draft */}
            {isStrategist && request.status === 'draft' && (
              <Button size="sm" onClick={handleSubmit} disabled={!!actionLoading}>
                {actionLoading === 'submit' ? 'Submitting...' : 'Submit for Review'}
              </Button>
            )}

            {/* Creative head: accept — only admin/creative role, never buyer */}
            {(isCreativeHead || isAdmin) && user?.role !== 'buyer' && request.status === 'pending_review' && (
              <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={handleAccept} disabled={!!actionLoading}>
                {actionLoading === 'accept' ? 'Accepting...' : 'Accept (Start Production)'}
              </Button>
            )}

            {/* Upload Creative panel is shown inline below the action bar (always visible for non-buyers during in_production) */}

            {/* Creative head (or admin): mark ready to launch — only admin/creative role, never buyer */}
            {(isCreativeHead || isAdmin) && user?.role !== 'buyer' && request.status === 'in_production' && (
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleMarkReady} disabled={!!actionLoading}>
                {actionLoading === 'mark-ready' ? 'Saving...' : 'Mark Ready to Launch'}
              </Button>
            )}

            {/* Buyer head: assign files to buyers */}
            {(isBuyerHead || isAdmin) && request.status === 'ready_to_launch' && (
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowBuyerCommit(v => !v)}>
                <UserPlus className="w-4 h-4 mr-1.5" />
                {showBuyerCommit ? 'Hide Assignment' : 'Assign to Buyers'}
              </Button>
            )}

            {/* Buyer: mark launched */}
            {(isBuyer || isAdmin) && request.status === 'buyer_assigned' && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleLaunch} disabled={!!actionLoading}>
                {actionLoading === 'launch' ? 'Launching...' : 'Mark Launched'}
              </Button>
            )}

            {/* Close */}
            {(isAdmin || isStrategist) && request.status === 'launched' && (
              <Button size="sm" variant="outline" onClick={handleClose} disabled={!!actionLoading}>
                {actionLoading === 'close' ? 'Closing...' : 'Close Request'}
              </Button>
            )}

            {/* Reopen */}
            {(isAdmin || isStrategist) && request.status === 'closed' && (
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleReopen} disabled={!!actionLoading}>
                <RefreshCw className="w-4 h-4 mr-1.5" />
                {actionLoading === 'reopen' ? 'Reopening...' : 'Reopen'}
              </Button>
            )}

            {/* Creative head: assign/reassign editors */}
            {(isCreativeHead || isAdmin) && user?.role !== 'buyer' && !['closed', 'launched'].includes(request.status) && (
              <Button size="sm" variant="outline" onClick={() => setShowAssignEditors(v => !v)}>
                <Users className="w-4 h-4 mr-1.5" />
                {showAssignEditors ? 'Hide Editor Assignment' : 'Assign Editors'}
              </Button>
            )}

            {/* Reassign creative head — only admin/creative role */}
            {(isCreativeHead || isAdmin) && user?.role !== 'buyer' && !['closed'].includes(request.status) && (
              <Button size="sm" variant="outline" onClick={() => setShowReassignCreative(v => !v)}>
                Reassign Creative Head
              </Button>
            )}

            {/* Reassign buyer head */}
            {(isBuyerHead || isAdmin) && !['closed'].includes(request.status) && (
              <Button size="sm" variant="outline" onClick={() => setShowReassignBuyer(v => !v)}>
                Reassign Buyer Head
              </Button>
            )}
          </div>

          {/* ─── Upload Panel (always visible for non-buyers in_production) ── */}
          {user?.role !== 'buyer' && request.status === 'in_production' && (
            <div className="mx-6 mt-4">
              <form onSubmit={handleUpload} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                <h4 className="text-sm font-semibold">Upload Creative Files</h4>

                {/* Drag & Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative p-4 border-2 border-dashed rounded-lg transition-colors ${
                    isDragging ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  {isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/5 rounded-lg pointer-events-none z-10">
                      <div className="text-center">
                        <Upload className="w-10 h-10 mx-auto mb-1 text-primary" />
                        <p className="text-sm font-medium text-primary">Drop files here</p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {/* File input */}
                    <input
                      type="file"
                      multiple
                      onChange={e => setSelectedFiles(prev => [...prev, ...Array.from(e.target.files || [])])}
                      className="w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-primary/10 file:text-primary file:text-sm hover:file:bg-primary/20"
                      disabled={uploading}
                    />
                    {/* Folder input */}
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">Or select entire folder:</span>
                      <input
                        type="file"
                        // @ts-ignore
                        webkitdirectory="true"
                        directory="true"
                        multiple
                        onChange={e => setSelectedFiles(prev => [...prev, ...Array.from(e.target.files || [])])}
                        className="text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-green-100 file:text-green-700 file:text-sm hover:file:bg-green-200"
                        disabled={uploading}
                      />
                    </div>
                    {!isDragging && selectedFiles.length === 0 && (
                      <p className="text-xs text-center text-muted-foreground py-2">
                        Or drag and drop files / folders here
                      </p>
                    )}
                  </div>
                </div>

                {/* Selected file list */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{selectedFiles.length} file(s) selected:</p>
                    <div className="max-h-28 overflow-y-auto space-y-1">
                      {selectedFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-muted px-2 py-1 rounded">
                          <span className="truncate">{f.name}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-muted-foreground">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                            <button type="button" className="text-destructive hover:underline" onClick={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comments */}
                <textarea
                  value={uploadComment}
                  onChange={e => setUploadComment(e.target.value)}
                  placeholder="Comments / remarks (optional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={uploading}
                />

                {uploadError && (
                  <div className="p-2 bg-destructive/10 text-destructive text-xs rounded">{uploadError}</div>
                )}
                {uploadSuccess && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 text-green-700 text-xs rounded">
                    <CheckCircle className="w-4 h-4" /> Files uploaded successfully!
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={selectedFiles.length === 0 || uploading}>
                    {uploading ? 'Uploading...' : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
                  </Button>
                  {selectedFiles.length > 0 && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setSelectedFiles([])}>Clear</Button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* ─── Assign Editors Panel ─────────────────────────────────────── */}
          {showAssignEditors && (
            <div className="mx-6 mt-4 p-4 border rounded-lg space-y-3">
              <h4 className="text-sm font-semibold">Assign Editors & Distribute Creatives</h4>
              <p className="text-xs text-muted-foreground">Total creatives: {request.num_creatives || 0}</p>
              <div className="space-y-2">
                {editorDistribution.map((dist, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      value={dist.editor_id}
                      onChange={e => setEditorDistribution(prev => prev.map((d, i) => i === idx ? { ...d, editor_id: e.target.value } : d))}
                    >
                      <option value="">— Select editor —</option>
                      {availableEditors.map(e => (
                        <option key={e.id} value={e.id}>{e.display_name || e.name}</option>
                      ))}
                    </select>
                    <Input
                      type="number" min={1} placeholder="# creatives"
                      className="w-28"
                      value={dist.num_creatives || ''}
                      onChange={e => setEditorDistribution(prev => prev.map((d, i) => i === idx ? { ...d, num_creatives: Number(e.target.value) } : d))}
                    />
                    <button type="button" className="text-xs text-destructive hover:underline" onClick={() => setEditorDistribution(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditorDistribution(prev => [...prev, { editor_id: '', num_creatives: 1 }])}>
                + Add Editor
              </Button>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleAssignEditors} disabled={editorDistribution.length === 0 || editorDistribution.some(d => !d.editor_id) || !!actionLoading}>
                  {actionLoading === 'assign-editors' ? 'Saving...' : 'Save Editor Assignment'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAssignEditors(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* ─── Buyer Commit Panel ──────────────────────────────────────── */}
          {showBuyerCommit && (
            <div className="mx-6 mt-4 p-4 border rounded-lg space-y-4">
              <h4 className="text-sm font-semibold">Assign Uploaded Creatives to Buyers</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Overall Committed Run Qty</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 5"
                    value={committedRunQty}
                    onChange={e => setCommittedRunQty(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Overall Test Deadline</label>
                  <Input
                    type="datetime-local"
                    value={committedTestDeadline}
                    onChange={e => setCommittedTestDeadline(e.target.value)}
                  />
                </div>
              </div>

              {/* Per-buyer assignment */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Per-buyer assignments</span>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setBuyerAssignments(prev => [...prev, { buyer_id: '', buyer_name: '', run_qty: '', test_deadline: '', selected_files: [] }])}
                  >
                    + Add Buyer
                  </Button>
                </div>
                {buyerAssignments.map((assignment, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">Media Buyer</label>
                        <select
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          value={assignment.buyer_id}
                          onChange={e => setBuyerAssignments(prev => prev.map((a, i) => i === idx ? { ...a, buyer_id: e.target.value } : a))}
                        >
                          <option value="">— Select buyer —</option>
                          {availableBuyers.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Run Qty</label>
                        <Input
                          type="number" min={1} placeholder="Qty"
                          value={assignment.run_qty}
                          onChange={e => setBuyerAssignments(prev => prev.map((a, i) => i === idx ? { ...a, run_qty: e.target.value } : a))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Test Deadline</label>
                      <Input
                        type="datetime-local"
                        value={assignment.test_deadline}
                        onChange={e => setBuyerAssignments(prev => prev.map((a, i) => i === idx ? { ...a, test_deadline: e.target.value } : a))}
                      />
                    </div>
                    {/* File selection from uploads */}
                    {(request.uploads || []).length > 0 && (
                      <div>
                        <label className="block text-xs font-medium mb-1">Select files for this buyer</label>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {(request.uploads || []).map(upload => (
                            <label key={upload.id} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={assignment.selected_files.includes(upload.id)}
                                onChange={e => {
                                  setBuyerAssignments(prev => prev.map((a, i) => {
                                    if (i !== idx) return a;
                                    const files = e.target.checked
                                      ? [...a.selected_files, upload.id]
                                      : a.selected_files.filter(f => f !== upload.id);
                                    return { ...a, selected_files: files };
                                  }));
                                }}
                              />
                              <Paperclip className="w-3 h-3 text-muted-foreground" />
                              <span className="truncate">{upload.original_filename}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      className="text-xs text-destructive hover:underline"
                      onClick={() => setBuyerAssignments(prev => prev.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleAssignBuyers} disabled={!!actionLoading}>
                  {actionLoading === 'assign-buyers' ? 'Assigning...' : 'Confirm Assignments'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowBuyerCommit(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* ─── Reassign Panels ─────────────────────────────────────────── */}
          {showReassignCreative && (
            <div className="mx-6 mt-4 p-4 border rounded-lg space-y-3">
              <h4 className="text-sm font-semibold">Reassign Creative Head</h4>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newCreativeHeadId}
                onChange={e => setNewCreativeHeadId(e.target.value)}
              >
                <option value="">— Select new creative head —</option>
                {availableCreativeUsers.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <Input placeholder="Reason (optional)" value={reassignReason} onChange={e => setReassignReason(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleReassignCreative} disabled={!newCreativeHeadId || !!actionLoading}>Confirm</Button>
                <Button size="sm" variant="outline" onClick={() => setShowReassignCreative(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {showReassignBuyer && (
            <div className="mx-6 mt-4 p-4 border rounded-lg space-y-3">
              <h4 className="text-sm font-semibold">Reassign Buyer Head</h4>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newBuyerHeadId}
                onChange={e => setNewBuyerHeadId(e.target.value)}
              >
                <option value="">— Select new buyer head —</option>
                {availableBuyers.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <Input placeholder="Reason (optional)" value={reassignReason} onChange={e => setReassignReason(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleReassignBuyer} disabled={!newBuyerHeadId || !!actionLoading}>Confirm</Button>
                <Button size="sm" variant="outline" onClick={() => setShowReassignBuyer(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* ─── Body Sections ───────────────────────────────────────────── */}
          <div className="px-6 py-4 space-y-0 divide-y">

            {/* Summary */}
            <div className="pb-4">
              <SectionHeader title="Request Summary" sectionKey="summary" />
              {showSection.summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm mt-2">
                  <div><span className="text-muted-foreground">Type: </span>{request.request_type || '—'}</div>
                  <div><span className="text-muted-foreground">Creatives: </span>
                    <ProgressBar uploaded={Number(request.upload_count ?? 0)} total={request.num_creatives || 0} />
                  </div>
                  <div><span className="text-muted-foreground">Suggested Run Qty: </span>{request.suggested_run_qty ?? '—'}</div>
                  <div><span className="text-muted-foreground">Committed Run Qty: </span>{request.committed_run_qty ?? '—'}</div>
                  <div><span className="text-muted-foreground">Delivery Deadline: </span>
                    {request.delivery_deadline ? formatDate(request.delivery_deadline) : '—'}
                  </div>
                  <div><span className="text-muted-foreground">Test Deadline: </span>
                    {request.committed_test_deadline
                      ? formatDate(request.committed_test_deadline)
                      : request.test_deadline
                      ? formatDate(request.test_deadline)
                      : '—'}
                  </div>
                  {request.concept_notes && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Concept Notes: </span>
                      <span className="whitespace-pre-wrap">{request.concept_notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Creative Side */}
            <div className="py-4">
              <SectionHeader title="Creative Team" sectionKey="creative" />
              {showSection.creative && (
                <div className="mt-2 space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Creative Head: </span>
                    <span className="font-medium">{request.creative_head_name || '—'}</span>
                  </div>
                  {(request.editors || []).length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1.5">Assigned Editors:</p>
                      <div className="space-y-1.5">
                        {(request.editors || []).map((e, i) => (
                          <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                            <span className="font-medium">{e.display_name || e.editor_name}</span>
                            <div className="flex items-center gap-4">
                              <ProgressBar
                                uploaded={e.creatives_completed || 0}
                                total={e.num_creatives_assigned || 0}
                              />
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                e.editor_status === 'completed' ? 'bg-green-100 text-green-700'
                                : e.editor_status === 'in_progress' ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-600'
                              }`}>
                                {e.editor_status || 'pending'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {request.notes_to_creative && (
                    <div>
                      <p className="text-muted-foreground mb-1">Notes to Creative:</p>
                      <p className="text-sm bg-muted/50 rounded-lg px-3 py-2 whitespace-pre-wrap">{request.notes_to_creative}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Canvas Brief — always visible in body (same as FileRequestDetailsModal) */}
            <div className="py-4">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-semibold">Canvas Brief</span>
                <Button size="sm" variant="outline" onClick={() => setShowCanvas(true)}>
                  <FileText className="w-4 h-4 mr-1.5" />
                  {showCanvas ? 'Close Canvas' : 'View / Edit Canvas'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Creative brief, references, and production notes for this request.</p>
            </div>

            {/* Buyer Side */}
            <div className="py-4">
              <SectionHeader title="Buyer Team" sectionKey="buyer" />
              {showSection.buyer && (
                <div className="mt-2 space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Buyer Head: </span>
                    <span className="font-medium">{request.buyer_head_name || '—'}</span>
                  </div>
                  {(request.buyers || []).length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1.5">Assigned Buyers:</p>
                      <div className="space-y-2">
                        {(request.buyers || []).map((b, i) => {
                          // Find the actual file objects for this buyer's assigned file IDs
                          const assignedFiles = (request.uploads || []).filter(u =>
                            (b.assigned_file_ids || []).map(String).includes(String(u.id))
                          );
                          return (
                            <div key={i} className="bg-muted/50 rounded-lg px-3 py-2 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{b.buyer_name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  b.status === 'launched' ? 'bg-green-100 text-green-700'
                                  : 'bg-indigo-100 text-indigo-700'
                                }`}>
                                  {b.status || 'assigned'}
                                </span>
                              </div>
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                {b.run_qty && <span>Run qty: {b.run_qty}</span>}
                                {b.test_deadline && <span>Test by: {formatDate(b.test_deadline)}</span>}
                              </div>
                              {/* Files assigned to this buyer */}
                              {assignedFiles.length > 0 && (
                                <div className="space-y-1 border-t pt-2 mt-1">
                                  <p className="text-xs font-medium text-muted-foreground">
                                    Assigned files ({assignedFiles.length}):
                                  </p>
                                  {assignedFiles.map(f => (
                                    <div key={f.id} className="flex items-center gap-2 text-xs bg-background rounded px-2 py-1.5 border">
                                      <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                                      <span className="flex-1 truncate">{f.original_filename}</span>
                                      {f.file_size && (
                                        <span className="text-muted-foreground shrink-0">{(f.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                      )}
                                      {f.s3_url && (
                                        <a href={f.s3_url} target="_blank" rel="noopener noreferrer"
                                          className="text-blue-600 hover:underline font-medium shrink-0">
                                          Download
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {(b.assigned_file_ids || []).length > 0 && assignedFiles.length === 0 && (
                                <p className="text-xs text-muted-foreground italic">{b.assigned_file_ids!.length} file(s) assigned</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {request.notes_to_buyer && (
                    <div>
                      <p className="text-muted-foreground mb-1">Notes to Buyer:</p>
                      <p className="text-sm bg-muted/50 rounded-lg px-3 py-2 whitespace-pre-wrap">{request.notes_to_buyer}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Uploads */}
            <div className="py-4">
              <SectionHeader title={`Uploaded Files (${(request.uploads || []).length})`} sectionKey="uploads" />
              {showSection.uploads && (
                <div className="mt-2 space-y-2">
                  {(request.uploads || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
                  ) : (
                    <>
                      {/* Select All / Give Access for Testing toolbar — visible to buyer head/admin */}
                      {(isBuyerHead || isAdmin) && (
                        <div className="flex items-center gap-3 pb-2">
                          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="rounded border-border w-4 h-4"
                              checked={selectedUploadIds.length === (request.uploads || []).length && (request.uploads || []).length > 0}
                              onChange={e => {
                                if (e.target.checked) setSelectedUploadIds((request.uploads || []).map(u => u.id));
                                else setSelectedUploadIds([]);
                              }}
                            />
                            <span>Select All</span>
                          </label>
                          {selectedUploadIds.length > 0 && (
                            <Button
                              size="sm"
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7 px-3"
                              onClick={() => setShowTestingAssign(v => !v)}
                            >
                              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                              Give Access for Testing ({selectedUploadIds.length})
                            </Button>
                          )}
                          {selectedUploadIds.length > 0 && (
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => setSelectedUploadIds([])}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      )}

                      {/* Testing assignment panel */}
                      {showTestingAssign && (
                        <div className="p-3 border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 rounded-lg space-y-3 mb-2">
                          <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                            Assign {selectedUploadIds.length} file(s) to a buyer for testing
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium mb-1">Buyer</label>
                              <select
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                value={testingBuyerId}
                                onChange={e => setTestingBuyerId(e.target.value)}
                              >
                                <option value="">— Select buyer —</option>
                                {availableBuyers.map(b => (
                                  <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Test by (due date)</label>
                              <input
                                type="datetime-local"
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                value={testingDueDate}
                                onChange={e => setTestingDueDate(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleTestingAssign}
                              disabled={!testingBuyerId || testingAssigning}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                              {testingAssigning ? 'Assigning...' : 'Confirm'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setShowTestingAssign(false); setTestingBuyerId(''); setTestingDueDate(''); }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* File list with checkboxes */}
                      {(request.uploads || []).map(upload => (
                        <div key={upload.id} className={`flex items-center gap-3 p-2.5 border rounded-lg transition-colors ${
                          selectedUploadIds.includes(upload.id) ? 'border-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20' : 'hover:bg-muted/50'
                        }`}>
                          {/* Checkbox (buyer head / admin only) */}
                          {(isBuyerHead || isAdmin) && (
                            <input
                              type="checkbox"
                              className="rounded border-border w-4 h-4 shrink-0"
                              checked={selectedUploadIds.includes(upload.id)}
                              onChange={e => {
                                if (e.target.checked) setSelectedUploadIds(prev => [...prev, upload.id]);
                                else setSelectedUploadIds(prev => prev.filter(id => id !== upload.id));
                              }}
                            />
                          )}
                          <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{upload.original_filename}</p>
                            <p className="text-xs text-muted-foreground">
                              By {upload.uploader_name} · {formatDateTime(upload.created_at)}
                              {upload.file_size ? ` · ${(upload.file_size / 1024 / 1024).toFixed(2)} MB` : ''}
                              {upload.comments ? ` · ${upload.comments}` : ''}
                            </p>
                          </div>
                          {upload.s3_url && (
                            <a
                              href={upload.s3_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline shrink-0 font-medium"
                            >
                              Download
                            </a>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Reassignment History */}
            {(request.reassignments || []).length > 0 && (
              <div className="py-4">
                <SectionHeader title="Reassignment History" sectionKey="history" />
                {showSection.history && (
                  <div className="mt-2 space-y-2">
                    {(request.reassignments || []).map((r: any, i: number) => (
                      <div key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 bg-muted rounded">{r.reassign_type}</span>
                        <span>{r.from_name} → {r.to_name}</span>
                        {r.reason && <span className="italic">"{r.reason}"</span>}
                        <span className="ml-auto text-xs">{formatDateTime(r.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Upload Progress Queue Sidebar ─────────────────────────────────── */}
      {showUploadQueue && uploadQueue.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[60] w-72 bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Queue header */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-2">
              {uploading ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : uploadQueue.some(i => i.status === 'error') ? (
                <AlertCircle className="w-4 h-4 text-destructive" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-600" />
              )}
              <span className="text-sm font-semibold">
                {uploading
                  ? `Uploading ${uploadQueue.filter(i => i.status === 'done' || i.status === 'uploading').length}/${uploadQueue.length}`
                  : uploadQueue.some(i => i.status === 'error')
                  ? 'Upload complete (with errors)'
                  : 'Upload complete'}
              </span>
            </div>
            <button
              onClick={() => setShowUploadQueue(false)}
              className="p-1 hover:bg-accent rounded transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-muted">
            <div
              className={`h-1 transition-all duration-300 ${
                uploadQueue.some(i => i.status === 'error') ? 'bg-destructive' : 'bg-primary'
              }`}
              style={{
                width: `${uploadQueue.length > 0
                  ? Math.round((uploadQueue.filter(i => i.status === 'done' || i.status === 'error').length / uploadQueue.length) * 100)
                  : 0}%`
              }}
            />
          </div>
          {/* File list */}
          <div className="max-h-52 overflow-y-auto divide-y divide-border">
            {uploadQueue.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                <span className="shrink-0">
                  {item.status === 'done' && <CheckCircle className="w-4 h-4 text-green-600" />}
                  {item.status === 'uploading' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                  {item.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />}
                  {item.status === 'error' && <AlertCircle className="w-4 h-4 text-destructive" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.name}</p>
                  {item.status === 'error' && item.error && (
                    <p className="text-xs text-destructive truncate">{item.error}</p>
                  )}
                  {item.status === 'uploading' && (
                    <p className="text-xs text-primary">Uploading...</p>
                  )}
                  {item.status === 'done' && (
                    <p className="text-xs text-green-600">Done</p>
                  )}
                  {item.status === 'pending' && (
                    <p className="text-xs text-muted-foreground">Waiting...</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
