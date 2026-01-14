import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import axios from 'axios';
import { CheckCircle, XCircle, Clock, Key, FileText } from 'lucide-react';

interface AccessRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  requester_email: string;
  resource_type: string;
  resource_id: string;
  resource_name: string;
  requested_permission: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export function AccessRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'my-requests';

  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [toReview, setToReview] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const [myRequestsRes, toReviewRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/access-requests/my-requests`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${process.env.REACT_APP_API_URL}/access-requests/to-review`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setMyRequests(myRequestsRes.data.data || []);
      setToReview(toReviewRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch access requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!window.confirm('Approve this access request?')) return;

    try {
      setActionLoading(requestId);
      const token = localStorage.getItem('token');

      await axios.post(
        `${process.env.REACT_APP_API_URL}/access-requests/${requestId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Access request approved!');
      fetchRequests();
    } catch (error: any) {
      console.error('Failed to approve request:', error);
      alert(error.response?.data?.error || 'Failed to approve request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeny = async (requestId: string) => {
    const notes = prompt('Reason for denial (optional):');
    if (notes === null) return; // User cancelled

    try {
      setActionLoading(requestId);
      const token = localStorage.getItem('token');

      await axios.post(
        `${process.env.REACT_APP_API_URL}/access-requests/${requestId}/deny`,
        { reviewNotes: notes || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Access request denied');
      fetchRequests();
    } catch (error: any) {
      console.error('Failed to deny request:', error);
      alert(error.response?.data?.error || 'Failed to deny request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    if (!window.confirm('Cancel this access request?')) return;

    try {
      setActionLoading(requestId);
      const token = localStorage.getItem('token');

      await axios.post(
        `${process.env.REACT_APP_API_URL}/access-requests/${requestId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Access request cancelled');
      fetchRequests();
    } catch (error: any) {
      console.error('Failed to cancel request:', error);
      alert(error.response?.data?.error || 'Failed to cancel request');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </span>
        );
      case 'denied':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Denied
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="w-8 h-8 text-blue-600" />
            Access Requests
          </h1>
          <p className="text-gray-600 mt-1">
            Manage access requests to your resources
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setSearchParams({ tab: 'my-requests' })}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'my-requests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My Requests ({myRequests.length})
            </button>
            <button
              onClick={() => setSearchParams({ tab: 'to-review' })}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'to-review'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              To Review ({toReview.filter(r => r.status === 'pending').length})
            </button>
          </nav>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <>
            {/* My Requests Tab */}
            {activeTab === 'my-requests' && (
              <div className="space-y-4">
                {myRequests.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-gray-500">
                      <Key className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>You haven't made any access requests yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  myRequests.map((request) => (
                    <Card key={request.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">
                              {request.resource_name}
                            </CardTitle>
                            <CardDescription>
                              Requesting: {request.requested_permission} access to {request.resource_type}
                            </CardDescription>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {request.reason && (
                          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-700 mb-1">Reason:</div>
                            <div className="text-sm text-gray-600">{request.reason}</div>
                          </div>
                        )}

                        <div className="text-sm text-gray-600 space-y-1">
                          <div>Requested: {formatDate(request.created_at)}</div>
                          {request.reviewed_at && (
                            <div>
                              Reviewed: {formatDate(request.reviewed_at)} by {request.reviewer_name}
                            </div>
                          )}
                          {request.review_notes && (
                            <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                              <div className="text-sm font-medium text-blue-900 mb-1">Review Notes:</div>
                              <div className="text-sm text-blue-800">{request.review_notes}</div>
                            </div>
                          )}
                        </div>

                        {request.status === 'pending' && (
                          <div className="mt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancel(request.id)}
                              disabled={actionLoading === request.id}
                            >
                              Cancel Request
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* To Review Tab */}
            {activeTab === 'to-review' && (
              <div className="space-y-4">
                {toReview.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No pending access requests to review</p>
                    </CardContent>
                  </Card>
                ) : (
                  toReview.map((request) => (
                    <Card key={request.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">
                              {request.requester_name} ({request.requester_email})
                            </CardTitle>
                            <CardDescription>
                              Requesting: {request.requested_permission} access to {request.resource_type}
                              <br />
                              Resource: {request.resource_name}
                            </CardDescription>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {request.reason && (
                          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-700 mb-1">Reason:</div>
                            <div className="text-sm text-gray-600">{request.reason}</div>
                          </div>
                        )}

                        <div className="text-sm text-gray-600 mb-4">
                          <div>Requested: {formatDate(request.created_at)}</div>
                        </div>

                        {request.status === 'pending' ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(request.id)}
                              disabled={actionLoading === request.id}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeny(request.id)}
                              disabled={actionLoading === request.id}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Deny
                            </Button>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600">
                            Reviewed: {formatDate(request.reviewed_at!)} by {request.reviewer_name}
                            {request.review_notes && (
                              <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                                <div className="text-sm font-medium text-blue-900 mb-1">Review Notes:</div>
                                <div className="text-sm text-blue-800">{request.review_notes}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
