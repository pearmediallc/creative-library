import React from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { SlackSettingsPanel } from '../components/SlackSettingsPanel';
import { Accordion } from '../components/ui/Accordion';
import { NotificationPreferencesPanel } from '../components/NotificationPreferencesPanel';
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

        <Accordion>
          {/* Notification Preferences - Browser, Sound, Slack */}
          <NotificationPreferencesPanel />

          {/* Slack Integration */}
          <SlackSettingsPanel />
        </Accordion>
      </div>
    </DashboardLayout>
  );
}
