import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../lib/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: string) => Promise<any>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      // Refresh user data from server to pick up role/permission changes
      authApi.me().then(res => {
        const freshUser = res.data?.data || res.data?.user;
        if (freshUser && freshUser.id) {
          // Merge fresh server data with stored user (keep token valid)
          const merged = { ...parsedUser, ...freshUser };
          setUser(merged);
          localStorage.setItem('user', JSON.stringify(merged));
        }
      }).catch(() => {
        // Token may be expired — force logout
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }).finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    const { user, token } = response.data.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    setToken(token);
    setUser(user);
  };

  const register = async (name: string, email: string, password: string, role: string = 'creative') => {
    const response = await authApi.register({ name, email, password, role });

    // Check if requires approval (new workflow)
    if (response.data.requiresApproval) {
      return {
        requiresApproval: true,
        message: response.data.message
      };
    }

    // Old workflow - direct login (shouldn't happen with new system)
    const { user, token } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    setToken(token);
    setUser(user);

    return { requiresApproval: false };
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/** Check if a role has admin-level access (admin or team_lead) */
export function isAdminRole(role?: string): boolean {
  return role === 'admin' || role === 'team_lead';
}
