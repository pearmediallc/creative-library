import React, { useEffect, useState } from 'react';
import { Upload, FileText, Clock, User, ChevronDown, ChevronRight } from 'lucide-react';
import { fileRequestApi } from '../lib/api';
import { formatDateTime } from '../lib/utils';

interface UploadSession {
  id: string;
  file_request_id: string;
  uploaded_by: string;
  uploader_name?: string;
  upload_type: 'file' | 'folder';
  folder_path?: string;
  folder_name?: string;
  file_count: number;
  total_size_bytes: number;
  created_at: string;
  is_deleted: boolean;
}

interface UploadHistoryTimelineProps {
  requestId: string;
}

export function UploadHistoryTimeline({ requestId }: UploadHistoryTimelineProps) {
  const [uploadSessions, setUploadSessions] = useState<UploadSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  useEffect(() => {
    fetchUploadHistory();
  }, [requestId]);

  const fetchUploadHistory = async () => {
    try {
      setLoading(true);
      const response = await fileRequestApi.getUploadHistory(requestId);
      setUploadSessions(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch upload history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
        <Clock className="w-5 h-5 animate-spin mx-auto mb-2" />
        Loading upload history...
      </div>
    );
  }

  if (uploadSessions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Upload className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No upload history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {uploadSessions.map((session, index) => {
        const isExpanded = expandedSessions.has(session.id);

        return (
          <div
            key={session.id}
            className={`border rounded-lg overflow-hidden transition-colors ${
              session.is_deleted
                ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            {/* Accordion Header - Always visible */}
            <button
              onClick={() => toggleSession(session.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Expand/Collapse Icon */}
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}

                {/* Upload Type Icon */}
                {session.upload_type === 'folder' ? (
                  <FileText className="w-4 h-4 text-blue-500" />
                ) : (
                  <Upload className="w-4 h-4 text-blue-500" />
                )}

                {/* Summary Info */}
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {session.upload_type === 'folder' ? 'Folder Upload' : 'File Upload'}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {session.file_count} {session.file_count === 1 ? 'file' : 'files'}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {formatFileSize(session.total_size_bytes)}
                  </span>
                  {session.is_deleted && (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded">
                      Deleted
                    </span>
                  )}
                </div>
              </div>

              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDateTime(session.created_at)}
              </span>
            </button>

            {/* Accordion Content - Expandable */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <div className="space-y-2 text-sm">
                  {session.uploader_name && (
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <User className="w-3 h-3" />
                      <span className="font-medium">Uploaded by:</span>
                      <span>{session.uploader_name}</span>
                    </div>
                  )}

                  {session.folder_name && (
                    <div className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Folder:</span> {session.folder_name}
                    </div>
                  )}

                  {session.folder_path && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium">Path:</span> {session.folder_path}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs">
                    <Clock className="w-3 h-3" />
                    <span>Upload session ID: {session.id.slice(0, 8)}...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
