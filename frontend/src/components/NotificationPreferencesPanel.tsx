import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Bell, Volume2, Chrome, MessageSquare, Save, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

interface NotificationTypePreferences {
  [key: string]: {
    browser: boolean;
    sound: boolean;
    slack: boolean;
  };
}

interface UserPreferences {
  browser_notifications_enabled: boolean;
  notification_sound_enabled: boolean;
  slack_notifications_enabled: boolean;
  notification_type_preferences: NotificationTypePreferences;
}

const NOTIFICATION_TYPES = [
  { key: 'file_request_assigned', label: 'File Request Assigned', description: 'When a new file request is assigned to you', important: true },
  { key: 'launch_request_assigned', label: 'Launch Request Assigned', description: 'When a new launch request is assigned to you', important: true },
  { key: 'file_shared', label: 'File Shared', description: 'When someone shares a file with you' },
  { key: 'file_request_completed', label: 'File Request Completed', description: 'When a file request is completed' },
  { key: 'file_request_reassigned', label: 'File Request Reassigned', description: 'When a request is reassigned to you' },
  { key: 'launch_request_created', label: 'Launch Request Created', description: 'When a new launch request is created' },
  { key: 'launch_request_updated', label: 'Launch Request Updated', description: 'When a launch request is updated', important: false },
  { key: 'launch_request_launched', label: 'Launch Request Launched', description: 'When a launch request goes live' },
  { key: 'launch_request_closed', label: 'Launch Request Closed', description: 'When a launch request is closed' },
  { key: 'comment_mentioned', label: 'Mentioned in Comments', description: 'When someone mentions you in a comment', important: true },
  { key: 'access_request', label: 'Access Request Received', description: 'When someone requests access to your files', important: true },
  { key: 'access_request_approved', label: 'Access Request Approved', description: 'When your access request is approved' },
  { key: 'access_request_denied', label: 'Access Request Denied', description: 'When your access request is denied' },
  { key: 'public_link_created', label: 'Public Link Created', description: 'When you create a public link', important: false },
];

export function NotificationPreferencesPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    browser_notifications_enabled: true,
    notification_sound_enabled: true,
    slack_notifications_enabled: true,
    notification_type_preferences: {}
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    fetchPreferences();
    checkBrowserPermission();
  }, []);

  const checkBrowserPermission = () => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  };

  const requestBrowserPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission === 'granted') {
        setSuccessMessage('Browser notifications enabled successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    }
  };

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const user = response.data.data;
      setPreferences({
        browser_notifications_enabled: user.browser_notifications_enabled ?? true,
        notification_sound_enabled: user.notification_sound_enabled ?? true,
        slack_notifications_enabled: user.slack_notifications_enabled ?? true,
        notification_type_preferences: user.notification_type_preferences || {}
      });
    } catch (err: any) {
      console.error('Failed to fetch preferences:', err);
      setError('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      const token = localStorage.getItem('token');
      await axios.patch(
        `${API_BASE_URL}/users/me/notification-preferences`,
        preferences,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccessMessage('Notification preferences saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Failed to save preferences:', err);
      setError(err.response?.data?.error || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const toggleMasterSetting = (key: keyof UserPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleNotificationType = (notifType: string, channel: 'browser' | 'sound' | 'slack') => {
    setPreferences(prev => {
      const currentPrefs = prev.notification_type_preferences[notifType] || {
        browser: true,
        sound: true,
        slack: true
      };

      return {
        ...prev,
        notification_type_preferences: {
          ...prev.notification_type_preferences,
          [notifType]: {
            ...currentPrefs,
            [channel]: !currentPrefs[channel]
          }
        }
      };
    });
  };

  const getTypePreference = (notifType: string, channel: 'browser' | 'sound' | 'slack'): boolean => {
    return preferences.notification_type_preferences[notifType]?.[channel] ?? true;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading preferences...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Preferences
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Control how and when you receive notifications
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded">
            {successMessage}
          </div>
        )}

        {/* Master Controls */}
        <div className="space-y-4 pb-6 border-b">
          <h3 className="font-medium">Master Controls</h3>

          <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Chrome className="w-5 h-5 text-blue-600" />
              <div>
                <div className="font-medium">Browser Popups</div>
                <div className="text-sm text-muted-foreground">Show desktop notifications</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {browserPermission === 'denied' && (
                <span className="text-xs text-red-600 mr-2">Blocked by browser</span>
              )}
              {browserPermission === 'default' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={requestBrowserPermission}
                >
                  Enable
                </Button>
              )}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={preferences.browser_notifications_enabled}
                  onChange={() => toggleMasterSetting('browser_notifications_enabled')}
                  disabled={browserPermission === 'denied'}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-purple-600" />
              <div>
                <div className="font-medium">Notification Sounds</div>
                <div className="text-sm text-muted-foreground">Play sound alerts</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={preferences.notification_sound_enabled}
                onChange={() => toggleMasterSetting('notification_sound_enabled')}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium">Slack Notifications</div>
                <div className="text-sm text-muted-foreground">Send messages to Slack</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={preferences.slack_notifications_enabled}
                onChange={() => toggleMasterSetting('slack_notifications_enabled')}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Per-Notification Type Controls */}
        <div className="space-y-4">
          <h3 className="font-medium">Notification Types</h3>
          <p className="text-sm text-muted-foreground">
            Customize how you receive each type of notification
          </p>

          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground px-4 py-2">
              <div>Notification Type</div>
              <div className="text-center">Browser</div>
              <div className="text-center">Sound</div>
              <div className="text-center">Slack</div>
            </div>

            {NOTIFICATION_TYPES.map(notif => (
              <div
                key={notif.key}
                className={`grid grid-cols-4 gap-4 items-center py-3 px-4 rounded-lg ${
                  notif.important ? 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800' : 'bg-muted/20'
                }`}
              >
                <div>
                  <div className="font-medium text-sm">{notif.label}</div>
                  <div className="text-xs text-muted-foreground">{notif.description}</div>
                </div>
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    checked={getTypePreference(notif.key, 'browser')}
                    onChange={() => toggleNotificationType(notif.key, 'browser')}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    checked={getTypePreference(notif.key, 'sound')}
                    onChange={() => toggleNotificationType(notif.key, 'sound')}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    checked={getTypePreference(notif.key, 'slack')}
                    onChange={() => toggleNotificationType(notif.key, 'slack')}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={savePreferences}
            disabled={saving}
            className="flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
