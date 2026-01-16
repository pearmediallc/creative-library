/**
 * Upload Notifications
 * Toast-style notifications for upload events (Google Drive style)
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Upload, X } from 'lucide-react';
import { uploadQueueManager, UploadTask } from '../services/uploadQueueManager';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: number;
  autoClose?: boolean;
}

export function UploadNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [previousQueue, setPreviousQueue] = useState<UploadTask[]>([]);

  useEffect(() => {
    const unsubscribe = uploadQueueManager.subscribe((currentQueue) => {
      // Check for newly completed uploads
      currentQueue.forEach((task) => {
        const previousTask = previousQueue.find(t => t.id === task.id);

        // Upload just completed
        if (previousTask?.status !== 'completed' && task.status === 'completed') {
          addNotification({
            id: `complete-${task.id}`,
            type: 'success',
            title: 'Upload Complete',
            message: `${task.file?.name || 'File'} uploaded successfully`,
            timestamp: Date.now(),
            autoClose: true
          });
        }

        // Upload just failed
        if (previousTask?.status !== 'failed' && task.status === 'failed') {
          addNotification({
            id: `error-${task.id}`,
            type: 'error',
            title: 'Upload Failed',
            message: task.error || `${task.file?.name || 'File'} failed to upload`,
            timestamp: Date.now(),
            autoClose: false // Errors don't auto-close
          });
        }
      });

      // Check for newly added uploads (batch notification)
      const newUploads = currentQueue.filter(
        task => task.status === 'pending' && !previousQueue.find(t => t.id === task.id)
      );

      if (newUploads.length > 0) {
        const fileCount = newUploads.length;
        addNotification({
          id: `upload-start-${Date.now()}`,
          type: 'info',
          title: 'Upload Started',
          message: `${fileCount} file${fileCount > 1 ? 's' : ''} added to upload queue`,
          timestamp: Date.now(),
          autoClose: true
        });
      }

      setPreviousQueue(currentQueue);
    });

    // Initial load
    setPreviousQueue(uploadQueueManager.getQueue());

    return unsubscribe;
  }, [previousQueue]);

  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);

    // Auto-close after 5 seconds if enabled
    if (notification.autoClose) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, 5000);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Auto-cleanup old notifications (keep max 5)
  useEffect(() => {
    if (notifications.length > 5) {
      setNotifications(prev => prev.slice(0, 5));
    }
  }, [notifications]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[60] space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`bg-white dark:bg-gray-800 shadow-lg rounded-lg border-l-4 p-4 flex items-start gap-3 animate-slide-in ${
            notification.type === 'success'
              ? 'border-green-500'
              : notification.type === 'error'
              ? 'border-red-500'
              : 'border-blue-500'
          }`}
          style={{
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          {/* Icon */}
          <div className="flex-shrink-0">
            {notification.type === 'success' && (
              <CheckCircle className="w-6 h-6 text-green-500" />
            )}
            {notification.type === 'error' && (
              <AlertCircle className="w-6 h-6 text-red-500" />
            )}
            {notification.type === 'info' && (
              <Upload className="w-6 h-6 text-blue-500" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white">
              {notification.title}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
              {notification.message}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={() => removeNotification(notification.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
