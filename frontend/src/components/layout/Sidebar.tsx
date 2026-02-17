import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Image, Star, Clock, Trash2, TrendingUp, Users, Settings, LogOut, FileText, Tags, Share2, UserCheck, Layers, ChevronRight, Inbox, User, Download, BarChart3, Shield, Key, Rocket } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { savedSearchApi } from '../../lib/api';

// Base navigation available to all users
const baseNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Media Library', href: '/media', icon: Image },
  { name: 'File Requests', href: '/file-requests', icon: Inbox },
  { name: 'Launch Requests', href: '/launch-requests', icon: Rocket },
  { name: 'Starred', href: '/starred', icon: Star },
  { name: 'Recents', href: '/recents', icon: Clock },
  { name: 'Shared with me', href: '/shared-with-me', icon: UserCheck },
  { name: 'Trash', href: '/trash', icon: Trash2 },
  { name: 'Shared by You', href: '/shared-by-me', icon: Share2 },
  { name: 'Teams', href: '/teams', icon: Users },
  { name: 'Settings', href: '/settings', icon: User },
];

// Navigation items for admin and buyers only (not for creatives/editors)
const adminBuyerNavigation = [
  { name: 'Access Requests', href: '/access-requests', icon: Key },
];

// Admin-only navigation items
const adminOnlyNavigation = [
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Editors', href: '/editors', icon: Users },
  { name: 'Workload', href: '/workload', icon: BarChart3 },
  { name: 'Metadata Extraction', href: '/metadata', icon: Tags },
];

// Editor (creative) specific navigation items
const editorNavigation = [
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
];

const adminNavigation = [
  { name: 'Admin Panel', href: '/admin', icon: Settings },
  { name: 'RBAC Permissions', href: '/rbac-admin', icon: Shield },
  { name: 'Activity Logs', href: '/activity-logs', icon: FileText },
  { name: 'Log Exports', href: '/activity-log-export', icon: Download },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [favoriteCollections, setFavoriteCollections] = useState<any[]>([]);

  // Build navigation based on user role
  const navigation = (() => {
    if (user?.role === 'admin') {
      return [...baseNavigation, ...adminBuyerNavigation, ...adminOnlyNavigation];
    } else if (user?.role === 'creative') {
      // Editors get base navigation + their specific items (Analytics) but NOT Access Requests
      return [...baseNavigation, ...editorNavigation];
    } else if (user?.role === 'buyer') {
      // Buyers get base navigation + Access Requests
      return [...baseNavigation, ...adminBuyerNavigation];
    }
    // Default: base navigation only
    return baseNavigation;
  })();

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  // Fetch favorite collections
  useEffect(() => {
    const fetchFavoriteCollections = async () => {
      try {
        const response = await savedSearchApi.getAll();
        const collections = response.data.data || [];
        const favorites = collections.filter((c: any) => c.is_favorite).slice(0, 5);
        setFavoriteCollections(favorites);
      } catch (error) {
        console.error('Failed to fetch favorite collections:', error);
      }
    };

    if (user) {
      fetchFavoriteCollections();
    }
  }, [user]);

  const handleCollectionClick = (collection: any) => {
    const filters = collection.filters;
    const params = new URLSearchParams();

    if (filters.search_term) params.set('search', filters.search_term);
    if (filters.media_types?.length) params.set('media_type', filters.media_types.join(','));
    if (filters.editor_ids?.length) params.set('editor_id', filters.editor_ids.join(','));
    if (filters.buyer_ids?.length) params.set('buyer_id', filters.buyer_ids.join(','));
    if (filters.folder_ids?.length) params.set('folder_id', filters.folder_ids.join(','));
    if (filters.tags?.length) params.set('tags', filters.tags.join(','));
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);

    navigate(`/media?${params.toString()}&collection=${collection.id}&collection_name=${encodeURIComponent(collection.name)}`);
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

        {/* Collections Section */}
        <div className="h-px bg-sidebar-border my-4" />
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">Collections</h3>
            <Link
              to="/collections"
              className="text-xs text-muted-foreground hover:text-sidebar-foreground"
            >
              View All
            </Link>
          </div>
          {favoriteCollections.length > 0 ? (
            <div className="space-y-1">
              {favoriteCollections.map((collection) => (
                <button
                  key={collection.id}
                  onClick={() => handleCollectionClick(collection)}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors text-left"
                >
                  <Layers size={16} style={{ color: collection.color || '#3B82F6' }} />
                  <span className="truncate flex-1">{collection.name}</span>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <Link
              to="/collections"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 transition-colors"
            >
              <Layers size={16} />
              <span>Create Collection</span>
            </Link>
          )}
        </div>

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
