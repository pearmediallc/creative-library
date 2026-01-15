import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { notificationSound } from '../utils/notificationSound';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  actor_id?: string;
  actor_name?: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: any;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

interface UseNotificationsOptions {
  pollInterval?: number; // in milliseconds
  enableSound?: boolean;
  enableBrowserNotifications?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    pollInterval = 30000, // Poll every 30 seconds by default
    enableSound = true,
    enableBrowserNotifications = true
  } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const previousUnreadCountRef = useRef(0);

  // Request browser notification permission
  useEffect(() => {
    if (enableBrowserNotifications && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [enableBrowserNotifications]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 20 }
      });

      const data = response.data;
      setNotifications(data.notifications || []);

      const newUnreadCount = data.unreadCount || 0;
      const previousUnreadCount = previousUnreadCountRef.current;

      // If there are new unread notifications
      if (newUnreadCount > previousUnreadCount && previousUnreadCount > 0) {
        // Play sound
        if (enableSound) {
          const latestNotification = (data.notifications || [])[0];
          const soundType = latestNotification?.type === 'mention' ? 'mention' :
                           latestNotification?.type === 'file_request_assigned' ? 'request' :
                           'default';
          notificationSound.playNotificationSound(soundType);
        }

        // Show browser notification
        if (enableBrowserNotifications && 'Notification' in window && Notification.permission === 'granted') {
          const latestNotification = (data.notifications || [])[0];
          if (latestNotification && !latestNotification.is_read) {
            new Notification(latestNotification.title, {
              body: latestNotification.message,
              icon: '/logo192.png',
              tag: latestNotification.id
            });
          }
        }
      }

      setUnreadCount(newUnreadCount);
      previousUnreadCountRef.current = newUnreadCount;
    } catch (error: any) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [enableSound, enableBrowserNotifications]);

  // Poll for new notifications
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, pollInterval);
    return () => clearInterval(interval);
  }, [fetchNotifications, pollInterval]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.patch(
        `${API_BASE_URL}/notifications/${notificationId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.post(
        `${API_BASE_URL}/notifications/mark-all-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      previousUnreadCountRef.current = 0;
    } catch (error: any) {
      console.error('Failed to mark all as read:', error);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.delete(`${API_BASE_URL}/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error: any) {
      console.error('Failed to delete notification:', error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications
  };
}
