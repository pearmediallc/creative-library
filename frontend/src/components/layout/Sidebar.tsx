import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Image, TrendingUp, Users, Settings, LogOut, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

// Base navigation available to all users
const baseNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Media Library', href: '/media', icon: Image },
];

// Admin-only navigation items
const adminOnlyNavigation = [
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Editors', href: '/editors', icon: Users },
];

const adminNavigation = [
  { name: 'Admin Panel', href: '/admin', icon: Settings },
  { name: 'Activity Logs', href: '/activity-logs', icon: FileText },
];

export function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  // Build navigation based on user role
  const navigation = user?.role === 'admin'
    ? [...baseNavigation, ...adminOnlyNavigation]
    : baseNavigation;

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-foreground">Creative Library</h1>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <Icon size={18} />
              {item.name}
            </Link>
          );
        })}

        {user?.role === 'admin' && (
          <>
            <div className="h-px bg-sidebar-border my-4" />
            {adminNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <Icon size={18} />
                  {item.name}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-medium">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-medium text-sidebar-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-sm text-muted-foreground hover:text-sidebar-foreground"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
