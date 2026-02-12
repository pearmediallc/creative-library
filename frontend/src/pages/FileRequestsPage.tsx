import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { fileRequestApi, editorApi } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/utils';
import { Inbox, Plus, Link as LinkIcon, Copy, XCircle, Trash2, CheckCircle, UserPlus, Search, Filter, List, Grid } from 'lucide-react';
import { CreateFileRequestModal } from '../components/CreateFileRequestModal';
import { FileRequestDetailsModal } from '../components/FileRequestDetailsModal';
import { ReassignFileRequestModal } from '../components/ReassignFileRequestModal';
import { useAuth } from '../contexts/AuthContext';
import { VERTICALS } from '../constants/verticals';
import { PLATFORMS } from '../constants/platforms';

interface FileRequest {
  id: string;
  title: string;
  description?: string;
  request_token: string;
  is_active: boolean;
  status?: 'open' | 'in_progress' | 'uploaded' | 'launched' | 'closed' | 'reopened';
  deadline?: string;
  folder_name?: string;
  upload_count: number;
  created_at: string;
  closed_at?: string;
  request_type?: string;
  platform?: string;
  vertical?: string;
  concept_notes?: string;
  num_creatives?: number;
  buyer_name?: string;
  buyer_email?: string;
  created_by_name?: string;
  assigned_editors?: string; // STRING_AGG returns a comma-separated string
  completed_editors_count?: number;
  total_editors_count?: number;
  uploaded_files_count?: number;
  my_uploaded_files_count?: number;
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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVertical, setSelectedVertical] = useState<string>('All');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('All');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedEditorIds, setSelectedEditorIds] = useState<string[]>([]);
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | 'image' | 'video'>('all');
  const [editors, setEditors] = useState<any[]>([]);

  useEffect(() => {
    fetchEditors();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [filter, dateFrom, dateTo, selectedEditorIds, selectedMediaType]);

  const fetchEditors = async () => {
    try {
      const response = await editorApi.getAll();
      setEditors(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch editors:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params: any = { status: filter };

      // Add date filters
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      // Add editor filter (comma-separated IDs)
      if (selectedEditorIds.length > 0) {
        params.editor_ids = selectedEditorIds.join(',');
      }

      // Add media type filter
      if (selectedMediaType !== 'all') {
        params.media_type = selectedMediaType;
      }

      const response = await fileRequestApi.getAll(params);
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

  const getVerticalColor = (vertical?: string) => {
    if (!vertical) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';

    switch (vertical) {
      case 'E-Comm':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'Bizop':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Medicare':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Auto Insurance':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'VSL':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      case 'Nutra':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const filteredRequests = requests.filter((request) => {
    // Search filter
    if (searchQuery && !request.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !request.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !request.buyer_name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !request.created_by_name?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Vertical filter
    if (selectedVertical !== 'All' && request.vertical !== selectedVertical) {
      return false;
    }

    // Platform filter
    if (selectedPlatform !== 'All' && request.platform !== selectedPlatform) {
      return false;
    }

    return true;
  });

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
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            {/* Only show Create Request button for non-creative users */}
            {user?.role !== 'creative' && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Request
              </Button>
            )}
          </div>
        </div>

        {/* Status Filters */}
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

        {/* Vertical Filters */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Vertical:</span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedVertical === 'All' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedVertical('All')}
              >
                All
              </Button>
              {VERTICALS.map((vertical) => (
                <Button
                  key={vertical}
                  variant={selectedVertical === vertical ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedVertical(vertical)}
                >
                  {vertical}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filters</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              {showAdvancedFilters ? 'Hide' : 'Show'} Advanced
            </Button>
          </div>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by title, description, or buyer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Platform Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">Platform</label>
                  <select
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="All">All Platforms</option>
                    {PLATFORMS.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vertical Filter (Dropdown) */}
                <div>
                  <label className="block text-sm font-medium mb-2">All Verticals</label>
                  <select
                    value={selectedVertical}
                    onChange={(e) => setSelectedVertical(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="All">All Verticals</option>
                    {VERTICALS.map((vertical) => (
                      <option key={vertical} value={vertical}>
                        {vertical}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-sm font-medium mb-2">Date From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-medium mb-2">Date To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Editor Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">Editors</label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedEditorIds.length === 0 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedEditorIds([])}
                    >
                      All Editors
                    </Button>
                    {editors.map((editor) => (
                      <Button
                        key={editor.id}
                        variant={selectedEditorIds.includes(editor.id) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          if (selectedEditorIds.includes(editor.id)) {
                            setSelectedEditorIds(selectedEditorIds.filter(id => id !== editor.id));
                          } else {
                            setSelectedEditorIds([...selectedEditorIds, editor.id]);
                          }
                        }}
                      >
                        {editor.display_name || editor.name}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Click to toggle editor selection</p>
                </div>

                {/* Media Type Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">Media Type</label>
                  <div className="flex gap-2">
                    <Button
                      variant={selectedMediaType === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedMediaType('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant={selectedMediaType === 'image' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedMediaType('image')}
                    >
                      Images
                    </Button>
                    <Button
                      variant={selectedMediaType === 'video' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedMediaType('video')}
                    >
                      Videos
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : filteredRequests.length > 0 ? (
          viewMode === 'table' ? (
            /* Table View */
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">Date</th>
                    <th className="text-left p-4 font-medium">Media Buyer</th>
                    <th className="text-left p-4 font-medium">Platform</th>
                    <th className="text-left p-4 font-medium">Creatives</th>
                    <th className="text-left p-4 font-medium">Type</th>
                    <th className="text-left p-4 font-medium">Concept Notes</th>
                    <th className="text-left p-4 font-medium">Request To</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="border-b hover:bg-muted/50">
                      <td className="p-4 text-sm">{formatDateTime(request.created_at)}</td>
                      <td className="p-4 text-sm">
                        {request.buyer_name || request.created_by_name || '-'}
                      </td>
                      <td className="p-4 text-sm">{request.platform || '-'}</td>
                      <td className="p-4 text-sm">
                        {user?.role === 'creative'
                          ? (typeof request.my_uploaded_files_count === 'number' ? request.my_uploaded_files_count : 'N/A')
                          : (request.num_creatives || '-')}
                      </td>
                      <td className="p-4">
                        {request.vertical ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getVerticalColor(request.vertical)}`}>
                            {request.vertical}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4 text-sm max-w-xs truncate" title={request.concept_notes}>
                        {request.concept_notes || '-'}
                      </td>
                      <td className="p-4 text-sm">
                        {request.assigned_editors || '-'}
                      </td>
                      <td className="p-4">
                        <span className="text-sm">
                          {request.status || (request.is_active ? 'open' : 'closed')}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyLink(request.request_token)}
                            title="Copy Link"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(request)}
                            title="View Details"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </Button>
                          {user?.role === 'admin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReassign(request)}
                              title="Reassign"
                            >
                              <UserPlus className="w-4 h-4" />
                            </Button>
                          )}
                          {request.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCloseRequest(request.id)}
                              title="Close"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRequest(request.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRequests.map((request) => (
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
                        {typeof request.completed_editors_count === 'number' && typeof request.total_editors_count === 'number'
                          ? `Progress: ${request.completed_editors_count}/${request.total_editors_count}`
                          : `${request.upload_count} ${request.upload_count === 1 ? 'file' : 'files'}`}
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
                      {request.buyer_name && (
                        <p>Buyer: {request.buyer_name}</p>
                      )}
                      {request.platform && (
                        <p>Platform: {request.platform}</p>
                      )}
                      {request.vertical && (
                        <div className="flex items-center gap-2">
                          <span>Type:</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getVerticalColor(request.vertical)}`}>
                            {request.vertical}
                          </span>
                        </div>
                      )}
                      {request.num_creatives && (
                        <p>Creatives: {request.num_creatives}</p>
                      )}
                      {request.concept_notes && (
                        <p className="line-clamp-2">Notes: {request.concept_notes}</p>
                      )}
                      {request.assigned_editors && (
                        <p>Editors: {request.assigned_editors}</p>
                      )}
                      {request.folder_name && (
                        <p>Folder: {request.folder_name}</p>
                      )}
                      {request.deadline && (
                        <p>Deadline: {formatDate(request.deadline)}</p>
                      )}
                      <p>Created: {formatDateTime(request.created_at)}</p>
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
          )
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <Inbox className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No file requests found</h3>
              <p className="text-muted-foreground mb-4">
                {requests.length === 0
                  ? 'Create a file request to start collecting files from external parties'
                  : 'Try adjusting your filters to see more results'}
              </p>
              {requests.length === 0 && (user?.role === 'buyer' || user?.role === 'admin') && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Request
                </Button>
              )}
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
