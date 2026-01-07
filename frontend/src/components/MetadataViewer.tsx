import React from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { X, Copy, Check } from 'lucide-react';

interface MetadataViewerProps {
  metadata: Record<string, any>;
  filename: string;
  onClose: () => void;
}

export function MetadataViewer({ metadata, filename, onClose }: MetadataViewerProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const copyToClipboard = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const renderValue = (value: any): string => {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  // Group metadata by category
  const categorizeMetadata = (meta: Record<string, any>) => {
    const categories: Record<string, Record<string, any>> = {
      'File Info': {},
      'EXIF': {},
      'PNG': {},
      'Creator': {},
      'Other': {}
    };

    Object.entries(meta).forEach(([key, value]) => {
      if (['Format', 'Size', 'Mode'].includes(key)) {
        categories['File Info'][key] = value;
      } else if (key.startsWith('EXIF:')) {
        categories['EXIF'][key.replace('EXIF:', '')] = value;
      } else if (key.startsWith('PNG:')) {
        categories['PNG'][key.replace('PNG:', '')] = value;
      } else if (key.toLowerCase().includes('creator') || key.toLowerCase().includes('author') || key.toLowerCase().includes('artist')) {
        categories['Creator'][key] = value;
      } else {
        categories['Other'][key] = value;
      }
    });

    // Remove empty categories
    Object.keys(categories).forEach(cat => {
      if (Object.keys(categories[cat]).length === 0) {
        delete categories[cat];
      }
    });

    return categories;
  };

  const categories = categorizeMetadata(metadata);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">Metadata Inspector</h2>
            <p className="text-sm text-muted-foreground truncate mt-1" title={filename}>
              {filename}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {Object.keys(metadata).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No metadata found in this file</p>
              <p className="text-sm text-muted-foreground mt-2">
                This file may have been cleaned or doesn't contain embedded metadata.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(categories).map(([category, fields]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold mb-3 text-primary">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(fields).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-start gap-3 p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-foreground mb-1">
                            {key}
                          </div>
                          <div className="text-sm text-muted-foreground break-all font-mono">
                            {renderValue(value)}
                          </div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(key, renderValue(value))}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-background rounded"
                          title="Copy value"
                        >
                          {copiedField === key ? (
                            <Check size={16} className="text-green-600" />
                          ) : (
                            <Copy size={16} className="text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/20">
          <div className="text-sm text-muted-foreground">
            {Object.keys(metadata).length} field{Object.keys(metadata).length !== 1 ? 's' : ''} found
          </div>
          <Button onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}
