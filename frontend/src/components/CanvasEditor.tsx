import React, { useState, useEffect, useCallback } from 'react';
import { FileText, X, Upload, Trash2, Save, AlertCircle } from 'lucide-react';
import { fileRequestApi } from '../lib/api';
import type { Canvas, CanvasContent, CanvasAttachment } from '../lib/canvasTemplates';
import { PRODUCT_BRIEF_TEMPLATE } from '../lib/canvasTemplates';

interface CanvasEditorProps {
  requestId: string;
  onClose: () => void;
  onSave?: (canvas: Canvas) => void;
}

export function CanvasEditor({ requestId, onClose, onSave }: CanvasEditorProps) {
  const [content, setContent] = useState<CanvasContent>(PRODUCT_BRIEF_TEMPLATE);
  const [attachments, setAttachments] = useState<CanvasAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load existing canvas
  useEffect(() => {
    loadCanvas();
  }, [requestId]);

  const loadCanvas = async () => {
    try {
      setLoading(true);
      const response = await fileRequestApi.canvas.get(requestId);
      const canvasData = response.data.canvas;

      if (canvasData && canvasData.content) {
        setContent(canvasData.content);
        setAttachments(canvasData.attachments || []);
      }
    } catch (err: any) {
      console.error('Failed to load canvas:', err);
      setError('Failed to load canvas');
    } finally {
      setLoading(false);
    }
  };

  // Auto-save with debounce
  const debouncedSave = useCallback((newContent: CanvasContent) => {
    setSaveStatus('unsaved');

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      await saveCanvas(newContent);
    }, 2000); // 2 second debounce

    setSaveTimeout(timeout);
  }, [saveTimeout]);

  const saveCanvas = async (contentToSave: CanvasContent) => {
    try {
      setSaveStatus('saving');
      setSaving(true);

      const response = await fileRequestApi.canvas.upsert(requestId, contentToSave);

      setSaveStatus('saved');
      if (onSave) {
        onSave(response.data.canvas);
      }

      // Reset saved status after 2 seconds
      setTimeout(() => {
        setSaveStatus('saved');
      }, 2000);
    } catch (err: any) {
      console.error('Failed to save canvas:', err);
      setError('Failed to save canvas');
      setSaveStatus('unsaved');
    } finally {
      setSaving(false);
    }
  };

  // Update block content
  const updateBlock = (index: number, field: string, value: any) => {
    const newContent = { ...content };
    newContent.blocks = [...content.blocks];
    newContent.blocks[index] = {
      ...newContent.blocks[index],
      [field]: value
    };
    setContent(newContent);
    debouncedSave(newContent);
  };

  // Update list item
  const updateListItem = (blockIndex: number, itemIndex: number, value: string) => {
    const newContent = { ...content };
    newContent.blocks = [...content.blocks];
    const items = [...(newContent.blocks[blockIndex].items as string[])];
    items[itemIndex] = value;
    newContent.blocks[blockIndex] = {
      ...newContent.blocks[blockIndex],
      items
    };
    setContent(newContent);
    debouncedSave(newContent);
  };

  // Update checklist item
  const updateChecklistItem = (blockIndex: number, itemIndex: number, field: string, value: any) => {
    const newContent = { ...content };
    newContent.blocks = [...content.blocks];
    const items = [...(newContent.blocks[blockIndex].items as any[])];
    items[itemIndex] = {
      ...items[itemIndex],
      [field]: value
    };
    newContent.blocks[blockIndex] = {
      ...newContent.blocks[blockIndex],
      items
    };
    setContent(newContent);
    debouncedSave(newContent);
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      const response = await fileRequestApi.canvas.uploadAttachment(requestId, file);
      const newAttachment = response.data.attachment;

      setAttachments([...attachments, newAttachment]);
      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Failed to upload attachment:', err);
      setError('Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  // Handle remove attachment
  const handleRemoveAttachment = async (fileId: string) => {
    try {
      await fileRequestApi.canvas.removeAttachment(requestId, fileId);
      setAttachments(attachments.filter(a => a.file_id !== fileId));
    } catch (err: any) {
      console.error('Failed to remove attachment:', err);
      setError('Failed to remove attachment');
    }
  };

  // Render block editor
  const renderBlockEditor = (block: any, index: number) => {
    switch (block.type) {
      case 'heading':
        return (
          <input
            key={index}
            type="text"
            value={block.content}
            onChange={(e) => updateBlock(index, 'content', e.target.value)}
            className={`w-full bg-transparent border-none outline-none font-semibold ${
              block.level === 2 ? 'text-xl mt-6 mb-3' : 'text-lg mt-4 mb-2'
            } focus:ring-2 focus:ring-ring rounded px-2 py-1`}
          />
        );

      case 'text':
        return (
          <textarea
            key={index}
            value={block.content}
            onChange={(e) => updateBlock(index, 'content', e.target.value)}
            className="w-full bg-transparent border-none outline-none text-sm text-muted-foreground mb-2 focus:ring-2 focus:ring-ring rounded px-2 py-1 resize-none"
            rows={2}
          />
        );

      case 'list':
        return (
          <div key={index} className="space-y-1 mb-4">
            {block.items?.map((item: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm">•</span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateListItem(index, i, e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm focus:ring-2 focus:ring-ring rounded px-2 py-1"
                />
              </div>
            ))}
          </div>
        );

      case 'checklist':
        return (
          <div key={index} className="space-y-2 mb-4">
            {block.items?.map((item: any, i: number) => (
              <label key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => updateChecklistItem(index, i, 'checked', e.target.checked)}
                  className="rounded border-border"
                />
                <input
                  type="text"
                  value={item.text}
                  onChange={(e) => updateChecklistItem(index, i, 'text', e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm focus:ring-2 focus:ring-ring rounded px-2 py-1"
                />
              </label>
            ))}
          </div>
        );

      case 'attachments':
        return (
          <div key={index} className="mb-4">
            {/* File upload zone */}
            <label className="border-2 border-dashed border-border rounded-md p-6 text-center block cursor-pointer hover:bg-accent transition-colors">
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Images, videos, or documents up to 50MB
              </p>
            </label>

            {/* Attachments list */}
            {attachments.length > 0 && (
              <div className="space-y-2 mt-4">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.file_id}
                    className="flex items-center justify-between p-3 bg-muted rounded-md"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {attachment.thumbnail_url ? (
                        <img
                          src={attachment.thumbnail_url}
                          alt={attachment.file_name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <FileText className="w-12 h-12 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{attachment.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.file_size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveAttachment(attachment.file_id)}
                      className="p-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card rounded-lg p-8">
          <p className="text-sm">Loading canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Canvas Editor
            </h2>
            {/* Save status indicator */}
            <span className={`text-xs px-2 py-1 rounded ${
              saveStatus === 'saved'
                ? 'bg-green-100 text-green-700'
                : saveStatus === 'saving'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {saveStatus === 'saved'
                ? '✓ Saved'
                : saveStatus === 'saving'
                ? 'Saving...'
                : 'Unsaved changes'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-destructive/20 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-xs text-muted-foreground mb-4">
            Auto-saves every 2 seconds. Edit fields directly.
          </p>
          {content.blocks.map((block, index) => renderBlockEditor(block, index))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => saveCanvas(content)}
            disabled={saving || saveStatus === 'saved'}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Now'}
          </button>
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
