import React, { useState } from 'react';
import { ChevronDown, ChevronRight, User, Users, Folder, Image as ImageIcon, Video } from 'lucide-react';
import { formatBytes, formatDate } from '../lib/utils';
import { getShareCountColor } from '../constants/statusColors';

interface Share {
  permission_id: string;
  grantee_name: string;
  grantee_email?: string;
  grantee_type: 'user' | 'team';
  grantee_id: string;
  permission_type: 'view' | 'download' | 'edit' | 'delete';
  granted_at: string;
}

interface SharedResource {
  resource_type: 'file' | 'folder';
  resource_id: string;
  resource_name: string;
  file_type?: string;
  file_size?: number;
  thumbnail_url?: string;
  s3_url?: string;
  folder_color?: string;
  shares: Share[];
  share_count: number;
  most_recent_share: string;
}

interface UserGroup {
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_by_email?: string;
  share_date?: string;
  resources: SharedResource[];
  total_size: number;
  file_count: number;
}

interface UserFolderSectionProps {
  userGroup: UserGroup;
  onResourceClick: (resource: SharedResource) => void;
  onRevokeShare: (permissionId: string) => void;
}

export function UserFolderSection({ userGroup, onResourceClick, onRevokeShare }: UserFolderSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getResourceIcon = (resource: SharedResource) => {
    if (resource.resource_type === 'folder') {
      return <Folder className="w-12 h-12" style={{ color: resource.folder_color || undefined }} />;
    }
    if (resource.file_type === 'image') {
      return <ImageIcon className="w-12 h-12 text-gray-500 dark:text-gray-400" />;
    }
    return <Video className="w-12 h-12 text-gray-500 dark:text-gray-400" />;
  };

  const getUserInitial = () => {
    return (userGroup.uploaded_by_name || 'U').charAt(0).toUpperCase();
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      {/* Folder Header */}
      <div
        className="flex items-center justify-between p-4 bg-accent/20 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 flex-1">
          {/* Expand/Collapse Icon */}
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>

          {/* User Avatar */}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {userGroup.uploaded_by_name}
            </h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {userGroup.share_date && (
                <>
                  <span>{userGroup.share_date}</span>
                  <span>•</span>
                </>
              )}
              <span>{userGroup.file_count} {userGroup.file_count === 1 ? 'file' : 'files'}</span>
              <span>•</span>
              <span>{formatBytes(userGroup.total_size)}</span>
            </div>
          </div>

          {/* Stats Badge */}
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${getShareCountColor(userGroup.resources.length)}`}>
            {userGroup.resources.length} shared
          </div>
        </div>
      </div>

      {/* Expanded Content - File Grid */}
      {isExpanded && (
        <div className="p-4">
          {userGroup.resources.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {userGroup.resources.map((resource) => (
                <div
                  key={`${resource.resource_type}-${resource.resource_id}`}
                  className="border border-border rounded-lg overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/50 transition-all bg-card"
                  onClick={() => onResourceClick(resource)}
                >
                  {/* Thumbnail/Icon */}
                  <div className="aspect-video bg-muted relative flex items-center justify-center">
                    {resource.resource_type === 'file' && resource.thumbnail_url ? (
                      <img
                        src={resource.thumbnail_url}
                        alt={resource.resource_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getResourceIcon(resource)
                    )}

                    {/* Resource Type Badge */}
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-background/80 backdrop-blur text-foreground capitalize">
                        {resource.resource_type}
                      </span>
                    </div>

                    {/* Share Count Badge */}
                    <div className="absolute top-2 left-2">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1 ${getShareCountColor(
                          resource.share_count
                        )}`}
                      >
                        <Users className="w-3 h-3" />
                        {resource.share_count}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-1.5">
                    <h4 className="text-sm font-medium truncate text-foreground" title={resource.resource_name}>
                      {resource.resource_name}
                    </h4>

                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {resource.resource_type === 'file' && resource.file_size && (
                        <p>{formatBytes(resource.file_size)}</p>
                      )}
                      <p className="truncate">
                        Shared {formatDate(resource.most_recent_share)}
                      </p>
                    </div>

                    {/* Share Preview - First 2 recipients */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {resource.shares.slice(0, 2).map((share, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 text-xs rounded-full bg-accent/40 text-accent-foreground flex items-center gap-1"
                        >
                          {share.grantee_type === 'team' ? (
                            <Users className="w-2.5 h-2.5" />
                          ) : (
                            <User className="w-2.5 h-2.5" />
                          )}
                          {share.grantee_name.split(' ')[0]}
                        </span>
                      ))}
                      {resource.share_count > 2 && (
                        <span className="px-1.5 py-0.5 text-xs rounded-full bg-accent/40 text-accent-foreground">
                          +{resource.share_count - 2}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No shared resources
            </div>
          )}
        </div>
      )}
    </div>
  );
}
