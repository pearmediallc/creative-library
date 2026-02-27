import React, { useState } from 'react';
import { X, TrendingUp, DollarSign, BarChart3, Save } from 'lucide-react';

interface AnalyticsMetrics {
  creative_performance: {
    hook_rate: number | null;
    hold_rate: number | null;
    avg_video_duration: number | null;
    ctr: number | null;
    ff_retention: number | null;
    video_plays_25: number | null;
    video_plays_50: number | null;
    video_plays_75: number | null;
    video_plays_100: number | null;
  };
  profitability: {
    spend: number | null;
    profit: number | null;
    revenue: number | null;
    roi: number | null;
  };
}

interface AnalyticsMetricsPanelProps {
  fileId: string;
  fileName: string;
  initialMetrics?: AnalyticsMetrics;
  onClose: () => void;
  onSave: (metrics: AnalyticsMetrics) => Promise<void>;
}

export function AnalyticsMetricsPanel({
  fileId,
  fileName,
  initialMetrics,
  onClose,
  onSave
}: AnalyticsMetricsPanelProps) {
  const [isSaving, setIsSaving] = useState(false);

  const defaultMetrics: AnalyticsMetrics = {
    creative_performance: {
      hook_rate: null,
      hold_rate: null,
      avg_video_duration: null,
      ctr: null,
      ff_retention: null,
      video_plays_25: null,
      video_plays_50: null,
      video_plays_75: null,
      video_plays_100: null
    },
    profitability: {
      spend: null,
      profit: null,
      revenue: null,
      roi: null
    }
  };

  const [metrics, setMetrics] = useState<AnalyticsMetrics>(
    initialMetrics || defaultMetrics
  );

  const updatePerformanceMetric = (field: keyof AnalyticsMetrics['creative_performance'], value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setMetrics({
      ...metrics,
      creative_performance: {
        ...metrics.creative_performance,
        [field]: numValue
      }
    });
  };

  const updateProfitabilityMetric = (field: keyof AnalyticsMetrics['profitability'], value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setMetrics({
      ...metrics,
      profitability: {
        ...metrics.profitability,
        [field]: numValue
      }
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(metrics);
      onClose();
    } catch (error) {
      console.error('Failed to save analytics metrics:', error);
      alert('Failed to save metrics. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Analytics Metrics
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {fileName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Creative Performance Section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                Creative Performance Metrics
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Hook Rate */}
              <div>
                <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                  Hook Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={metrics.creative_performance.hook_rate ?? ''}
                  onChange={(e) => updatePerformanceMetric('hook_rate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              {/* Hold Rate */}
              <div>
                <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                  Hold Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={metrics.creative_performance.hold_rate ?? ''}
                  onChange={(e) => updatePerformanceMetric('hold_rate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              {/* AVG Video Duration */}
              <div>
                <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                  AVG Video Duration (sec)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={metrics.creative_performance.avg_video_duration ?? ''}
                  onChange={(e) => updatePerformanceMetric('avg_video_duration', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.0"
                />
              </div>

              {/* CTR */}
              <div>
                <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                  CTR (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={metrics.creative_performance.ctr ?? ''}
                  onChange={(e) => updatePerformanceMetric('ctr', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              {/* FF Retention */}
              <div>
                <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                  FF Retention (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={metrics.creative_performance.ff_retention ?? ''}
                  onChange={(e) => updatePerformanceMetric('ff_retention', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Video Plays Section */}
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3">
                Video Completion Rates
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                    25% Plays
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={metrics.creative_performance.video_plays_25 ?? ''}
                    onChange={(e) => updatePerformanceMetric('video_plays_25', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                    50% Plays
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={metrics.creative_performance.video_plays_50 ?? ''}
                    onChange={(e) => updatePerformanceMetric('video_plays_50', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                    75% Plays
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={metrics.creative_performance.video_plays_75 ?? ''}
                    onChange={(e) => updatePerformanceMetric('video_plays_75', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                    100% Plays
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={metrics.creative_performance.video_plays_100 ?? ''}
                    onChange={(e) => updatePerformanceMetric('video_plays_100', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Profitability Section */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                Profitability Metrics
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Spend */}
              <div>
                <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                  Spend ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={metrics.profitability.spend ?? ''}
                  onChange={(e) => updateProfitabilityMetric('spend', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-green-300 dark:border-green-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              {/* Revenue */}
              <div>
                <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                  Revenue ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={metrics.profitability.revenue ?? ''}
                  onChange={(e) => updateProfitabilityMetric('revenue', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-green-300 dark:border-green-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              {/* Profit */}
              <div>
                <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                  Profit ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={metrics.profitability.profit ?? ''}
                  onChange={(e) => updateProfitabilityMetric('profit', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-green-300 dark:border-green-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              {/* ROI */}
              <div>
                <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                  ROI (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={metrics.profitability.roi ?? ''}
                  onChange={(e) => updateProfitabilityMetric('roi', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-green-300 dark:border-green-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Metrics'}
          </button>
        </div>
      </div>
    </div>
  );
}
