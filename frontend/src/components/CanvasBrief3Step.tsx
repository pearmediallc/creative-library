import React, { useState } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';

interface CanvasBrief3StepProps {
  requestId: string;
  initialContent?: string;
  onSave: (content: any, files: File[]) => void;
  onClose: () => void;
}

interface UploadedSample {
  file: File;
  preview?: string;
  instruction: string;
}

export function CanvasBrief3Step({ requestId, initialContent, onSave, onClose }: CanvasBrief3StepProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Parse initial content if exists
  const parsedInitial = initialContent ? JSON.parse(initialContent) : {};

  const [headline, setHeadline] = useState(parsedInitial.headline || '');
  const [script, setScript] = useState(parsedInitial.script || '');
  // When editing, samples won't have File objects, just metadata
  // We'll store them separately and only upload new files
  const [samples, setSamples] = useState<UploadedSample[]>([]);
  const [existingSamples, setExistingSamples] = useState<any[]>(parsedInitial.samples || []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newSamples = files.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      instruction: ''
    }));
    setSamples([...samples, ...newSamples]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const newSamples = files.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      instruction: ''
    }));
    setSamples([...samples, ...newSamples]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const updateInstruction = (index: number, instruction: string) => {
    const updated = [...samples];
    updated[index].instruction = instruction;
    setSamples(updated);
  };

  const removeSample = (index: number) => {
    const updated = samples.filter((_, i) => i !== index);
    setSamples(updated);
  };

  const removeExistingSample = (index: number) => {
    const updated = existingSamples.filter((_, i) => i !== index);
    setExistingSamples(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);

    // Combine existing samples with new samples
    const newSamplesMetadata = samples.map(s => ({
      filename: s.file.name,
      instruction: s.instruction,
      type: s.file.type,
      size: s.file.size
    }));

    const allSamples = [...existingSamples, ...newSamplesMetadata];

    // Prepare data for saving
    const content = {
      headline,
      script,
      samples: allSamples,
      created_at: parsedInitial.created_at || new Date().toISOString()
    };

    // Pass both content and files to parent (only new files)
    const files = samples.map(s => s.file);
    await onSave(JSON.stringify(content), files);

    setIsSaving(false);
  };

  const canSave = () => {
    return headline.trim().length > 0 || script.trim().length > 0 || samples.length > 0;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Canvas Brief
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Define your creative requirements
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Headline Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Headline
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter the main headline for this creative..."
            />
          </div>

          {/* Script Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Script
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={8}
              placeholder="Write the script or detailed description for the creative..."
            />
          </div>

          {/* Samples Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reference Samples
            </label>

            {/* Drag & Drop Area */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer"
              onClick={() => document.getElementById('canvas-file-input')?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Images, videos, or any reference files
              </p>
              <input
                id="canvas-file-input"
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,video/*"
              />
            </div>

            {/* Uploaded Samples List */}
            {(existingSamples.length > 0 || samples.length > 0) && (
              <div className="mt-6 space-y-4">
                {/* Existing Samples */}
                {existingSamples.map((sample, index) => (
                  <div
                    key={`existing-${index}`}
                    className="border border-blue-200 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20"
                  >
                    <div className="flex items-start gap-4">
                      {/* Placeholder for existing files */}
                      <div className="w-20 h-20 bg-blue-100 dark:bg-blue-800 rounded flex items-center justify-center">
                        <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      </div>

                      {/* File Info */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {sample.filename}
                            </span>
                            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                              (Existing)
                            </span>
                          </div>
                          <button
                            onClick={() => removeExistingSample(index)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600"
                            title="Remove file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          {sample.size ? `${(sample.size / 1024).toFixed(2)} KB` : 'Size unknown'}
                        </p>

                        {/* Instruction Display (read-only for existing) */}
                        {sample.instruction && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded p-2 border border-gray-300 dark:border-gray-700">
                            {sample.instruction}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* New Samples */}
                {samples.map((sample, index) => (
                  <div
                    key={`new-${index}`}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900"
                  >
                    <div className="flex items-start gap-4">
                      {/* Preview */}
                      {sample.preview ? (
                        <img
                          src={sample.preview}
                          alt={sample.file.name}
                          className="w-20 h-20 object-cover rounded"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                          <Upload className="w-8 h-8 text-gray-400" />
                        </div>
                      )}

                      {/* File Info and Instruction */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {sample.file.name}
                            </span>
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                              (New)
                            </span>
                          </div>
                          <button
                            onClick={() => removeSample(index)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600"
                            title="Remove file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                          {(sample.file.size / 1024).toFixed(2)} KB
                        </p>

                        {/* Instruction Box */}
                        <textarea
                          value={sample.instruction}
                          onChange={(e) => updateInstruction(index, e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={2}
                          placeholder="Add specific instructions for this sample..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !canSave()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Canvas Brief'}
          </button>
        </div>
      </div>
    </div>
  );
}
