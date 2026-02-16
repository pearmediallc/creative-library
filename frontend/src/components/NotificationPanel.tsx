import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, Trash2, CheckCheck } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

export function NotificationPanel() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications({
    pollInterval: 30000, // Poll every 30 seconds
    enableSound: true,
    enableBrowserNotifications: true
  });

  /**
   * Handle notification click - navigate to relevant page
   */
  const handleNotificationClick = async (notification: any) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Close panel
    setIsOpen(false);

    // Route based on notification type and reference
    if (notification.reference_type === 'file_request' && notification.reference_id) {
      navigate(`/file-requests/${notification.reference_id}`);
    } else if (notification.reference_type === 'file' && notification.reference_id) {
      navigate(`/media/${notification.reference_id}`);
    } else if (notification.reference_type === 'canvas' && notification.reference_id) {
      // Canvas notifications usually have a file request ID in metadata
      const metadata = notification.metadata || {};
      if (metadata.fileRequestId) {
        navigate(`/file-requests/${metadata.fileRequestId}`);
      }
    } else if (notification.reference_type === 'folder' && notification.reference_id) {
      navigate(`/folders/${notification.reference_id}`);
    } else if (notification.type === 'file_shared') {
      navigate('/shared-with-me');
    } else if (notification.type === 'file_request_assigned') {
      navigate('/file-requests');
    } else {
      // Default: go to dashboard
      navigate('/dashboard');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'file_request_assigned':
        return '📋';
      case 'file_shared':
        return '📁';
      case 'team_invite':
        return '👥';
      case 'mention':
        return '@';
      case 'file_request_completed':
        return '✅';
      default:
        return '🔔';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'file_request_assigned':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400';
      case 'file_shared':
        return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400';
      case 'team_invite':
        return 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400';
      case 'mention':
        return 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400';
      case 'file_request_completed':
        return 'bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Bell size={20} className="text-gray-600 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-12 w-96 max-h-[600px] bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={markAllAsRead}
                    title="Mark all as read"
                  >
                    <CheckCheck size={16} />
                  </Button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${
                        !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div
                          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl ${getNotificationColor(
                            notification.type
                          )}`}
                        >
                          {getNotificationIcon(notification.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{notification.title}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDistanceToNow(new Date(notification.created_at), {
                                  addSuffix: true
                                })}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              {!notification.is_read && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                  }}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                  title="Mark as read"
                                >
                                  <Check size={14} className="text-blue-600" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                title="Delete"
                              >
                                <Trash2 size={14} className="text-gray-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
