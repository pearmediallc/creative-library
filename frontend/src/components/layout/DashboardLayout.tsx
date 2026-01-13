import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBell } from '../NotificationBell';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="container mx-auto px-6 py-3 flex items-center justify-end">
            <NotificationBell />
          </div>
        </div>
        <div className="container mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
