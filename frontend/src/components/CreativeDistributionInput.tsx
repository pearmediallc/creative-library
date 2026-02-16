import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle, CheckCircle, Minus, Plus } from 'lucide-react';
import { getWorkloadStatusByLoad, getLoadTextColor, getLoadBgColor } from '../constants/statusColors';

interface Editor {
  id: string;
  name: string;
  display_name?: string;
  workload?: {
    loadPercentage: number;
    activeRequests: number;
    maxConcurrentRequests: number;
    isAvailable: boolean;
  };
}

interface Distribution {
  editor_id: string;
  num_creatives: number;
}

interface CreativeDistributionInputProps {
  editors: Editor[];
  totalCreatives: number;
  selectedEditorIds: string[];
  onDistributionChange: (distribution: Distribution[]) => void;
  className?: string;
}

export function CreativeDistributionInput({
  editors,
  totalCreatives,
  selectedEditorIds,
  onDistributionChange,
  className = ''
}: CreativeDistributionInputProps) {
  const [distribution, setDistribution] = useState<Map<string, number>>(new Map());

  // Calculate total assigned and remaining
  const totalAssigned = Array.from(distribution.values()).reduce((sum, val) => sum + val, 0);
  const remaining = totalCreatives - totalAssigned;
  const isValid = totalAssigned <= totalCreatives && totalAssigned >= 0;

  // Initialize distribution when editors change
  useEffect(() => {
    const newDist = new Map<string, number>();
    selectedEditorIds.forEach(id => {
      if (!distribution.has(id)) {
        newDist.set(id, 0);
      } else {
        newDist.set(id, distribution.get(id)!);
      }
    });
    setDistribution(newDist);
  }, [selectedEditorIds]);

  // Notify parent of distribution changes
  useEffect(() => {
    const distributionArray: Distribution[] = Array.from(distribution.entries()).map(
      ([editor_id, num_creatives]) => ({ editor_id, num_creatives })
    );
    onDistributionChange(distributionArray);
  }, [distribution, onDistributionChange]);

  const updateDistribution = (editorId: string, value: number) => {
    const newValue = Math.max(0, Math.min(value, totalCreatives));
    setDistribution(prev => new Map(prev).set(editorId, newValue));
  };

  const increment = (editorId: string) => {
    const current = distribution.get(editorId) || 0;
    if (totalAssigned < totalCreatives) {
      updateDistribution(editorId, current + 1);
    }
  };

  const decrement = (editorId: string) => {
    const current = distribution.get(editorId) || 0;
    if (current > 0) {
      updateDistribution(editorId, current - 1);
    }
  };

  const autoDistribute = () => {
    if (selectedEditorIds.length === 0) return;

    const perEditor = Math.floor(totalCreatives / selectedEditorIds.length);
    const remainder = totalCreatives % selectedEditorIds.length;

    const newDist = new Map<string, number>();
    selectedEditorIds.forEach((id, index) => {
      newDist.set(id, perEditor + (index < remainder ? 1 : 0));
    });

    setDistribution(newDist);
  };

  const clearDistribution = () => {
    const newDist = new Map<string, number>();
    selectedEditorIds.forEach(id => newDist.set(id, 0));
    setDistribution(newDist);
  };

  if (selectedEditorIds.length === 0) {
    return (
      <div className={`text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg ${className}`}>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Select editors first to distribute creatives
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with totals and auto-distribute */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Total Creatives: {totalCreatives}
            </p>
            <p className={`text-xs ${isValid ? 'text-gray-600 dark:text-gray-400' : 'text-red-600'}`}>
              Assigned: {totalAssigned} | Remaining: {remaining}
            </p>
          </div>
          {!isValid && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">Exceeds total!</span>
            </div>
          )}
          {isValid && totalAssigned === totalCreatives && (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs">Fully distributed</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={autoDistribute}
            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Auto Distribute
          </button>
          <button
            onClick={clearDistribution}
            className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full transition-all duration-300 ${
            isValid
              ? totalAssigned === totalCreatives
                ? 'bg-green-500'
                : 'bg-blue-500'
              : 'bg-red-500'
          }`}
          style={{ width: `${Math.min((totalAssigned / totalCreatives) * 100, 100)}%` }}
        />
      </div>

      {/* Editor list with distribution inputs */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {selectedEditorIds.map(editorId => {
          const editor = editors.find(e => e.id === editorId);
          if (!editor) return null;

          const assigned = distribution.get(editorId) || 0;
          const percentage = totalCreatives > 0 ? (assigned / totalCreatives) * 100 : 0;
          const workload = editor.workload;
          const workloadStatus = workload
            ? getWorkloadStatusByLoad(workload.loadPercentage, workload.isAvailable)
            : null;

          return (
            <div
              key={editorId}
              className="flex items-center justify-between p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              {/* Editor info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {editor.display_name || editor.name}
                  </p>
                  {workloadStatus && (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${workloadStatus.color}`}
                    >
                      {workloadStatus.label}
                    </span>
                  )}
                </div>
                {workload && (
                  <div className="flex items-center gap-2 mt-1">
                    <TrendingUp className="w-3 h-3 text-gray-400" />
                    <span className={`text-xs font-medium ${getLoadTextColor(workload.loadPercentage)}`}>
                      {workload.loadPercentage.toFixed(0)}%
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {workload.activeRequests}/{workload.maxConcurrentRequests} requests
                    </span>
                  </div>
                )}
              </div>

              {/* Distribution controls */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {assigned} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  {totalCreatives > 0 && (
                    <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => decrement(editorId)}
                    disabled={assigned === 0}
                    className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    max={totalCreatives}
                    value={assigned}
                    onChange={(e) => updateDistribution(editorId, parseInt(e.target.value) || 0)}
                    className="w-16 px-2 py-1 text-center text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  <button
                    onClick={() => increment(editorId)}
                    disabled={totalAssigned >= totalCreatives}
                    className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
