import React from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { SlackSettingsPanel } from '../components/SlackSettingsPanel';
import { NotificationSoundSettings } from '../components/NotificationSoundSettings';
import { User } from 'lucide-react';

export function UserSettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <User className="w-6 h-6" />
          <h1 className="text-3xl font-bold">User Settings</h1>
        </div>

        <p className="text-muted-foreground">
          Manage your personal preferences and integrations
        </p>

        {/* Notification sounds */}
        <NotificationSoundSettings />

        {/* Slack Integration */}
        <SlackSettingsPanel />
      </div>
    </DashboardLayout>
  );
}
