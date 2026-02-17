import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { launchRequestApi } from '../lib/api';
import { formatDateTime } from '../lib/utils';
import {
  Plus, Search, Rocket, Trash2, Copy, Link as LinkIcon, Filter
} from 'lucide-react';
import { CreateLaunchRequestModal } from '../components/CreateLaunchRequestModal';
import { LaunchRequestDetailsModal } from '../components/LaunchRequestDetailsModal';
import { useAuth } from '../contexts/AuthContext';
import { VERTICALS } from '../constants/verticals';
import { PLATFORMS } from '../constants/platforms';
import { getLaunchRequestStatusBadgeClasses } from '../constants/statusColors';
import { getVerticalBadgeClasses } from '../constants/statusColors';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'in_production', label: 'In Production' },
  { value: 'ready_to_launch', label: 'Ready to Launch' },
  { value: 'buyer_assigned', label: 'Buyer Assigned' },
  { value: 'launched', label: 'Launched' },
  { value: 'closed', label: 'Closed' },
  { value: 'reopened', label: 'Reopened' },
];

interface LaunchRequest {
  id: string;
  title?: string;
  request_type?: string;
  concept_notes?: string;
  num_creatives?: number;
  suggested_run_qty?: number;
  platforms?: string[];
  verticals?: string[];
  primary_vertical?: string;
  delivery_deadline?: string;
  test_deadline?: string;
  committed_run_qty?: number;
  creative_head_name?: string;
  buyer_head_name?: string;
  assigned_editors?: string;
  assigned_buyers?: string;
  upload_count?: number;
  created_by_name?: string;
  created_at: string;
  status: string;
}

export function LaunchRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LaunchRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LaunchRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verticalFilter, setVerticalFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const canCreate = user?.role === 'admin' || user?.role === 'buyer';

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (verticalFilter) params.vertical = verticalFilter;
      if (platformFilter) params.platform = platformFilter;
      if (search) params.search = search;

      const res = await launchRequestApi.getAll(params);
      setRequests(res.data.data || []);
    } catch (err) {
      console.error('Failed to load launch requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [statusFilter, verticalFilter, platformFilter]);

  // client-side search filter
  const filteredRequests = requests.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.title?.toLowerCase().includes(q) ||
      r.request_type?.toLowerCase().includes(q) ||
      r.concept_notes?.toLowerCase().includes(q) ||
      r.created_by_name?.toLowerCase().includes(q) ||
      r.platforms?.some(p => p.toLowerCase().includes(q)) ||
      r.verticals?.some(v => v.toLowerCase().includes(q))
    );
  });

  const handleViewDetails = (request: LaunchRequest) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this launch request?')) return;
    try {
      await launchRequestApi.delete(id);
      fetchRequests();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const ProgressBar = ({ uploaded, total }: { uploaded: number; total: number }) => {
    if (!total) return <span className="text-muted-foreground text-sm">—</span>;
    const pct = Math.min(100, Math.round((uploaded / total) * 100));
    const barColor = pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-blue-500';
    return (
      <div className="min-w-[80px]">
        <div className="flex justify-between text-xs mb-0.5">
          <span>{uploaded}/{total}</span>
          <span className="font-medium">{pct}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div className={`${barColor} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <Rocket className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Launch Requests</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)}>
              <Filter className="w-4 h-4 mr-1.5" />
              Filters
            </Button>
            {canCreate && (
              <Button size="sm" onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                New Launch Request
              </Button>
            )}
          </div>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────────── */}
        <div className="px-6 py-3 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-sm"
                placeholder="Search requests..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Status */}
            <select
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t">
              <select
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={verticalFilter}
                onChange={e => setVerticalFilter(e.target.value)}
              >
                <option value="">All Verticals</option>
                {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <select
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={platformFilter}
                onChange={e => setPlatformFilter(e.target.value)}
              >
                <option value="">All Platforms</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              {(verticalFilter || platformFilter || statusFilter !== 'all') && (
                <Button
                  variant="outline" size="sm"
                  onClick={() => { setVerticalFilter(''); setPlatformFilter(''); setStatusFilter('all'); setSearch(''); }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ── Vertical pills ───────────────────────────────────────────── */}
        <div className="px-6 py-2 flex gap-2 flex-wrap border-b bg-background shrink-0 overflow-x-auto">
          <button
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !verticalFilter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            onClick={() => setVerticalFilter('')}
          >
            All
          </button>
          {VERTICALS.map(v => (
            <button
              key={v}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                verticalFilter === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={() => setVerticalFilter(verticalFilter === v ? '' : v)}
            >
              {v}
            </button>
          ))}
        </div>

        {/* ── Table ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Rocket className="w-12 h-12 text-muted-foreground" />
              <p className="text-muted-foreground">No launch requests found.</p>
              {canCreate && (
                <Button size="sm" onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create first Launch Request
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium text-sm">Date</th>
                    <th className="text-left p-4 font-medium text-sm">Strategist</th>
                    <th className="text-left p-4 font-medium text-sm">Platform</th>
                    <th className="text-left p-4 font-medium text-sm">Vertical</th>
                    <th className="text-left p-4 font-medium text-sm">Creatives</th>
                    <th className="text-left p-4 font-medium text-sm">Concept</th>
                    <th className="text-left p-4 font-medium text-sm">Creative Head</th>
                    <th className="text-left p-4 font-medium text-sm">Buyer Head</th>
                    <th className="text-left p-4 font-medium text-sm">Status</th>
                    <th className="text-left p-4 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map(request => (
                    <tr
                      key={request.id}
                      className="border-b hover:bg-muted/40 cursor-pointer"
                      onClick={() => handleViewDetails(request)}
                    >
                      <td className="p-4 text-sm whitespace-nowrap">
                        {formatDateTime(request.created_at)}
                      </td>
                      <td className="p-4 text-sm">
                        {request.created_by_name || '—'}
                      </td>
                      <td className="p-4">
                        {(request.platforms || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(request.platforms || []).map((p, i) => (
                              <span key={i} className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </td>
                      <td className="p-4">
                        {(request.verticals || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(request.verticals || []).map((v, i) => (
                              <span key={i} className={getVerticalBadgeClasses(v)}>{v}</span>
                            ))}
                          </div>
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </td>
                      <td className="p-4" onClick={e => e.stopPropagation()}>
                        <ProgressBar
                          uploaded={Number(request.upload_count ?? 0)}
                          total={request.num_creatives || 0}
                        />
                      </td>
                      <td className="p-4 text-sm max-w-[180px] truncate" title={request.concept_notes || ''}>
                        {request.concept_notes || '—'}
                      </td>
                      <td className="p-4 text-sm">{request.creative_head_name || '—'}</td>
                      <td className="p-4 text-sm">{request.buyer_head_name || '—'}</td>
                      <td className="p-4" onClick={e => e.stopPropagation()}>
                        <span className={getLaunchRequestStatusBadgeClasses(request.status)}>
                          {(request.status || 'draft').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => handleViewDetails(request)}
                            title="View Details"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </Button>
                          {(user?.role === 'admin' || user?.id === request.created_by_name) && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleDelete(request.id)}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <CreateLaunchRequestModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); fetchRequests(); }}
        />
      )}

      {showDetailsModal && selectedRequest && (
        <LaunchRequestDetailsModal
          request={selectedRequest as any}
          onClose={() => { setShowDetailsModal(false); setSelectedRequest(null); }}
          onUpdate={() => fetchRequests()}
        />
      )}
    </DashboardLayout>
  );
}
