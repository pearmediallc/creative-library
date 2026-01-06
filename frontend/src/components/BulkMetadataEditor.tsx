import React, { useState, useEffect } from 'react';
import { mediaApi, editorApi } from '../lib/api';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { MediaFile, Editor } from '../types';

interface BulkMetadataEditorProps {
  selectedFiles: MediaFile[];
  onClose: () => void;
  onComplete: () => void;
}

export function BulkMetadataEditor({
  selectedFiles,
  onClose,
  onComplete
}: BulkMetadataEditorProps) {
  const [operation, setOperation] = useState<'add' | 'remove' | 'remove_and_add'>('add');
  const [editors, setEditors] = useState<Editor[]>([]);
  const [metadata, setMetadata] = useState({
    creator_id: '',
    tags: '',
    description: '',
    campaign_id: '',
    preserve_tags: true
  });
  const [processing, setProcessing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);

  // Fetch editors
  useEffect(() => {
    const loadEditors = async () => {
      try {
        const response = await editorApi.getAll();
        setEditors(response.data.data || []);
      } catch (error) {
        console.error('Failed to load editors:', error);
      }
    };
    loadEditors();
  }, []);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const response = await mediaApi.getBulkStatus(jobId);
        const job = response.data.data;

        setProgress(job.progress || 0);

        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          clearInterval(interval);
          setProcessing(false);
          setResults(job);
        }
      } catch (error) {
        console.error('Failed to fetch job status:', error);
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [jobId]);

  const handleSubmit = async () => {
    setProcessing(true);

    try {
      const response = await mediaApi.bulkMetadata({
        file_ids: selectedFiles.map(f => f.id),
        operation,
        metadata: {
          ...metadata,
          tags: metadata.tags.split(',').map(t => t.trim()).filter(Boolean)
        }
      });

      setJobId(response.data.data.job_id);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to start bulk operation');
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (jobId) {
      try {
        await mediaApi.cancelBulkOperation(jobId);
      } catch (error) {
        console.error('Failed to cancel operation:', error);
      }
    }
    setProcessing(false);
    onClose();
  };

  // Show results
  if (results) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          <div className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">
              {results.status === 'completed' ? '✅ ' : results.status === 'cancelled' ? '🚫 ' : '❌ '}
              Bulk Operation {results.status === 'completed' ? 'Complete' : results.status === 'cancelled' ? 'Cancelled' : 'Failed'}
            </h2>

            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
                <div className="text-2xl font-bold">{results.total}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
              </div>
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded">
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{results.successful}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Success</div>
              </div>
              <div className="p-4 bg-red-100 dark:bg-red-900 rounded">
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">{results.failed}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
              </div>
              <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {results.totalTime ? (results.totalTime / 1000).toFixed(1) : '0'}s
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Time</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Results:</h3>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {results.results && results.results.map((result: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-2 rounded text-sm ${
                      result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                    }`}
                  >
                    {result.success ? '✓' : '✗'} {result.filename || `File ${idx + 1}`}
                    {result.success && result.processingTime && (
                      <span className="text-gray-500 ml-2 text-xs">
                        ({(result.processingTime / 1000).toFixed(1)}s)
                      </span>
                    )}
                    {result.error && (
                      <span className="text-red-600 dark:text-red-400 ml-2">- {result.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  onComplete();
                  onClose();
                }}
                className="flex-1"
              >
                View Updated Files
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Show processing
  if (processing) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md">
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-bold">Processing Metadata Operations...</h2>

            <div className="space-y-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {progress}% Complete ({Math.round((progress / 100) * selectedFiles.length)} / {selectedFiles.length} files)
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleCancel}
              className="w-full"
            >
              Cancel Operation
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Show configuration
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold">Bulk Metadata Operations</h2>
            <p className="text-gray-600 dark:text-gray-400">{selectedFiles.length} files selected</p>
          </div>

          <div className="space-y-3">
            <label className="block font-semibold">Choose Operation:</label>

            <label className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <input
                type="radio"
                checked={operation === 'remove'}
                onChange={() => setOperation('remove')}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium">Remove All Metadata</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Strip all EXIF, IPTC, XMP data</div>
              </div>
            </label>

            <label className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <input
                type="radio"
                checked={operation === 'add'}
                onChange={() => setOperation('add')}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium">Add/Update Metadata</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Embed creator information</div>
              </div>
            </label>

            <label className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <input
                type="radio"
                checked={operation === 'remove_and_add'}
                onChange={() => setOperation('remove_and_add')}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium">Remove Then Add New</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Clean files then embed fresh metadata</div>
              </div>
            </label>
          </div>

          {(operation === 'add' || operation === 'remove_and_add') && (
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded">
              <h3 className="font-semibold">Metadata to Embed:</h3>

              <div>
                <label className="block text-sm font-medium mb-1">Creator/Editor</label>
                <select
                  value={metadata.creator_id}
                  onChange={(e) => setMetadata({ ...metadata, creator_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-900"
                >
                  <option value="">Select editor...</option>
                  {editors.map((editor) => (
                    <option key={editor.id} value={editor.name}>
                      {editor.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={metadata.tags}
                  onChange={(e) => setMetadata({ ...metadata, tags: e.target.value })}
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-900"
                  placeholder="summer, sale, promo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={metadata.description}
                  onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-900"
                  rows={2}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Campaign ID</label>
                <input
                  type="text"
                  value={metadata.campaign_id}
                  onChange={(e) => setMetadata({ ...metadata, campaign_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-900"
                  placeholder="Optional campaign identifier"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="preserve_tags"
                  checked={metadata.preserve_tags}
                  onChange={(e) => setMetadata({ ...metadata, preserve_tags: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="preserve_tags" className="text-sm">
                  Preserve existing tags (merge with new tags)
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1"
              disabled={operation !== 'remove' && !metadata.creator_id}
            >
              Start Processing
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
