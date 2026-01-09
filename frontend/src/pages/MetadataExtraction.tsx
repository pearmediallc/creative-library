/**
 * Metadata Extraction Page
 * Complete workflow for adding, removing, and extracting metadata from media files
 */
import React, { useState, useCallback } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import {
  FileSearch, Upload, Plus, Minus, Download, Check, RefreshCw, X, Info, AlertCircle
} from 'lucide-react';
import { metadataApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

type WorkflowMode = 'add' | 'remove' | 'extract';

interface ProcessedFile {
  originalName: string;
  downloadUrl: string;
  metadata?: any;
  removedFields?: string[];
}

export function MetadataExtraction() {
  const [mode, setMode] = useState<WorkflowMode>('add');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [creatorId, setCreatorId] = useState('');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [keywords, setKeywords] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processedFile, setProcessedFile] = useState<ProcessedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractedMetadata, setExtractedMetadata] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setProcessedFile(null);
      setError(null);
      setExtractedMetadata(null);
    }
  };

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setProcessedFile(null);
      setError(null);
      setExtractedMetadata(null);
    }
  }, []);

  // Reset form
  const resetForm = () => {
    setSelectedFile(null);
    setCreatorId('');
    setDescription('');
    setTitle('');
    setKeywords('');
    setProcessedFile(null);
    setError(null);
    setExtractedMetadata(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle Add Metadata
  const handleAddMetadata = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    if (!creatorId.trim()) {
      setError('Creator ID is required');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      const response = await metadataApi.addMetadata(selectedFile, creatorId.trim(), {
        description: description.trim() || undefined,
        title: title.trim() || undefined,
        keywords: keywords.trim() || undefined,
      });

      const data = response.data.data;
      setProcessedFile({
        originalName: data.original_filename,
        downloadUrl: data.download_url,
        metadata: data.metadata,
      });
    } catch (err: any) {
      console.error('Failed to add metadata:', err);
      setError(err.response?.data?.error || 'Failed to add metadata to file');
    } finally {
      setProcessing(false);
    }
  };

  // Handle Remove Metadata
  const handleRemoveMetadata = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      const response = await metadataApi.removeMetadata(selectedFile);

      const data = response.data.data;
      setProcessedFile({
        originalName: data.original_filename,
        downloadUrl: data.download_url,
        removedFields: data.removed_fields,
      });
    } catch (err: any) {
      console.error('Failed to remove metadata:', err);
      setError(err.response?.data?.error || 'Failed to remove metadata from file');
    } finally {
      setProcessing(false);
    }
  };

  // Handle Extract Metadata
  const handleExtractMetadata = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      const response = await metadataApi.extractMetadata(selectedFile);

      const data = response.data.data;
      setExtractedMetadata(data.metadata);
    } catch (err: any) {
      console.error('Failed to extract metadata:', err);
      setError(err.response?.data?.error || 'Failed to extract metadata from file');
    } finally {
      setProcessing(false);
    }
  };

  // Handle Process Button
  const handleProcess = () => {
    if (mode === 'add') {
      handleAddMetadata();
    } else if (mode === 'remove') {
      handleRemoveMetadata();
    } else if (mode === 'extract') {
      handleExtractMetadata();
    }
  };

  // Handle Download
  const handleDownload = () => {
    if (!processedFile?.downloadUrl) return;

    const link = document.createElement('a');
    link.href = processedFile.downloadUrl;
    link.download = processedFile.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderValue = (value: any): string => {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FileSearch className="w-8 h-8" />
            Metadata Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Add, remove, or extract metadata from your images and videos
          </p>
        </div>

        {/* Mode Selection */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant={mode === 'add' ? 'default' : 'outline'}
              onClick={() => { setMode('add'); resetForm(); }}
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Metadata
            </Button>
            <Button
              variant={mode === 'remove' ? 'default' : 'outline'}
              onClick={() => { setMode('remove'); resetForm(); }}
              className="flex-1"
            >
              <Minus className="w-4 h-4 mr-2" />
              Remove Metadata
            </Button>
            <Button
              variant={mode === 'extract' ? 'default' : 'outline'}
              onClick={() => { setMode('extract'); resetForm(); }}
              className="flex-1"
            >
              <FileSearch className="w-4 h-4 mr-2" />
              Extract Metadata
            </Button>
          </div>
        </Card>

        {/* Main Workflow */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Input */}
          <Card className="p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {mode === 'add' && 'Step 1: Select File & Add Creator Info'}
              {mode === 'remove' && 'Step 1: Select File to Clean'}
              {mode === 'extract' && 'Step 1: Select File to Analyze'}
            </h2>

            {/* File Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Drag and drop a file here, or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse Files
              </Button>

              {selectedFile && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Selected: {selectedFile.name}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>

            {/* Add Metadata Form */}
            {mode === 'add' && (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Creator ID / Editor Name *
                  </label>
                  <input
                    type="text"
                    value={creatorId}
                    onChange={(e) => setCreatorId(e.target.value)}
                    placeholder="e.g., John Doe, Editor123"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Product Launch Video"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Keywords (Optional)
                  </label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="e.g., marketing, campaign, 2024"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Process Button */}
            <div className="mt-6">
              <Button
                onClick={handleProcess}
                disabled={!selectedFile || processing || (mode === 'add' && !creatorId.trim())}
                className="w-full"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {mode === 'add' && <><Plus className="w-4 h-4 mr-2" />Add Metadata</>}
                    {mode === 'remove' && <><Minus className="w-4 h-4 mr-2" />Remove Metadata</>}
                    {mode === 'extract' && <><FileSearch className="w-4 h-4 mr-2" />Extract Metadata</>}
                  </>
                )}
              </Button>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">Error</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </Card>

          {/* Right Panel - Results */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {mode === 'add' && 'Step 2: Download Tagged File'}
                {mode === 'remove' && 'Step 2: Download Cleaned File'}
                {mode === 'extract' && 'Results: Extracted Metadata'}
              </h2>
              {processedFile && mode !== 'extract' && (
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              )}
            </div>

            {/* Results Display */}
            {!processedFile && !extractedMetadata ? (
              <div className="text-center py-20">
                <FileSearch className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {mode === 'add' && 'Select a file and add creator information, then click "Add Metadata"'}
                  {mode === 'remove' && 'Select a file and click "Remove Metadata" to strip all EXIF/GPS data'}
                  {mode === 'extract' && 'Select a file and click "Extract Metadata" to view all embedded data'}
                </p>
              </div>
            ) : mode === 'extract' && extractedMetadata ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Metadata Extracted Successfully
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Found {Object.keys(extractedMetadata).length} metadata fields
                    </p>
                  </div>
                </div>

                {Object.keys(extractedMetadata).length === 0 ? (
                  <div className="text-center py-12">
                    <Info className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">No metadata found in this file</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(extractedMetadata).map(([key, value]) => (
                      <div
                        key={key}
                        className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          {key}
                        </p>
                        <p className="text-sm text-gray-900 dark:text-white break-words font-mono">
                          {renderValue(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : processedFile ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      {mode === 'add' ? 'Metadata Added Successfully' : 'Metadata Removed Successfully'}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      File: {processedFile.originalName}
                    </p>
                  </div>
                </div>

                {mode === 'add' && processedFile.metadata && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Embedded Metadata:
                    </h3>
                    {processedFile.metadata.embedded_fields && (
                      <div className="space-y-2">
                        {Object.entries(processedFile.metadata.embedded_fields).map(([key, value]) => (
                          <div key={key} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              {key}
                            </p>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {String(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {mode === 'remove' && processedFile.removedFields && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Removed Fields:
                    </h3>
                    <div className="space-y-1">
                      {processedFile.removedFields.map((field, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <Check className="w-4 h-4 text-green-600" />
                          {field}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button onClick={handleDownload} className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Download Processed File
                  </Button>
                </div>

                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Process Another File
                </Button>
              </div>
            ) : null}
          </Card>
        </div>

        {/* Info Box */}
        <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex gap-3">
            <Info className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                {mode === 'add' && 'About Adding Metadata'}
                {mode === 'remove' && 'About Removing Metadata'}
                {mode === 'extract' && 'About Extracting Metadata'}
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {mode === 'add' && 'Embed creator information, copyright, and custom metadata into your images and videos. This data will be permanently embedded in the file and can be used for attribution, copyright protection, and organization.'}
                {mode === 'remove' && 'Strip all EXIF data, GPS coordinates, camera information, and other metadata from your files. This is useful for privacy protection and removing sensitive location data before sharing.'}
                {mode === 'extract' && 'View all embedded metadata including EXIF data, GPS coordinates, camera settings, and more. This tool does not modify the file, only displays the information stored within it.'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
