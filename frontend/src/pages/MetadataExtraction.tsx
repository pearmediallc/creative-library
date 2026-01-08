/**
 * Metadata Extraction Page
 * Allows users to extract and view detailed metadata from media files
 */
import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import {
  FileSearch, Upload, FolderOpen, Camera, MapPin, Calendar,
  Image as ImageIcon, Video, FileText, Download, Copy, Check,
  RefreshCw, X, Search, Filter
} from 'lucide-react';
import { mediaApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface MediaFile {
  id: string;
  original_filename: string;
  filename: string;
  file_type: string;
  file_size: number;
  s3_url: string;
  thumbnail_url?: string;
  created_at: string;
}

interface ExtractedMetadata {
  // Basic image info
  format?: string;
  width?: number;
  height?: number;
  size?: string;
  mode?: string;
  space?: string;
  channels?: number;
  depth?: string;
  hasProfile?: boolean;
  hasAlpha?: boolean;

  // EXIF data
  [key: string]: any; // For dynamic EXIF fields like EXIF:0th:Artist, EXIF:GPS:GPSLatitude, etc.
}

export function MetadataExtraction() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [extractedMetadata, setExtractedMetadata] = useState<ExtractedMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch files
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 50, offset: 0 };

      if (filterType !== 'all') {
        params.file_type = filterType;
      }

      if (searchTerm) {
        params.search = searchTerm;
      }

      const response = await mediaApi.getAll(params);
      setFiles(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  // Extract metadata for selected file
  const handleExtractMetadata = async (file: MediaFile) => {
    try {
      setExtracting(true);
      setSelectedFile(file);
      setExtractedMetadata(null);

      const response = await mediaApi.extractMetadata(file.id);
      setExtractedMetadata(response.data || {});
    } catch (error: any) {
      console.error('Failed to extract metadata:', error);
      alert(error.response?.data?.error || 'Failed to extract metadata');
    } finally {
      setExtracting(false);
    }
  };

  // Copy metadata value to clipboard
  const copyToClipboard = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Categorize metadata
  const categorizeMetadata = (meta: ExtractedMetadata) => {
    const categories: Record<string, Record<string, any>> = {
      'File Info': {},
      'EXIF Data': {},
      'GPS Location': {},
      'Camera Info': {},
      'Image Properties': {},
      'Other': {}
    };

    Object.entries(meta).forEach(([key, value]) => {
      // File basics
      if (['format', 'width', 'height', 'size', 'mode', 'space', 'channels', 'depth'].includes(key.toLowerCase())) {
        categories['File Info'][key] = value;
      }
      // GPS data
      else if (key.includes('GPS') || key.includes('Location')) {
        categories['GPS Location'][key] = value;
      }
      // Camera data
      else if (key.includes('Camera') || key.includes('Make') || key.includes('Model') ||
               key.includes('Lens') || key.includes('ISO') || key.includes('Aperture') ||
               key.includes('Shutter') || key.includes('Focal')) {
        categories['Camera Info'][key] = value;
      }
      // EXIF
      else if (key.startsWith('EXIF:')) {
        categories['EXIF Data'][key.replace('EXIF:', '')] = value;
      }
      // Image properties
      else if (key.includes('hasProfile') || key.includes('hasAlpha') || key.includes('Color')) {
        categories['Image Properties'][key] = value;
      }
      // Everything else
      else {
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

  const renderValue = (value: any): string => {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const filteredFiles = (files || []).filter(file => {
    if (!searchTerm) return true;
    return file.original_filename?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getFileIcon = (fileType: string) => {
    if (fileType?.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    if (fileType?.startsWith('video/')) return <Video className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FileSearch className="w-8 h-8" />
            Metadata Extraction
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Extract and view EXIF, GPS, and camera metadata from your media files
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <ImageIcon className="w-6 h-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Files</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{(files || []).length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <Camera className="w-6 h-6 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Images</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(files || []).filter(f => f.file_type?.startsWith('image/')).length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Video className="w-6 h-6 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Videos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(files || []).filter(f => f.file_type?.startsWith('video/')).length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <MapPin className="w-6 h-6 text-orange-600 dark:text-orange-300" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">With GPS</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">--</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchFiles()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Files</option>
                <option value="image">Images Only</option>
                <option value="video">Videos Only</option>
              </select>
              <Button onClick={fetchFiles} variant="outline">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* File List */}
          <Card className="p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Select a File
            </h2>

            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400 mt-4">Loading files...</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredFiles.length === 0 ? (
                  <div className="text-center py-12">
                    <FileSearch className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">No files found</p>
                  </div>
                ) : (
                  filteredFiles.map(file => (
                    <button
                      key={file.id}
                      onClick={() => handleExtractMetadata(file)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        selectedFile?.id === file.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-gray-600 dark:text-gray-400">
                          {getFileIcon(file.file_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {file.original_filename}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(file.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(file.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </Card>

          {/* Metadata Display */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Extracted Metadata
              </h2>
              {selectedFile && (
                <Button
                  onClick={() => handleExtractMetadata(selectedFile)}
                  variant="outline"
                  size="sm"
                  disabled={extracting}
                >
                  {extracting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>

            {!selectedFile ? (
              <div className="text-center py-20">
                <FileSearch className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Select a file to extract metadata
                </p>
              </div>
            ) : extracting ? (
              <div className="text-center py-20">
                <RefreshCw className="w-12 h-12 animate-spin mx-auto text-blue-500 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Extracting metadata...</p>
              </div>
            ) : !extractedMetadata || Object.keys(extractedMetadata).length === 0 ? (
              <div className="text-center py-20">
                <FileText className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No metadata found in this file
                </p>
              </div>
            ) : (
              <div className="space-y-6 max-h-[600px] overflow-y-auto">
                {Object.entries(categorizeMetadata(extractedMetadata)).map(([category, fields]) => (
                  <div key={category}>
                    <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                      {category === 'GPS Location' && <MapPin className="w-4 h-4" />}
                      {category === 'Camera Info' && <Camera className="w-4 h-4" />}
                      {category === 'File Info' && <FileText className="w-4 h-4" />}
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(fields).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        >
                          <div className="flex-1 min-w-0 mr-3">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              {key}
                            </p>
                            <p className="text-sm text-gray-900 dark:text-white break-words font-mono">
                              {renderValue(value)}
                            </p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(key, renderValue(value))}
                            className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            title="Copy to clipboard"
                          >
                            {copiedField === key ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Info Box */}
        <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex gap-3">
            <FileSearch className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                About Metadata Extraction
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                This tool extracts EXIF data, GPS coordinates, camera settings, and other embedded metadata
                from your images and videos. Metadata is automatically extracted when you upload files and
                can be viewed anytime. GPS data can reveal location information, while camera data shows
                settings like ISO, aperture, and focal length.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
