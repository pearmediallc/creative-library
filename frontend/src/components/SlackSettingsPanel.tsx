import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { slackApi } from '../lib/api';
import { MessageSquare, Check, X, Bell, BellOff } from 'lucide-react';

interface SlackConnection {
  connected: boolean;
  workspace_name?: string;
  user_name?: string;
  user_id?: string;
}

interface NotificationPreferences {
  enabled: boolean;
  file_shared: boolean;
  file_request_created: boolean;
  file_request_completed: boolean;
  file_uploaded: boolean;
  comment_mention: boolean;
  public_link_created: boolean;
}

export function SlackSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [connection, setConnection] = useState<SlackConnection | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enabled: true,
    file_shared: true,
    file_request_created: true,
    file_request_completed: true,
    file_uploaded: true,
    comment_mention: true,
    public_link_created: true,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const [statusResponse, prefsResponse] = await Promise.all([
        slackApi.getStatus(),
        slackApi.getPreferences().catch(() => ({ data: { data: null } })),
      ]);

      setConnection(statusResponse.data.data);

      if (prefsResponse.data.data) {
        setPreferences({
          enabled: prefsResponse.data.data.enabled ?? true,
          file_shared: prefsResponse.data.data.preferences?.file_shared ?? true,
          file_request_created: prefsResponse.data.data.preferences?.file_request_created ?? true,
          file_request_completed: prefsResponse.data.data.preferences?.file_request_completed ?? true,
          file_uploaded: prefsResponse.data.data.preferences?.file_uploaded ?? true,
          comment_mention: prefsResponse.data.data.preferences?.comment_mention ?? true,
          public_link_created: prefsResponse.data.data.preferences?.public_link_created ?? true,
        });
      }
    } catch (error: any) {
      console.error('Failed to fetch Slack status:', error);
      setMessage({ type: 'error', text: 'Failed to load Slack settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const response = await slackApi.initiateOAuth();
      const authUrl = response.data.data.authUrl;

      // Open OAuth URL in new window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'Slack Authorization',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Poll for popup closure
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          setConnecting(false);
          fetchStatus();
        }
      }, 500);
    } catch (error: any) {
      console.error('Failed to initiate Slack OAuth:', error);
      setMessage({ type: 'error', text: 'Failed to connect to Slack' });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Slack?')) {
      return;
    }

    try {
      setDisconnecting(true);
      await slackApi.disconnect();
      setMessage({ type: 'success', text: 'Slack disconnected successfully' });
      fetchStatus();
    } catch (error: any) {
      console.error('Failed to disconnect Slack:', error);
      setMessage({ type: 'error', text: 'Failed to disconnect Slack' });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setTestingNotification(true);
      await slackApi.sendTest();
      setMessage({ type: 'success', text: 'Test notification sent! Check your Slack DMs.' });
    } catch (error: any) {
      console.error('Failed to send test notification:', error);
      setMessage({ type: 'error', text: 'Failed to send test notification' });
    } finally {
      setTestingNotification(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPreferences(true);
      await slackApi.updatePreferences({
        enabled: preferences.enabled,
        preferences: {
          file_shared: preferences.file_shared,
          file_request_created: preferences.file_request_created,
          file_request_completed: preferences.file_request_completed,
          file_uploaded: preferences.file_uploaded,
          comment_mention: preferences.comment_mention,
          public_link_created: preferences.public_link_created,
        },
      });
      setMessage({ type: 'success', text: 'Notification preferences saved' });
    } catch (error: any) {
      console.error('Failed to save preferences:', error);
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSavingPreferences(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Slack Integration</h3>
        </div>
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-purple-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Slack Integration</h3>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-md ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          <p
            className={`text-sm ${
              message.type === 'success'
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200'
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* Connection Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Connection Status
            </p>
            <div className="flex items-center gap-2">
              {connection?.connected ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Connected as <strong>{connection.user_name}</strong> in{' '}
                    <strong>{connection.workspace_name}</strong>
                  </span>
                </>
              ) : (
                <>
                  <X className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Not connected</span>
                </>
              )}
            </div>
          </div>
          {connection?.connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? 'Connecting...' : 'Connect to Slack'}
            </Button>
          )}
        </div>
      </div>

      {/* Notification Preferences (only show if connected) */}
      {connection?.connected && (
        <>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notifications
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Control which events trigger Slack notifications
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {preferences.enabled ? 'Enabled' : 'Disabled'}
                </span>
                {preferences.enabled ? (
                  <Bell className="w-4 h-4 text-blue-500" />
                ) : (
                  <BellOff className="w-4 h-4 text-gray-400" />
                )}
                <input
                  type="checkbox"
                  checked={preferences.enabled}
                  onChange={(e) => updatePreference('enabled', e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`relative w-11 h-6 rounded-full transition ${
                    preferences.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition transform ${
                      preferences.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </label>
            </div>

            {preferences.enabled && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.file_shared}
                    onChange={(e) => updatePreference('file_shared', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">File shared with you</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.file_request_created}
                    onChange={(e) => updatePreference('file_request_created', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">File request assigned to you</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.file_request_completed}
                    onChange={(e) => updatePreference('file_request_completed', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">File request completed</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.file_uploaded}
                    onChange={(e) => updatePreference('file_uploaded', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">New file uploaded</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.comment_mention}
                    onChange={(e) => updatePreference('comment_mention', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Comments and mentions</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.public_link_created}
                    onChange={(e) => updatePreference('public_link_created', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Public link created</span>
                </label>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleSavePreferences}
              disabled={savingPreferences}
            >
              {savingPreferences ? 'Saving...' : 'Save Preferences'}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestNotification}
              disabled={testingNotification}
            >
              {testingNotification ? 'Sending...' : 'Send Test Notification'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
