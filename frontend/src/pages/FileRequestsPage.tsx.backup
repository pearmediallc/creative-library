import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { fileRequestApi } from '../lib/api';
import { formatDate } from '../lib/utils';
import { Inbox, Plus, Link as LinkIcon, Copy, Edit2, XCircle, Trash2, CheckCircle, UserPlus } from 'lucide-react';
import { CreateFileRequestModal } from '../components/CreateFileRequestModal';
import { FileRequestDetailsModal } from '../components/FileRequestDetailsModal';
import { ReassignFileRequestModal } from '../components/ReassignFileRequestModal';
import { useAuth } from '../contexts/AuthContext';

interface FileRequest {
  id: string;
  title: string;
  description?: string;
  request_token: string;
  is_active: boolean;
  deadline?: string;
  folder_name?: string;
  upload_count: number;
  created_at: string;
  closed_at?: string;
}

export function FileRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FileRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [requestToReassign, setRequestToReassign] = useState<FileRequest | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fileRequestApi.getAll({ status: filter });
      setRequests(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch file requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPublicUrl = (token: string) => {
    return `${window.location.origin}/request/${token}`;
  };

  const handleCopyLink = (token: string) => {
    const url = getPublicUrl(token);
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const handleCloseRequest = async (id: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to close this request? It will no longer accept uploads.')) {
      return;
    }

    try {
      await fileRequestApi.close(id);
      fetchRequests();
    } catch (error: any) {
      console.error('Failed to close request:', error);
      alert(error.response?.data?.error || 'Failed to close request');
    }
  };

  const handleDeleteRequest = async (id: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to delete this request? This action cannot be undone.')) {
      return;
    }

    try {
      await fileRequestApi.delete(id);
      fetchRequests();
    } catch (error: any) {
      console.error('Failed to delete request:', error);
      alert(error.response?.data?.error || 'Failed to delete request');
    }
  };

  const handleViewDetails = (request: FileRequest) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  const handleReassign = (request: FileRequest) => {
    setRequestToReassign(request);
    setShowReassignModal(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Inbox className="w-8 h-8" />
              File Requests
            </h1>
            <p className="text-muted-foreground">Request file uploads from external parties</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Request
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'active' ? 'default' : 'outline'}
            onClick={() => setFilter('active')}
          >
            Active
          </Button>
          <Button
            variant={filter === 'closed' ? 'default' : 'outline'}
            onClick={() => setFilter('closed')}
          >
            Closed
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : requests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {requests.map((request) => (
              <Card key={request.id} className="p-6">
                <div className="space-y-4">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between">
                    {request.is_active ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Closed
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {request.upload_count} {request.upload_count === 1 ? 'file' : 'files'}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-semibold text-lg">{request.title}</h3>
                    {request.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {request.description}
                      </p>
                    )}
                  </div>

                  {/* Meta Info */}
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {request.folder_name && (
                      <p>Folder: {request.folder_name}</p>
                    )}
                    {request.deadline && (
                      <p>Deadline: {formatDate(request.deadline)}</p>
                    )}
                    <p>Created: {formatDate(request.created_at)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(request.request_token)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(request)}
                    >
                      <LinkIcon className="w-3 h-3 mr-1" />
                      Details
                    </Button>
                    {user?.role === 'admin' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReassign(request)}
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        Reassign
                      </Button>
                    )}
                    {request.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCloseRequest(request.id)}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Close
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteRequest(request.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <Inbox className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No file requests yet</h3>
              <p className="text-muted-foreground mb-4">
                Create a file request to start collecting files from external parties
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Request
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateFileRequestModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchRequests();
          }}
        />
      )}

      {showDetailsModal && selectedRequest && (
        <FileRequestDetailsModal
          requestId={selectedRequest.id}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedRequest(null);
          }}
          onUpdate={() => {
            fetchRequests();
          }}
        />
      )}

      {showReassignModal && requestToReassign && (
        <ReassignFileRequestModal
          requestId={requestToReassign.id}
          requestTitle={requestToReassign.title}
          currentEditors={[]}
          onClose={() => {
            setShowReassignModal(false);
            setRequestToReassign(null);
          }}
          onSuccess={() => {
            setShowReassignModal(false);
            setRequestToReassign(null);
            fetchRequests();
          }}
        />
      )}
    </DashboardLayout>
  );
}
