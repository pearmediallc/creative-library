/**
 * Centralized Status Colors
 * Provides consistent color schemes across the application for statuses,
 * verticals, workload levels, and other categorical displays
 */

// ============================================================================
// FILE REQUEST STATUS COLORS
// ============================================================================

export const FILE_REQUEST_STATUS_COLORS = {
  open: {
    label: 'Open',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    darkBg: 'dark:bg-blue-900/30',
    darkText: 'dark:text-blue-300',
    full: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    darkBg: 'dark:bg-yellow-900/30',
    darkText: 'dark:text-yellow-300',
    full: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
  },
  uploaded: {
    label: 'Uploaded',
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    darkBg: 'dark:bg-purple-900/30',
    darkText: 'dark:text-purple-300',
    full: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
  },
  launched: {
    label: 'Launched',
    bg: 'bg-green-100',
    text: 'text-green-800',
    darkBg: 'dark:bg-green-900/30',
    darkText: 'dark:text-green-300',
    full: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  },
  closed: {
    label: 'Closed',
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    darkBg: 'dark:bg-gray-700',
    darkText: 'dark:text-gray-300',
    full: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  },
  reopened: {
    label: 'Reopened',
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    darkBg: 'dark:bg-orange-900/30',
    darkText: 'dark:text-orange-300',
    full: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
  }
} as const;

export type FileRequestStatus = keyof typeof FILE_REQUEST_STATUS_COLORS;

export function getFileRequestStatusColor(status: string | undefined) {
  const statusKey = (status || 'open') as FileRequestStatus;
  return FILE_REQUEST_STATUS_COLORS[statusKey] || FILE_REQUEST_STATUS_COLORS.open;
}

// ============================================================================
// LAUNCH REQUEST STATUS COLORS
// ============================================================================

export const LAUNCH_REQUEST_STATUS_COLORS = {
  draft: {
    label: 'Draft',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    darkBg: 'dark:bg-gray-700',
    darkText: 'dark:text-gray-300',
    full: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  },
  pending_review: {
    label: 'Pending Review',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    darkBg: 'dark:bg-blue-900/30',
    darkText: 'dark:text-blue-300',
    full: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  },
  in_production: {
    label: 'In Production',
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    darkBg: 'dark:bg-yellow-900/30',
    darkText: 'dark:text-yellow-300',
    full: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
  },
  ready_to_launch: {
    label: 'Ready to Launch',
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    darkBg: 'dark:bg-purple-900/30',
    darkText: 'dark:text-purple-300',
    full: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
  },
  buyer_assigned: {
    label: 'Buyer Assigned',
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    darkBg: 'dark:bg-indigo-900/30',
    darkText: 'dark:text-indigo-300',
    full: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
  },
  launched: {
    label: 'Launched',
    bg: 'bg-green-100',
    text: 'text-green-800',
    darkBg: 'dark:bg-green-900/30',
    darkText: 'dark:text-green-300',
    full: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  },
  closed: {
    label: 'Closed',
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    darkBg: 'dark:bg-gray-700',
    darkText: 'dark:text-gray-300',
    full: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  },
  reopened: {
    label: 'Reopened',
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    darkBg: 'dark:bg-orange-900/30',
    darkText: 'dark:text-orange-300',
    full: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
  }
} as const;

export type LaunchRequestStatus = keyof typeof LAUNCH_REQUEST_STATUS_COLORS;

export function getLaunchRequestStatusColor(status: string | undefined) {
  const statusKey = (status || 'draft') as LaunchRequestStatus;
  return LAUNCH_REQUEST_STATUS_COLORS[statusKey] || LAUNCH_REQUEST_STATUS_COLORS.draft;
}

export function getLaunchRequestStatusBadgeClasses(status: string | undefined) {
  const color = getLaunchRequestStatusColor(status);
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color.full}`;
}

// ============================================================================
// VERTICAL COLORS
// ============================================================================

export const VERTICAL_COLORS = {
  'E-Comm': {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    darkBg: 'dark:bg-purple-900',
    darkText: 'dark:text-purple-200',
    full: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
  },
  'Bizop': {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    darkBg: 'dark:bg-orange-900',
    darkText: 'dark:text-orange-200',
    full: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
  },
  'Medicare': {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    darkBg: 'dark:bg-blue-900',
    darkText: 'dark:text-blue-200',
    full: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  },
  'Auto Insurance': {
    bg: 'bg-green-100',
    text: 'text-green-800',
    darkBg: 'dark:bg-green-900',
    darkText: 'dark:text-green-200',
    full: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  },
  'VSL': {
    bg: 'bg-pink-100',
    text: 'text-pink-800',
    darkBg: 'dark:bg-pink-900',
    darkText: 'dark:text-pink-200',
    full: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
  },
  'Nutra': {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    darkBg: 'dark:bg-yellow-900',
    darkText: 'dark:text-yellow-200',
    full: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  },
  'Home': {
    bg: 'bg-teal-100',
    text: 'text-teal-800',
    darkBg: 'dark:bg-teal-900',
    darkText: 'dark:text-teal-200',
    full: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
  },
  'Guns': {
    bg: 'bg-red-100',
    text: 'text-red-800',
    darkBg: 'dark:bg-red-900',
    darkText: 'dark:text-red-200',
    full: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  },
  'Refinance': {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    darkBg: 'dark:bg-indigo-900',
    darkText: 'dark:text-indigo-200',
    full: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
  },
  'Refi': {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    darkBg: 'dark:bg-indigo-900',
    darkText: 'dark:text-indigo-200',
    full: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
  }
} as const;

const DEFAULT_VERTICAL_COLOR = {
  bg: 'bg-gray-100',
  text: 'text-gray-800',
  darkBg: 'dark:bg-gray-800',
  darkText: 'dark:text-gray-200',
  full: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
};

export function getVerticalColor(vertical?: string) {
  if (!vertical) return DEFAULT_VERTICAL_COLOR;
  return VERTICAL_COLORS[vertical as keyof typeof VERTICAL_COLORS] || DEFAULT_VERTICAL_COLOR;
}

// ============================================================================
// WORKLOAD/EDITOR STATUS COLORS
// ============================================================================

export const WORKLOAD_STATUS_COLORS = {
  available: {
    label: 'Available',
    color: 'bg-green-500',
    textColor: 'text-green-600',
    bgLight: 'bg-green-50',
    borderColor: 'border-green-200',
    full: 'text-green-600 bg-green-50 border-green-200'
  },
  busy: {
    label: 'Busy',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    bgLight: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    full: 'text-yellow-600 bg-yellow-50 border-yellow-200'
  },
  overloaded: {
    label: 'Overloaded',
    color: 'bg-red-500',
    textColor: 'text-red-600',
    bgLight: 'bg-red-50',
    borderColor: 'border-red-200',
    full: 'text-red-600 bg-red-50 border-red-200'
  },
  at_capacity: {
    label: 'At Capacity',
    color: 'bg-red-700',
    textColor: 'text-red-700',
    bgLight: 'bg-red-100',
    borderColor: 'border-red-300',
    full: 'text-red-700 bg-red-100 border-red-300'
  },
  unavailable: {
    label: 'Unavailable',
    color: 'bg-gray-500',
    textColor: 'text-gray-600',
    bgLight: 'bg-gray-50',
    borderColor: 'border-gray-200',
    full: 'text-gray-600 bg-gray-50 border-gray-200'
  }
} as const;

export function getWorkloadStatusByLoad(loadPercentage: number, isAvailable: boolean = true) {
  if (!isAvailable) return WORKLOAD_STATUS_COLORS.unavailable;
  if (loadPercentage < 50) return WORKLOAD_STATUS_COLORS.available;
  if (loadPercentage < 80) return WORKLOAD_STATUS_COLORS.busy;
  if (loadPercentage < 100) return WORKLOAD_STATUS_COLORS.overloaded;
  return WORKLOAD_STATUS_COLORS.at_capacity;
}

export function getLoadTextColor(loadPercentage: number) {
  if (loadPercentage < 50) return 'text-green-600';
  if (loadPercentage < 80) return 'text-yellow-600';
  return 'text-red-600';
}

export function getLoadBgColor(loadPercentage: number) {
  if (loadPercentage < 50) return 'bg-green-100 dark:bg-green-900/20';
  if (loadPercentage < 80) return 'bg-yellow-100 dark:bg-yellow-900/20';
  return 'bg-red-100 dark:bg-red-900/20';
}

// ============================================================================
// ACTIVITY LOG STATUS COLORS
// ============================================================================

export const ACTIVITY_STATUS_COLORS = {
  success: {
    color: 'text-green-600 dark:text-green-400',
    icon: 'text-green-600'
  },
  failed: {
    color: 'text-red-600 dark:text-red-400',
    icon: 'text-red-600'
  },
  warning: {
    color: 'text-yellow-600 dark:text-yellow-400',
    icon: 'text-yellow-600'
  },
  info: {
    color: 'text-blue-600 dark:text-blue-400',
    icon: 'text-blue-600'
  }
} as const;

export function getActivityStatusColor(status: string) {
  return ACTIVITY_STATUS_COLORS[status as keyof typeof ACTIVITY_STATUS_COLORS] || ACTIVITY_STATUS_COLORS.info;
}

// ============================================================================
// SHARE COUNT COLORS (for Shared By You page)
// ============================================================================

export function getShareCountColor(count: number) {
  if (count >= 6) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
  if (count >= 3) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Combines multiple Tailwind classes into a single string
 */
export function combineClasses(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Get badge classes for a file request status
 */
export function getStatusBadgeClasses(status: string | undefined) {
  const statusColor = getFileRequestStatusColor(status);
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor.full}`;
}

/**
 * Get badge classes for a vertical
 */
export function getVerticalBadgeClasses(vertical?: string) {
  const verticalColor = getVerticalColor(vertical);
  return `inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${verticalColor.full}`;
}
