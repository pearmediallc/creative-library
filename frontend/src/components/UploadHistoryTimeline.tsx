import React, { useEffect, useState } from 'react';
import { Upload, FileText, Clock, User } from 'lucide-react';
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
    <div className="space-y-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

        {/* Timeline items */}
        {uploadSessions.map((session, index) => (
          <div key={session.id} className="relative pl-10 pb-8 last:pb-0">
            {/* Timeline dot */}
            <div className={`absolute left-2.5 w-3 h-3 rounded-full ${
              session.is_deleted
                ? 'bg-red-400 dark:bg-red-600'
                : 'bg-blue-500 dark:bg-blue-400'
            }`} />

            {/* Content card */}
            <div className={`bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-sm ${
              session.is_deleted
                ? 'border-red-200 dark:border-red-800 opacity-60'
                : 'border-gray-200 dark:border-gray-700'
            }`}>
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {session.upload_type === 'folder' ? (
                    <FileText className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Upload className="w-4 h-4 text-blue-500" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {session.upload_type === 'folder' ? 'Folder Upload' : 'File Upload'}
                  </span>
                  {session.is_deleted && (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded">
                      Deleted
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDateTime(session.created_at)}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                {session.uploader_name && (
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3" />
                    <span>{session.uploader_name}</span>
                  </div>
                )}

                {session.folder_name && (
                  <div className="text-gray-700 dark:text-gray-200">
                    <strong>Folder:</strong> {session.folder_name}
                  </div>
                )}

                {session.folder_path && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Path: {session.folder_path}
                  </div>
                )}

                <div className="flex gap-4 mt-2 text-xs">
                  <span>
                    <strong>{session.file_count}</strong> {session.file_count === 1 ? 'file' : 'files'}
                  </span>
                  <span>
                    <strong>{formatFileSize(session.total_size_bytes)}</strong> total
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
