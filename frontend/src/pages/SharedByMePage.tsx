import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { permissionApi } from '../lib/api';
import { formatBytes, formatDate } from '../lib/utils';
import { Image as ImageIcon, Video, Folder, Users, UserPlus, X, Share2, Calendar } from 'lucide-react';
import { UserFolderSection } from '../components/UserFolderSection';

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
  uploaded_by?: string;  // 🆕 For grouping by uploader
  uploaded_by_name?: string;  // 🆕 For display
  uploaded_by_email?: string;  // 🆕 Optional email
}

export function SharedByMePage() {
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResource, setSelectedResource] = useState<SharedResource | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchSharedResources();
  }, []);

  const fetchSharedResources = async () => {
    try {
      setLoading(true);
      const response = await permissionApi.getSharedByMe();
      setResources(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch shared resources:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group resources by recipient (grantee) and date
  // Structure: Recipient Name > Date Shared > Files
  const groupResourcesByUser = () => {
    // First, create a flat list of all shares
    const allShares: Array<{
      grantee_id: string;
      grantee_name: string;
      grantee_email?: string;
      granted_date: string;
      resource: SharedResource;
    }> = [];

    resources.forEach(resource => {
      resource.shares.forEach(share => {
        const grantedDate = new Date(share.granted_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        allShares.push({
          grantee_id: share.grantee_id,
          grantee_name: share.grantee_name,
          grantee_email: share.grantee_email,
          granted_date: grantedDate,
          resource: resource
        });
      });
    });

    // Group by grantee, then by date
    const grouped = new Map<string, Map<string, typeof resources>>();

    allShares.forEach(share => {
      // First level: group by grantee
      if (!grouped.has(share.grantee_id)) {
        grouped.set(share.grantee_id, new Map());
      }

      const granteeGroup = grouped.get(share.grantee_id)!;

      // Second level: group by date
      if (!granteeGroup.has(share.granted_date)) {
        granteeGroup.set(share.granted_date, []);
      }

      // Check if resource already exists in this date group (avoid duplicates)
      const dateGroup = granteeGroup.get(share.granted_date)!;
      const exists = dateGroup.some(
        r => r.resource_id === share.resource.resource_id && r.resource_type === share.resource.resource_type
      );
      if (!exists) {
        dateGroup.push(share.resource);
      }
    });

    // Convert to array format for rendering
    const result: any[] = [];

    grouped.forEach((dateGroups, granteeId) => {
      dateGroups.forEach((resources, grantedDate) => {
        const firstResource = resources[0];
        const firstShare = firstResource?.shares.find(s => s.grantee_id === granteeId);

        result.push({
          uploaded_by: granteeId,
          uploaded_by_name: firstShare?.grantee_name || 'Unknown User',
          uploaded_by_email: firstShare?.grantee_email,
          share_date: grantedDate,
          resources: resources,
          file_count: resources.length,
          total_size: resources.reduce((sum, r) => sum + (r.file_size || 0), 0)
        });
      });
    });

    // Sort: first by grantee name, then by date (most recent first)
    return result.sort((a, b) => {
      if (a.uploaded_by_name !== b.uploaded_by_name) {
        return a.uploaded_by_name.localeCompare(b.uploaded_by_name);
      }
      return new Date(b.share_date).getTime() - new Date(a.share_date).getTime();
    });
  };

  const userGroups = groupResourcesByUser();

  const handleRevokeShare = async (permissionId: string) => {
    if (!window.confirm('Are you sure you want to revoke this share?')) return;

    try {
      await permissionApi.revoke(permissionId);
      fetchSharedResources();
      if (selectedResource) {
        // Update selected resource if modal is open
        const updated = resources.find(
          r => r.resource_id === selectedResource.resource_id && r.resource_type === selectedResource.resource_type
        );
        if (updated) {
          const updatedShares = updated.shares.filter(s => s.permission_id !== permissionId);
          setSelectedResource({
            ...updated,
            shares: updatedShares,
            share_count: updatedShares.length
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to revoke share:', error);
      alert(error.response?.data?.error || 'Failed to revoke share');
    }
  };

  const getShareCountColor = (count: number) => {
    if (count >= 6) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    if (count >= 3) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  };

  const ResourceIcon = ({ resource }: { resource: SharedResource }) => {
    if (resource.resource_type === 'folder') {
      return <Folder className="w-16 h-16" style={{ color: resource.folder_color || undefined }} />;
    }
    if (resource.file_type === 'image') {
      return <ImageIcon className="w-16 h-16 text-muted-foreground" />;
    }
    return <Video className="w-16 h-16 text-muted-foreground" />;
  };

  const ShareDetailsModal = () => {
    if (!selectedResource) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-border flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-1">{selectedResource.resource_name}</h2>
              <p className="text-sm text-muted-foreground">
                {selectedResource.resource_type === 'file' ? 'File' : 'Folder'} shared with {selectedResource.share_count} {selectedResource.share_count === 1 ? 'recipient' : 'recipients'}
              </p>
            </div>
            <button
              onClick={() => setShowDetailsModal(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Shares List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {selectedResource.shares.map((share) => (
              <div
                key={share.permission_id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                    {share.grantee_type === 'team' ? (
                      <Users className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-medium">
                        {share.grantee_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{share.grantee_name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="capitalize">{share.grantee_type}</span>
                      <span>•</span>
                      <span className="capitalize">{share.permission_type}</span>
                      {share.grantee_email && (
                        <>
                          <span>•</span>
                          <span>{share.grantee_email}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Shared {formatDate(share.granted_at)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevokeShare(share.permission_id)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowDetailsModal(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Shared by You</h1>
            <p className="text-muted-foreground">Files and folders you've shared with others</p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : userGroups.length > 0 ? (
          <div className="space-y-4">
            {userGroups.map((userGroup) => (
              <UserFolderSection
                key={userGroup.uploaded_by}
                userGroup={userGroup}
                onResourceClick={(resource) => {
                  setSelectedResource(resource);
                  setShowDetailsModal(true);
                }}
                onRevokeShare={handleRevokeShare}
              />
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Share2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">You haven't shared any files yet</h3>
                <p className="text-muted-foreground">
                  Files and folders you share with others will appear here
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Share Details Modal */}
      {showDetailsModal && <ShareDetailsModal />}
    </DashboardLayout>
  );
}
