import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

interface UIPermission {
  visible: boolean;
  enabled: boolean;
  customLabel?: string;
}

interface UIPermissions {
  dashboard: UIPermission;
  file_requests: UIPermission;
  media_library: UIPermission;
  canvas: UIPermission;
  analytics: UIPermission;
  admin_panel: UIPermission;
  [key: string]: UIPermission; // Allow dynamic keys
}

interface PermissionsContextType {
  uiPermissions: UIPermissions | null;
  loading: boolean;
  refreshPermissions: () => Promise<void>;
  hasUIPermission: (element: string) => boolean;
  isUIEnabled: (element: string) => boolean;
  getUILabel: (element: string, defaultLabel: string) => string;
}

const defaultPermissions: UIPermissions = {
  dashboard: { visible: true, enabled: true },
  file_requests: { visible: true, enabled: true },
  media_library: { visible: true, enabled: true },
  canvas: { visible: true, enabled: true },
  analytics: { visible: false, enabled: true },
  admin_panel: { visible: false, enabled: true }
};

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [uiPermissions, setUIPermissions] = useState<UIPermissions | null>(defaultPermissions);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = async () => {
    if (!user) {
      setUIPermissions(defaultPermissions);
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/rbac/permissions/ui`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUIPermissions(response.data.data);
    } catch (error) {
      console.error('Failed to fetch UI permissions:', error);
      // Fall back to defaults on error
      setUIPermissions(defaultPermissions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [user]);

  const hasUIPermission = (element: string): boolean => {
    if (!uiPermissions) return false;
    return uiPermissions[element]?.visible !== false;
  };

  const isUIEnabled = (element: string): boolean => {
    if (!uiPermissions) return false;
    return uiPermissions[element]?.enabled !== false;
  };

  const getUILabel = (element: string, defaultLabel: string): string => {
    if (!uiPermissions) return defaultLabel;
    return uiPermissions[element]?.customLabel || defaultLabel;
  };

  return (
    <PermissionsContext.Provider
      value={{
        uiPermissions,
        loading,
        refreshPermissions: fetchPermissions,
        hasUIPermission,
        isUIEnabled,
        getUILabel
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
