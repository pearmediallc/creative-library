import React, { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBell } from '../NotificationBell';
import { RefreshCw } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
  onRefresh?: () => void;
}

export function DashboardLayout({ children, onRefresh }: DashboardLayoutProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    // Call parent's refresh handler if provided
    if (onRefresh) {
      await onRefresh();
    } else {
      // Default refresh: reload the page
      window.location.reload();
    }

    // Reset refreshing state after a short delay
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="container mx-auto px-6 py-3 flex items-center justify-end gap-3">
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <NotificationBell />
          </div>
        </div>
        <div className="container mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
