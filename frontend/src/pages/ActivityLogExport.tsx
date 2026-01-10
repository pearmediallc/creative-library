import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { activityLogExportApi } from '../lib/api';
import { Download, Calendar, Clock, Check, X, FileText, AlertCircle, Loader } from 'lucide-react';

interface ExportRecord {
  id: string;
  requested_by: string;
  requester_name: string;
  start_date?: string;
  end_date?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_path?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
  total_records?: number;
}

export function ActivityLogExportPage() {
  const [loading, setLoading] = useState(false);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchExports();
  }, []);

  const fetchExports = async () => {
    try {
      setLoading(true);
      const response = await activityLogExportApi.getHistory();
      setExports(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch export history:', err);
      setError('Failed to load export history');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestExport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before end date');
      return;
    }

    try {
      setRequesting(true);
      setError('');
      setSuccess('');

      await activityLogExportApi.requestExport({
        start_date: startDate,
        end_date: endDate
      });

      setSuccess('Export requested successfully! Processing will begin shortly.');
      setStartDate('');
      setEndDate('');

      // Refresh the export list
      setTimeout(() => {
        fetchExports();
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      console.error('Failed to request export:', err);
      setError(err.response?.data?.error || 'Failed to request export');
    } finally {
      setRequesting(false);
    }
  };

  const handleDownload = async (exportId: string, exportRecord: ExportRecord) => {
    try {
      const response = await activityLogExportApi.getDownloadUrl(exportId);
      const downloadUrl = response.data.data.url;

      // Create a temporary link and click it
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `activity_logs_${exportRecord.start_date}_to_${exportRecord.end_date}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Failed to download export:', err);
      setError('Failed to download export file');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <X className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800';
      case 'processing':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800';
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-500" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Activity Log Exports</h1>
        </div>

        <p className="text-gray-600 dark:text-gray-400">
          Request and download activity log exports for specific date ranges
        </p>

        {/* Messages */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        {/* Request Export Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Request New Export
          </h2>

          <form onSubmit={handleRequestExport} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="w-4 h-4 inline-block mr-1" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={requesting}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="w-4 h-4 inline-block mr-1" />
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={requesting}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={requesting || !startDate || !endDate}
              className="w-full md:w-auto"
            >
              {requesting ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Requesting Export...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Request Export
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Export History */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Export History
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              View and download previously requested exports
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : exports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <FileText className="w-12 h-12 text-gray-400 mb-3" />
              <p className="text-gray-600 dark:text-gray-400 text-center">
                No exports yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Request your first export above to get started
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date Range
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Requested By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Records
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Requested At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {exports.map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(exp.status)}`}>
                          {getStatusIcon(exp.status)}
                          {exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {exp.start_date && exp.end_date ? (
                          <>
                            {new Date(exp.start_date).toLocaleDateString()} - {new Date(exp.end_date).toLocaleDateString()}
                          </>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">All time</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {exp.requester_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {exp.total_records !== undefined ? exp.total_records.toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(exp.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {exp.status === 'completed' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(exp.id, exp)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        ) : exp.status === 'failed' ? (
                          <span className="text-xs text-red-600 dark:text-red-400" title={exp.error_message}>
                            Failed: {exp.error_message || 'Unknown error'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {exp.status === 'processing' ? 'Processing...' : 'Pending...'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
