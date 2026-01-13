import React from 'react';
import { FileText, Download, X } from 'lucide-react';
import type { CanvasContent, CanvasAttachment } from '../lib/canvasTemplates';

interface CanvasRendererProps {
  content: CanvasContent;
  attachments: CanvasAttachment[];
  onClose: () => void;
  readOnly?: boolean;
}

export function CanvasRenderer({
  content,
  attachments,
  onClose,
  readOnly = true
}: CanvasRendererProps) {
  const renderBlock = (block: any, index: number) => {
    switch (block.type) {
      case 'heading':
        const HeadingTag = `h${block.level}` as keyof JSX.IntrinsicElements;
        return (
          <HeadingTag
            key={index}
            className={`font-semibold ${
              block.level === 2 ? 'text-xl mt-6 mb-3' : 'text-lg mt-4 mb-2'
            }`}
          >
            {block.content}
          </HeadingTag>
        );

      case 'text':
        return (
          <p key={index} className="text-sm text-muted-foreground mb-2">
            {block.content}
          </p>
        );

      case 'list':
        return (
          <ul key={index} className="list-disc list-inside mb-4 space-y-1">
            {block.items?.map((item: string, i: number) => (
              <li key={i} className="text-sm">
                {item}
              </li>
            ))}
          </ul>
        );

      case 'checklist':
        return (
          <div key={index} className="space-y-2 mb-4">
            {block.items?.map((item: any, i: number) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={readOnly}
                  className="rounded border-border"
                />
                <span className={item.checked ? 'line-through text-muted-foreground' : ''}>
                  {item.text}
                </span>
              </label>
            ))}
          </div>
        );

      case 'attachments':
        if (attachments.length === 0) {
          return (
            <div
              key={index}
              className="border-2 border-dashed border-border rounded-md p-6 text-center mb-4"
            >
              <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{block.placeholder}</p>
            </div>
          );
        }

        return (
          <div key={index} className="space-y-2 mb-4">
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
                <a
                  href={attachment.file_url}
                  download
                  className="p-2 hover:bg-accent rounded-md transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Canvas Brief
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {content.blocks.map((block, index) => renderBlock(block, index))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:brightness-95 transition-colors"
          >
            Close
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
