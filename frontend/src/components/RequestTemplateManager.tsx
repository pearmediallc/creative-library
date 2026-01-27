import React, { useState, useEffect } from 'react';
import { teamApi } from '../lib/api';
import { FileText, Plus, Edit2, Trash2, Copy, X } from 'lucide-react';
import { Button } from './ui/Button';
import { FILE_REQUEST_TYPES } from '../constants/fileRequestTypes';
import { PLATFORMS } from '../constants/platforms';
import { VERTICALS } from '../constants/verticals';

interface Template {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  default_title: string | null;
  default_instructions: string | null;
  default_priority: 'low' | 'normal' | 'high' | 'urgent' | null;
  default_due_days: number | null;
  required_fields: any[] | null;
  is_active: boolean;
  usage_count: number;
  created_by: string;
  created_at: string;
}

interface RequestTemplateManagerProps {
  teamId: string;
  onUseTemplate?: (template: Template) => void;
  className?: string;
}

export function RequestTemplateManager({
  teamId,
  onUseTemplate,
  className = ''
}: RequestTemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultTitle, setDefaultTitle] = useState('');
  const [defaultInstructions, setDefaultInstructions] = useState('');
  const [defaultPriority, setDefaultPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [defaultDueDays, setDefaultDueDays] = useState<number>(7);
  const [isActive, setIsActive] = useState(true);

  // New fields for full file request compatibility
  const [defaultRequestType, setDefaultRequestType] = useState('');
  const [defaultPlatform, setDefaultPlatform] = useState('');
  const [defaultVertical, setDefaultVertical] = useState('');
  const [defaultNumCreatives, setDefaultNumCreatives] = useState<number>(1);
  const [defaultAllowMultipleUploads, setDefaultAllowMultipleUploads] = useState(true);
  const [defaultRequireEmail, setDefaultRequireEmail] = useState(false);
  const [defaultCustomMessage, setDefaultCustomMessage] = useState('');

  useEffect(() => {
    if (teamId) {
      fetchTemplates();
    }
  }, [teamId]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await teamApi.getTemplates(teamId);
      setTemplates(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch templates:', error);
      setError(error.response?.data?.error || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setDefaultTitle('');
    setDefaultInstructions('');
    setDefaultPriority('normal');
    setDefaultDueDays(7);
    setIsActive(true);
    setDefaultRequestType('');
    setDefaultPlatform('');
    setDefaultVertical('');
    setDefaultNumCreatives(1);
    setDefaultAllowMultipleUploads(true);
    setDefaultRequireEmail(false);
    setDefaultCustomMessage('');
    setEditingTemplate(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await teamApi.createTemplate(teamId, {
        name: name.trim(),
        description: description.trim() || undefined,
        defaultTitle: defaultTitle.trim() || undefined,
        defaultRequestType: defaultRequestType.trim() || undefined,
        defaultInstructions: defaultInstructions.trim() || undefined,
        defaultPriority,
        defaultDueDays,
        defaultPlatform: defaultPlatform || undefined,
        defaultVertical: defaultVertical || undefined,
        defaultNumCreatives: defaultNumCreatives || undefined,
        defaultAllowMultipleUploads,
        defaultRequireEmail,
        defaultCustomMessage: defaultCustomMessage.trim() || undefined,
      });
      const newTemplate = response.data.data;
      setTemplates([newTemplate, ...templates]);
      resetForm();
      setView('list');
      alert('Template created successfully!');
    } catch (error: any) {
      console.error('Failed to create template:', error);
      setError(error.response?.data?.error || 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setName(template.name);
    setDescription(template.description || '');
    setDefaultTitle(template.default_title || '');
    setDefaultRequestType((template as any).default_request_type || '');
    setDefaultInstructions(template.default_instructions || '');
    setDefaultPriority(template.default_priority || 'normal');
    setDefaultDueDays(template.default_due_days || 7);
    setDefaultPlatform((template as any).default_platform || '');
    setDefaultVertical((template as any).default_vertical || '');
    setDefaultNumCreatives((template as any).default_num_creatives || 1);
    setDefaultAllowMultipleUploads((template as any).default_allow_multiple_uploads !== false);
    setDefaultRequireEmail((template as any).default_require_email || false);
    setDefaultCustomMessage((template as any).default_custom_message || '');
    setIsActive(template.is_active);
    setView('edit');
  };

  const handleUpdate = async () => {
    if (!editingTemplate || !name.trim()) {
      setError('Template name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await teamApi.updateTemplate(editingTemplate.id, {
        name: name.trim(),
        description: description.trim() || null,
        default_title: defaultTitle.trim() || null,
        default_request_type: defaultRequestType.trim() || null,
        default_instructions: defaultInstructions.trim() || null,
        default_priority: defaultPriority,
        default_due_days: defaultDueDays,
        default_platform: defaultPlatform || null,
        default_vertical: defaultVertical || null,
        default_num_creatives: defaultNumCreatives || null,
        default_allow_multiple_uploads: defaultAllowMultipleUploads,
        default_require_email: defaultRequireEmail,
        default_custom_message: defaultCustomMessage.trim() || null,
        is_active: isActive,
      });
      const updatedTemplate = response.data.data;
      setTemplates(templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
      resetForm();
      setView('list');
      alert('Template updated successfully!');
    } catch (error: any) {
      console.error('Failed to update template:', error);
      setError(error.response?.data?.error || 'Failed to update template');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string, templateName: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Are you sure you want to delete "${templateName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await teamApi.deleteTemplate(templateId);
      setTemplates(templates.filter(t => t.id !== templateId));
      alert('Template deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete template:', error);
      alert(error.response?.data?.error || 'Failed to delete template');
    }
  };

  const handleUse = async (template: Template) => {
    try {
      await teamApi.useTemplate(template.id);
      // Update usage count locally
      setTemplates(templates.map(t =>
        t.id === template.id ? { ...t, usage_count: t.usage_count + 1 } : t
      ));
      if (onUseTemplate) {
        onUseTemplate(template);
      }
    } catch (error: any) {
      console.error('Failed to use template:', error);
      alert(error.response?.data?.error || 'Failed to use template');
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Request Templates</h3>
        </div>
        {view === 'list' && (
          <Button onClick={() => setView('create')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading templates...</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h4 className="text-lg font-semibold mb-2">No templates yet</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Create reusable templates to standardize your team's requests
              </p>
              <Button onClick={() => setView('create')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Template
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`border rounded-lg p-4 ${
                    !template.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{template.name}</h4>
                        {!template.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                            Inactive
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Used {template.usage_count} times</span>
                        {template.default_priority && (
                          <span className="capitalize">Priority: {template.default_priority}</span>
                        )}
                        {template.default_due_days && (
                          <span>Due: {template.default_due_days} days</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {template.is_active && (
                        <button
                          onClick={() => handleUse(template)}
                          className="p-2 hover:bg-green-100 dark:hover:bg-green-900/20 rounded text-green-600 transition-colors"
                          title="Use template"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(template)}
                        className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded text-blue-600 transition-colors"
                        title="Edit template"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id, template.name)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 transition-colors"
                        title="Delete template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create/Edit Form */}
      {(view === 'create' || view === 'edit') && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold">
              {view === 'create' ? 'Create Template' : 'Edit Template'}
            </h4>
            <button
              onClick={() => {
                resetForm();
                setView('list');
              }}
              className="p-1 hover:bg-accent rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Template Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Standard Design Request"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this template is for"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Default Request Title</label>
            <input
              type="text"
              value={defaultTitle}
              onChange={(e) => setDefaultTitle(e.target.value)}
              placeholder="e.g., New Design Request"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Default Instructions</label>
            <textarea
              value={defaultInstructions}
              onChange={(e) => setDefaultInstructions(e.target.value)}
              placeholder="Default instructions for this type of request"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={4}
            />
          </div>

          {/* New Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Default Platform</label>
              <select
                value={defaultPlatform}
                onChange={(e) => setDefaultPlatform(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">No default platform</option>
                {PLATFORMS.map((plat) => (
                  <option key={plat} value={plat}>{plat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Default Vertical</label>
              <select
                value={defaultVertical}
                onChange={(e) => setDefaultVertical(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">No default vertical</option>
                {VERTICALS.map((vert) => (
                  <option key={vert} value={vert}>{vert}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Default Number of Creatives</label>
            <input
              type="number"
              value={defaultNumCreatives}
              onChange={(e) => setDefaultNumCreatives(parseInt(e.target.value) || 1)}
              min="1"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Default Custom Message</label>
            <textarea
              value={defaultCustomMessage}
              onChange={(e) => setDefaultCustomMessage(e.target.value)}
              placeholder="Default custom message for requesters"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allow-multiple"
                checked={defaultAllowMultipleUploads}
                onChange={(e) => setDefaultAllowMultipleUploads(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="allow-multiple" className="text-sm">
                Allow Multiple Uploads
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="require-email"
                checked={defaultRequireEmail}
                onChange={(e) => setDefaultRequireEmail(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="require-email" className="text-sm">
                Require Email
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Default Priority</label>
              <select
                value={defaultPriority}
                onChange={(e) => setDefaultPriority(e.target.value as any)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Default Due Days</label>
              <input
                type="number"
                value={defaultDueDays}
                onChange={(e) => setDefaultDueDays(parseInt(e.target.value) || 0)}
                min="1"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {view === 'edit' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="is-active" className="text-sm">
                Active (can be used by team members)
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setView('list');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={view === 'create' ? handleCreate : handleUpdate}
              disabled={loading || !name.trim()}
            >
              {loading ? (view === 'create' ? 'Creating...' : 'Updating...') : (view === 'create' ? 'Create Template' : 'Update Template')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
