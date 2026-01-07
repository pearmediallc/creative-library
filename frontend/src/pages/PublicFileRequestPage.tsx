import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { fileRequestApi } from '../lib/api';
import { Upload, CheckCircle, AlertCircle, Calendar, Mail, User, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { formatDate } from '../lib/utils';

interface FileRequestInfo {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  allow_multiple_uploads: boolean;
  require_email: boolean;
  custom_message?: string;
  is_active: boolean;
  is_expired?: boolean;
  creator_name: string;
}

export function PublicFileRequestPage() {
  const { token } = useParams<{ token: string }>();
  const [request, setRequest] = useState<FileRequestInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploaderEmail, setUploaderEmail] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (token) {
      fetchRequestInfo();
    }
  }, [token]);

  const fetchRequestInfo = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fileRequestApi.getPublic(token!);
      setRequest(response.data.data);
    } catch (error: any) {
      console.error('Failed to fetch request info:', error);
      setError('File request not found or has been removed');
    } finally {
      setLoading(false);
    }
  };

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
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    if (request?.require_email && !uploaderEmail) {
      setError('Email is required for this file request');
      return;
    }

    if (request?.require_email && uploaderEmail && !isValidEmail(uploaderEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setUploading(true);
    setError('');

    try {
      await fileRequestApi.uploadToRequest(
        token!,
        selectedFile,
        uploaderEmail || undefined,
        uploaderName || undefined
      );

      setUploadSuccess(true);
      setUploadedFiles([...uploadedFiles, selectedFile.name]);
      setSelectedFile(null);
      setUploaderEmail('');
      setUploaderName('');

      // Reset success message after 5 seconds
      setTimeout(() => {
        setUploadSuccess(false);
      }, 5000);
    } catch (error: any) {
      console.error('Upload failed:', error);
      setError(error.response?.data?.error || 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Request Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!request) return null;

  const isExpired = request.is_expired || (request.deadline && new Date(request.deadline) < new Date());
  const canUpload = request.is_active && !isExpired;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 mb-6">
          <div className="text-center mb-6">
            <Upload className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {request.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Requested by {request.creator_name}
            </p>
          </div>

          {request.description && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300">{request.description}</p>
            </div>
          )}

          {request.custom_message && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">{request.custom_message}</p>
            </div>
          )}

          {/* Info badges */}
          <div className="flex flex-wrap gap-3 justify-center">
            {request.deadline && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
                <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-700 dark:text-gray-300">
                  Deadline: {formatDate(request.deadline)}
                </span>
              </div>
            )}
            {request.require_email && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
                <Mail className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-700 dark:text-gray-300">Email required</span>
              </div>
            )}
          </div>
        </div>

        {/* Upload Form */}
        {canUpload ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Upload Your File
            </h2>

            <form onSubmit={handleUpload} className="space-y-6">
              {/* File Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-700 dark:text-gray-300 mb-2">
                      Drag and drop your file here, or
                    </p>
                    <label className="inline-block">
                      <span className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium">
                        browse files
                      </span>
                      <input
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Email Input */}
              {request.require_email && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address *
                  </label>
                  <Input
                    type="email"
                    value={uploaderEmail}
                    onChange={(e) => setUploaderEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    disabled={uploading}
                    required
                  />
                </div>
              )}

              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Name (optional)
                </label>
                <Input
                  type="text"
                  value={uploaderName}
                  onChange={(e) => setUploaderName(e.target.value)}
                  placeholder="John Doe"
                  disabled={uploading}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {uploadSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-green-800 dark:text-green-200">
                      File uploaded successfully!
                      {request.allow_multiple_uploads && ' You can upload another file.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <Button
                type="submit"
                disabled={!selectedFile || uploading}
                className="w-full"
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </Button>
            </form>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Uploaded Files ({uploadedFiles.length})
                </h3>
                <ul className="space-y-2">
                  {uploadedFiles.map((filename, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                    >
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      {filename}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {isExpired ? 'Request Expired' : 'Request Closed'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {isExpired
                ? 'This file request has expired and is no longer accepting uploads.'
                : 'This file request has been closed and is no longer accepting uploads.'}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Powered by <span className="font-semibold">Creative Library</span>
          </p>
        </div>
      </div>
    </div>
  );
}
