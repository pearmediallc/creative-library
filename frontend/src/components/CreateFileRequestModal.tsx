import React, { useState, useEffect } from 'react';
import { X, Inbox, FolderPlus, FileText } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { MultiSelect } from './ui/MultiSelect';
import { fileRequestApi, folderApi, editorApi, authApi, teamApi } from '../lib/api';
import { FILE_REQUEST_TYPES } from '../constants/fileRequestTypes';
import { PLATFORMS } from '../constants/platforms';
import { VERTICALS } from '../constants/verticals';
import { CanvasEditor } from './CanvasEditor';

interface CreateFileRequestModalProps {
  onClose: () => void;
  onSuccess: () => void;
  teamId?: string;
}

interface Folder {
  id: string;
  name: string;
}

interface Editor {
  id: string;
  name: string;
  display_name?: string;
}

interface Buyer {
  id: string;
  name: string;
  email: string;
}

interface Team {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  default_title: string | null;
  default_request_type: string | null;
  default_instructions: string | null;
  default_priority: 'low' | 'normal' | 'high' | 'urgent' | null;
  default_due_days: number | null;
  default_platform: string | null;
  default_vertical: string | null;
  default_num_creatives: number | null;
  default_folder_id: string | null;
  default_allow_multiple_uploads: boolean | null;
  default_require_email: boolean | null;
  default_custom_message: string | null;
  default_assigned_editor_ids: string[] | null;
  default_assigned_buyer_id: string | null;
  is_active?: boolean;
}

export function CreateFileRequestModal({ onClose, onSuccess, teamId }: CreateFileRequestModalProps) {
  const [requestType, setRequestType] = useState('');
  const [platform, setPlatform] = useState('');
  const [vertical, setVertical] = useState('');
  const [conceptNotes, setConceptNotes] = useState('');
  const [numCreatives, setNumCreatives] = useState<string>(''); // Changed to string for empty placeholder
  const [folderId, setFolderId] = useState<string>('');
  const [deadline, setDeadline] = useState('');
  const [allowMultipleUploads, setAllowMultipleUploads] = useState(true);
  const [requireEmail, setRequireEmail] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [selectedEditorIds, setSelectedEditorIds] = useState<string[]>([]);
  const [assignedBuyerId, setAssignedBuyerId] = useState<string>('');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState(teamId || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [hasCanvas, setHasCanvas] = useState(false);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

  const fetchFolders = async () => {
    try {
      const response = await folderApi.getTree();
      setFolders(flattenFolders(response.data.data || []));
    } catch (error: any) {
      console.error('Failed to fetch folders:', error);
    }
  };

  const flattenFolders = (folders: any[], prefix = ''): Folder[] => {
    let result: Folder[] = [];
    folders.forEach((folder) => {
      const name = prefix ? `${prefix} / ${folder.name}` : folder.name;
      result.push({ id: folder.id, name });
      if (folder.children && folder.children.length > 0) {
        result = result.concat(flattenFolders(folder.children, name));
      }
    });
    return result;
  };

  const fetchEditors = async () => {
    try {
      const response = await editorApi.getAll();
      const editorsData = response.data.data || [];
      setEditors(editorsData.map((e: any) => ({
        id: e.id,
        name: e.name,
        display_name: e.display_name
      })));
    } catch (error: any) {
      console.error('Failed to fetch editors:', error);
    }
  };

  const fetchBuyers = async () => {
    try {
      const response = await authApi.getBuyers();
      const buyersData = response.data.data || [];
      setBuyers(buyersData.map((b: any) => ({
        id: b.id,
        name: b.name,
        email: b.email
      })));
    } catch (error: any) {
      console.error('Failed to fetch buyers:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await teamApi.getUserTeams();
      setTeams(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const fetchTemplates = async (teamId: string) => {
    try {
      const response = await teamApi.getTemplates(teamId);
      const activeTemplates = (response.data.data || []).filter((t: Template) => t.is_active !== false);
      setTemplates(activeTemplates);
    } catch (error: any) {
      console.error('Failed to fetch templates:', error);
      setTemplates([]);
    }
  };

  const handleTemplateSelect = async (templateId: string) => {
    setSelectedTemplateId(templateId);

    if (!templateId) {
      // Clear form when "No team template" is selected
      setRequestType('');
      setConceptNotes('');
      setPlatform('');
      setVertical('');
      setNumCreatives('');
      setDeadline('');
      return;
    }

    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Auto-fill ALL form fields from template
    if (template.default_title || template.default_request_type) {
      setRequestType(template.default_title || template.default_request_type || '');
    }
    if (template.default_instructions) {
      setConceptNotes(template.default_instructions);
    }
    if (template.default_platform) {
      setPlatform(template.default_platform);
    }
    if (template.default_vertical) {
      setVertical(template.default_vertical);
    }
    if (template.default_num_creatives) {
      setNumCreatives(template.default_num_creatives.toString());
    }
    if (template.default_folder_id) {
      setFolderId(template.default_folder_id);
    }
    if (template.default_allow_multiple_uploads !== undefined && template.default_allow_multiple_uploads !== null) {
      setAllowMultipleUploads(template.default_allow_multiple_uploads);
    }
    if (template.default_require_email !== undefined && template.default_require_email !== null) {
      setRequireEmail(template.default_require_email);
    }
    if (template.default_custom_message) {
      setCustomMessage(template.default_custom_message);
    }
    if (template.default_assigned_editor_ids && template.default_assigned_editor_ids.length > 0) {
      setSelectedEditorIds(template.default_assigned_editor_ids);
    }
    if (template.default_assigned_buyer_id) {
      setAssignedBuyerId(template.default_assigned_buyer_id);
    }
    if (template.default_due_days) {
      // Calculate deadline from default_due_days
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + template.default_due_days);
      const formattedDate = futureDate.toISOString().slice(0, 16);
      setDeadline(formattedDate);
    }
  };

  // Effects
  useEffect(() => {
    fetchFolders();
    fetchEditors();
    fetchBuyers();
    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      fetchTemplates(selectedTeamId);
    } else {
      setTemplates([]);
      setSelectedTemplateId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError('Folder name is required');
      return;
    }

    setCreatingFolder(true);
    setError('');

    try {
      const response = await folderApi.create({
        name: newFolderName.trim(),
        parent_folder_id: folderId || undefined
      });

      await fetchFolders();
      setFolderId(response.data.data.id);
      setNewFolderName('');
      setShowCreateFolder(false);
    } catch (error: any) {
      console.error('Failed to create folder:', error);
      setError(error.response?.data?.error || 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!requestType) {
      setError('Request Type is required');
      return;
    }

    if (!platform) {
      setError('Platform is required');
      return;
    }

    if (!vertical) {
      setError('Vertical is required');
      return;
    }

    if (!numCreatives || parseInt(numCreatives) < 1) {
      setError('Number of Creatives is required and must be at least 1');
      return;
    }

    if (deadline) {
      const deadlineDate = new Date(deadline);
      if (deadlineDate < new Date()) {
        setError('Deadline must be a future date');
        return;
      }
    }

    setCreating(true);
    setError('');

    try {
      const response = await fileRequestApi.create({
        title: requestType,
        description: conceptNotes.trim() || undefined,
        folder_id: folderId || undefined,
        deadline: deadline || undefined,
        allow_multiple_uploads: allowMultipleUploads,
        require_email: requireEmail,
        custom_message: customMessage.trim() || undefined,
        editor_id: selectedEditorIds[0] || undefined,
        assigned_buyer_id: assignedBuyerId || undefined,
        request_type: requestType,
        platform: platform,
        vertical: vertical,
        concept_notes: conceptNotes.trim() || undefined,
        num_creatives: parseInt(numCreatives) || 1,
      });

      // Store request ID for canvas
      const requestId = response.data?.data?.id;
      if (requestId) {
        setCreatedRequestId(requestId);

        // Assign to multiple editors if selected
        if (selectedEditorIds.length > 0) {
          await fileRequestApi.assignEditors(requestId, selectedEditorIds);
        }

        // Open Canvas Editor if user toggled it on, otherwise close modal
        if (showCanvas) {
          // Canvas toggle is ON - keep modal open and show canvas editor
          setError('');
        } else {
          // Canvas toggle is OFF - close modal and refresh
          onSuccess();
        }
      } else {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Failed to create file request:', error);
      setError(error.response?.data?.error || 'Failed to create file request');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Create File Request
            </h2>
          </div>
          <button
            onClick={() => {
              if (createdRequestId) {
                onSuccess(); // Refresh list
              }
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Team Selection (Optional) */}
          {teams.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Use Team Template (Optional)
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value);
                  setSelectedTemplateId('');
                }}
                disabled={creating}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white mb-3"
              >
                <option value="">No team template</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>

              {/* Template Selection */}
              {selectedTeamId && templates.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Template to Auto-Fill Form
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    disabled={creating}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Choose a template...</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.description ? ` - ${template.description}` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedTemplateId && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      Form fields have been auto-filled from template. You can still modify any field.
                    </p>
                  )}
                </div>
              )}

              {selectedTeamId && templates.length === 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                  No templates available for this team yet.
                </p>
              )}
            </div>
          )}

          {/* Request Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Request Type *
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select Request Type</option>
              {FILE_REQUEST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Platform */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Platform *
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select Platform</option>
              {PLATFORMS.map((plat) => (
                <option key={plat} value={plat}>
                  {plat}
                </option>
              ))}
            </select>
          </div>

          {/* Vertical */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Vertical *
            </label>
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select Vertical</option>
              {VERTICALS.map((vert) => (
                <option key={vert} value={vert}>
                  {vert}
                </option>
              ))}
            </select>
          </div>

          {/* Concept Notes with Canvas Toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Concept Notes / Brief
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCanvas(!showCanvas)}
                disabled={creating}
                className="text-xs flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
              >
                <FileText className="w-4 h-4" />
                {showCanvas ? 'Simple Notes' : 'Canvas Brief (Detailed)'}
              </Button>
            </div>
            {!showCanvas ? (
              <textarea
                value={conceptNotes}
                onChange={(e) => setConceptNotes(e.target.value)}
                placeholder="Quick notes about this request..."
                rows={3}
                disabled={creating}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            ) : (
              <p className="text-sm text-blue-600 dark:text-blue-400 italic">
                Canvas Brief editor will open after you click "Create Request" below
              </p>
            )}
          </div>

          {/* Number of Creatives */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Number of Creatives *
            </label>
            <input
              type="number"
              value={numCreatives}
              onChange={(e) => setNumCreatives(e.target.value)}
              placeholder="Enter number (e.g., 5)"
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Destination Folder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Destination Folder
            </label>
            <div className="flex gap-2">
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                disabled={creating}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Root / No folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateFolder(!showCreateFolder)}
                disabled={creating}
                className="flex-shrink-0"
              >
                <FolderPlus className="w-4 h-4" />
              </Button>
            </div>

            {/* Inline folder creation */}
            {showCreateFolder && (
              <div className="mt-2 flex gap-2">
                <Input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="New folder name"
                  disabled={creatingFolder}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateFolder();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleCreateFolder}
                  disabled={creatingFolder || !newFolderName.trim()}
                  size="sm"
                >
                  {creatingFolder ? 'Creating...' : 'Create'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateFolder(false);
                    setNewFolderName('');
                  }}
                  disabled={creatingFolder}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-1">
              Uploaded files will be saved to this folder
            </p>
          </div>

          {/* Editor Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Assign to Editors (optional)
            </label>
            <MultiSelect
              options={editors.map(e => ({
                id: e.id,
                label: e.display_name || e.name
              }))}
              selectedIds={selectedEditorIds}
              onChange={setSelectedEditorIds}
              placeholder="Select editors..."
              disabled={creating}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {vertical ? 'Auto-assigned to vertical head. You can select additional editors here.' : 'Search and select multiple editors easily'}
            </p>
          </div>

          {/* Vertical Auto-Assignment Notice */}
          {vertical && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-900 dark:text-blue-200 font-medium">
                📌 Vertical-Based Assignment Active
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                This request will be automatically assigned to the {vertical} vertical head. Buyer assignment is hidden when vertical is selected.
              </p>
            </div>
          )}

          {/* Buyer Assignment - Hidden when vertical is selected */}
          {!vertical && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assign to Buyer (optional)
              </label>
              <select
                value={assignedBuyerId}
                onChange={(e) => setAssignedBuyerId(e.target.value)}
                disabled={creating}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">No buyer assignment</option>
                {buyers.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>
                    {buyer.name} ({buyer.email})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Uploaded files will be automatically assigned to this buyer
              </p>
            </div>
          )}

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Deadline (optional)
            </label>
            <Input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={creating}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Request will not accept uploads after this date
            </p>
          </div>

          {/* Custom Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Custom Message (optional)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a custom message for uploaders..."
              rows={2}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowMultipleUploads}
                onChange={(e) => setAllowMultipleUploads(e.target.checked)}
                disabled={creating}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Allow multiple file uploads
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requireEmail}
                onChange={(e) => setRequireEmail(e.target.checked)}
                disabled={creating}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Require uploader email
              </span>
            </label>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Success message with Canvas button */}
          {createdRequestId && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-2 border-green-400 dark:border-green-600 rounded-lg p-5 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg font-bold">✓</span>
                </div>
                <p className="text-base font-bold text-green-900 dark:text-green-100">
                  Request Created Successfully!
                </p>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Now add your Canvas brief with team members, requirements, and attachments.
              </p>
              <Button
                type="button"
                onClick={() => setShowCanvas(true)}
                className="w-full py-3 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                <FileText className="w-5 h-5 mr-2" />
                {hasCanvas ? '📝 Edit Canvas Brief' : '📋 Create Canvas Brief'}
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (createdRequestId) {
                  onSuccess(); // Refresh list
                }
                onClose();
              }}
              disabled={creating}
            >
              {createdRequestId ? 'Done' : 'Cancel'}
            </Button>
            {!createdRequestId && (
              <Button
                type="submit"
                disabled={creating || !requestType || !platform || !vertical}
              >
                {creating ? 'Creating...' : 'Create Request'}
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Canvas Editor Modal */}
      {showCanvas && createdRequestId && (
        <CanvasEditor
          requestId={createdRequestId}
          onClose={() => setShowCanvas(false)}
          onSave={() => setHasCanvas(true)}
        />
      )}
    </div>
  );
}
