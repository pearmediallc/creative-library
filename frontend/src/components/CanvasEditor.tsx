import React, { useState, useEffect, useCallback } from 'react';
import { FileText, X, Upload, Trash2, Save, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { fileRequestApi } from '../lib/api';
import type { Canvas, CanvasContent, CanvasAttachment } from '../lib/canvasTemplates';
import { PRODUCT_BRIEF_TEMPLATE } from '../lib/canvasTemplates';
import { MentionInput } from './MentionInput';

interface CanvasApiOverride {
  get: (id: string) => Promise<any>;
  upsert: (id: string, content: any, attachments?: any[]) => Promise<any>;
  uploadAttachment: (id: string, file: File) => Promise<any>;
  removeAttachment: (id: string, fileId: string) => Promise<any>;
}

interface CanvasEditorProps {
  requestId: string;
  onClose: () => void;
  onSave?: (canvas: Canvas) => void;
  /** Pass launchRequestApi.canvas to use launch-request canvas endpoints instead of file-request ones */
  canvasApiOverride?: CanvasApiOverride;
}

/** Groups flat blocks into sections: each heading starts a new section */
function groupBlocksIntoSections(blocks: any[]): Array<{ headingIndex: number; heading: any; contentBlocks: Array<{ block: any; originalIndex: number }> }> {
  const sections: Array<{ headingIndex: number; heading: any; contentBlocks: Array<{ block: any; originalIndex: number }> }> = [];
  let currentSection: { headingIndex: number; heading: any; contentBlocks: Array<{ block: any; originalIndex: number }> } | null = null;

  blocks.forEach((block, idx) => {
    if (block.type === 'heading') {
      if (currentSection) sections.push(currentSection);
      currentSection = { headingIndex: idx, heading: block, contentBlocks: [] };
    } else {
      if (!currentSection) {
        // blocks before the first heading — treat as a top-level section with no heading
        currentSection = { headingIndex: -1, heading: null, contentBlocks: [] };
      }
      currentSection.contentBlocks.push({ block, originalIndex: idx });
    }
  });
  if (currentSection) sections.push(currentSection);
  return sections;
}

export function CanvasEditor({ requestId, onClose, onSave, canvasApiOverride }: CanvasEditorProps) {
  const canvasApi = canvasApiOverride || fileRequestApi.canvas;
  const [content, setContent] = useState<CanvasContent>(PRODUCT_BRIEF_TEMPLATE);
  const [attachments, setAttachments] = useState<CanvasAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  // Track which sections are expanded (by heading block index); default: all expanded
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});

  // Load existing canvas
  useEffect(() => {
    loadCanvas();
  }, [requestId]);

  const loadCanvas = async () => {
    try {
      setLoading(true);
      const response = await canvasApi.get(requestId);
      const canvasData = response.data.canvas;

      if (canvasData && canvasData.content) {
        setContent(canvasData.content);
        setAttachments(canvasData.attachments || []);
        // Default all sections to expanded
        const blocks: any[] = canvasData.content.blocks || [];
        const initial: Record<number, boolean> = {};
        blocks.forEach((b: any, i: number) => { if (b.type === 'heading') initial[i] = true; });
        setExpandedSections(initial);
      } else {
        // Default template — expand all headings
        const initial: Record<number, boolean> = {};
        PRODUCT_BRIEF_TEMPLATE.blocks.forEach((b, i) => { if (b.type === 'heading') initial[i] = true; });
        setExpandedSections(initial);
      }
    } catch (err: any) {
      console.error('Failed to load canvas:', err);
      setError('Failed to load canvas');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (headingIndex: number) => {
    setExpandedSections(prev => ({ ...prev, [headingIndex]: !prev[headingIndex] }));
  };

  const collapseAll = () => {
    const next: Record<number, boolean> = {};
    content.blocks.forEach((b, i) => { if (b.type === 'heading') next[i] = false; });
    setExpandedSections(next);
  };

  const expandAll = () => {
    const next: Record<number, boolean> = {};
    content.blocks.forEach((b, i) => { if (b.type === 'heading') next[i] = true; });
    setExpandedSections(next);
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

      const response = await canvasApi.upsert(requestId, contentToSave);

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

      const response = await canvasApi.uploadAttachment(requestId, file);
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
      await canvasApi.removeAttachment(requestId, fileId);
      setAttachments(attachments.filter(a => a.file_id !== fileId));
    } catch (err: any) {
      console.error('Failed to remove attachment:', err);
      setError('Failed to remove attachment');
    }
  };

  // Render individual block editor (no heading — headings are rendered as section toggles)
  const renderContentBlock = (block: any, originalIndex: number) => {
    switch (block.type) {
      case 'text':
        return (
          <MentionInput
            key={originalIndex}
            value={block.content}
            onChange={(value) => updateBlock(originalIndex, 'content', value)}
            multiline={true}
            rows={4}
            className="w-full bg-transparent border border-border rounded-md outline-none text-sm text-foreground mb-3 focus:ring-2 focus:ring-ring px-3 py-2 resize-y min-h-[80px]"
          />
        );

      case 'list':
        return (
          <div key={originalIndex} className="space-y-1.5 mb-4">
            {block.items?.map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-sm mt-1.5 text-muted-foreground shrink-0">•</span>
                <MentionInput
                  value={item}
                  onChange={(value) => updateListItem(originalIndex, i, value)}
                  className="flex-1 bg-background border border-border rounded-md outline-none text-sm focus:ring-2 focus:ring-ring px-3 py-2"
                />
              </div>
            ))}
          </div>
        );

      case 'checklist':
        return (
          <div key={originalIndex} className="space-y-2 mb-4">
            {block.items?.map((item: any, i: number) => (
              <label key={i} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => updateChecklistItem(originalIndex, i, 'checked', e.target.checked)}
                  className="rounded border-border w-4 h-4 shrink-0"
                />
                <MentionInput
                  value={item.text}
                  onChange={(value) => updateChecklistItem(originalIndex, i, 'text', value)}
                  className={`flex-1 bg-background border border-border rounded-md outline-none text-sm focus:ring-2 focus:ring-ring px-3 py-2 ${
                    item.checked ? 'line-through text-muted-foreground' : ''
                  }`}
                />
              </label>
            ))}
          </div>
        );

      case 'attachments':
        return (
          <div key={originalIndex} className="mb-4">
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
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {attachment.thumbnail_url ? (
                        <img
                          src={attachment.thumbnail_url}
                          alt={attachment.file_name}
                          className="w-12 h-12 object-cover rounded shrink-0"
                        />
                      ) : (
                        <FileText className="w-12 h-12 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.file_size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveAttachment(attachment.file_id)}
                      className="p-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors shrink-0"
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

  const sections = groupBlocksIntoSections(content.blocks);
  const allExpanded = content.blocks.every((b, i) => b.type !== 'heading' || expandedSections[i]);
  const allCollapsed = content.blocks.every((b, i) => b.type !== 'heading' || !expandedSections[i]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Canvas Brief
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
            {/* Expand / Collapse all */}
            <div className="flex gap-1 ml-2">
              <button
                onClick={expandAll}
                disabled={allExpanded}
                className="text-xs px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40 transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                disabled={allCollapsed}
                className="text-xs px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40 transition-colors"
              >
                Collapse All
              </button>
            </div>
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
          <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 shrink-0">
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

        {/* Content — accordion sections */}
        <div className="flex-1 overflow-y-auto">
          <p className="text-xs text-muted-foreground px-6 pt-4 pb-2">
            Auto-saves every 2 seconds. Click a section heading to expand/collapse it.
          </p>
          <div className="px-6 pb-6 divide-y divide-border">
            {sections.map((section, sIdx) => {
              const isExpanded = section.headingIndex === -1 || expandedSections[section.headingIndex];

              if (section.headingIndex === -1) {
                // Orphan blocks before first heading
                return (
                  <div key={`orphan-${sIdx}`} className="py-3">
                    {section.contentBlocks.map(({ block, originalIndex }) =>
                      renderContentBlock(block, originalIndex)
                    )}
                  </div>
                );
              }

              return (
                <div key={`section-${section.headingIndex}`} className="py-1">
                  {/* Section toggle header */}
                  <div
                    className="flex items-center gap-2 w-full text-left py-3 group cursor-pointer"
                    onClick={() => toggleSection(section.headingIndex)}
                  >
                    <span className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />
                      }
                    </span>
                    {/* Clicking the heading text edits it; stop propagation so toggle doesn't fire */}
                    <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                      <MentionInput
                        value={section.heading.content}
                        onChange={(value) => updateBlock(section.headingIndex, 'content', value)}
                        className={`w-full bg-transparent border-none outline-none font-semibold ${
                          section.heading.level === 2 ? 'text-base' : 'text-sm'
                        } focus:ring-2 focus:ring-ring rounded px-1 py-0`}
                      />
                    </div>
                    {/* Preview snippet when collapsed */}
                    {!isExpanded && section.contentBlocks.length > 0 && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px] shrink-0">
                        {(() => {
                          const firstContent = section.contentBlocks.find(cb => cb.block.content || cb.block.items);
                          if (!firstContent) return `${section.contentBlocks.length} item(s)`;
                          if (firstContent.block.content) return firstContent.block.content.slice(0, 60);
                          if (Array.isArray(firstContent.block.items)) {
                            const first = firstContent.block.items[0];
                            return typeof first === 'string' ? first.slice(0, 60) : (first as any).text?.slice(0, 60);
                          }
                          return `${section.contentBlocks.length} item(s)`;
                        })()}
                      </span>
                    )}
                  </div>

                  {/* Section content (expanded) */}
                  {isExpanded && (
                    <div className="pl-6 pt-1 pb-2">
                      {section.contentBlocks.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No content in this section.</p>
                      ) : (
                        section.contentBlocks.map(({ block, originalIndex }) =>
                          renderContentBlock(block, originalIndex)
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-between shrink-0">
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
