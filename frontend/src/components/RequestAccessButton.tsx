import React, { useState } from 'react';
import { Key, Lock } from 'lucide-react';
import { Button } from './ui/Button';
import axios from 'axios';

interface RequestAccessButtonProps {
  resourceType: 'folder' | 'file_request' | 'media_file' | 'canvas';
  resourceId: string;
  resourceName?: string;
  requestedPermission?: 'view' | 'edit' | 'download' | 'delete';
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RequestAccessButton({
  resourceType,
  resourceId,
  resourceName,
  requestedPermission = 'view',
  variant = 'outline',
  size = 'sm',
  className = ''
}: RequestAccessButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [permission, setPermission] = useState(requestedPermission);
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      await axios.post(
        `${process.env.REACT_APP_API_URL}/access-requests`,
        {
          resourceType,
          resourceId,
          requestedPermission: permission,
          reason: reason.trim() || undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRequested(true);
      setShowModal(false);
      alert('Access request submitted successfully!');
    } catch (error: any) {
      console.error('Failed to submit access request:', error);
      alert(error.response?.data?.error || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  // Map 'md' to 'default' for Button component
  const buttonSize = size === 'md' ? 'default' : size as 'default' | 'sm' | 'lg';

  if (requested) {
    return (
      <Button variant="ghost" size={buttonSize} disabled className={className}>
        <Key className="w-4 h-4 mr-2" />
        Request Pending
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={buttonSize}
        onClick={() => setShowModal(true)}
        className={className}
      >
        <Lock className="w-4 h-4 mr-2" />
        Request Access
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Request Access</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Resource</label>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  {resourceName || `${resourceType} #${resourceId.substring(0, 8)}`}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Permission Type
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={permission}
                  onChange={(e) => setPermission(e.target.value as any)}
                >
                  <option value="view">View</option>
                  <option value="edit">Edit</option>
                  <option value="download">Download</option>
                  {resourceType === 'media_file' && <option value="delete">Delete</option>}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Reason (Optional)
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 min-h-[100px]"
                  placeholder="Why do you need access to this resource?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                />
                <div className="text-xs text-gray-500 text-right">
                  {reason.length}/500
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
