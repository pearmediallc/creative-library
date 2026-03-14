import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { rbacApi } from '../lib/api';
import { Check, X, Loader2 } from 'lucide-react';

interface PermissionMatrix {
  permissions: Record<string, Record<string, string[]>>;
  roles: string[];
  resources: string[];
  allActions: Record<string, string[]>;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  buyer: 'Buyer',
  creative: 'Creative',
  vertical_head: 'Vertical Head',
  team_lead: 'Team Lead',
  assistant_team_lead: 'Asst. Team Lead',
};

const RESOURCE_LABELS: Record<string, string> = {
  media: 'Media',
  folders: 'Folders',
  file_requests: 'File Requests',
  workload: 'Workload',
  users: 'Users',
  teams: 'Teams',
};

function formatAction(action: string): string {
  return action
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function RBACPermissionsMatrix() {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchMatrix();
  }, []);

  const fetchMatrix = async () => {
    try {
      const res = await rbacApi.getPermissionMatrix();
      const data = res.data.data;
      setMatrix(data);
      // Start all resources collapsed (accordion style)
      setExpandedResources(new Set());
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load permission matrix');
    } finally {
      setLoading(false);
    }
  };

  const toggleResource = (resource: string) => {
    setExpandedResources(prev => {
      const next = new Set(prev);
      if (next.has(resource)) {
        next.delete(resource);
      } else {
        next.add(resource);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
          <span className="ml-2 text-muted-foreground">Loading permissions...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-destructive text-center">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!matrix) return null;

  const { permissions, roles, resources, allActions } = matrix;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          RBAC Permission Matrix
        </CardTitle>
        <CardDescription>
          View role-based permissions across all resource types. Click a resource group to expand or collapse.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-3 px-3 font-semibold text-muted-foreground sticky left-0 bg-background min-w-[200px]">
                  Resource / Action
                </th>
                {roles.map(role => (
                  <th key={role} className="text-center py-3 px-2 font-semibold min-w-[100px]">
                    <span className="text-xs uppercase tracking-wider">
                      {ROLE_LABELS[role] || role}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map(resource => {
                const isExpanded = expandedResources.has(resource);
                const actions = allActions[resource] || [];

                return (
                  <React.Fragment key={resource}>
                    {/* Resource group header */}
                    <tr
                      className="border-b border-border bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => toggleResource(resource)}
                    >
                      <td className="py-2.5 px-3 font-semibold sticky left-0 bg-muted/50">
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4">
                            {isExpanded ? '\u25BC' : '\u25B6'}
                          </span>
                          {RESOURCE_LABELS[resource] || resource}
                          <span className="text-xs text-muted-foreground font-normal">
                            ({actions.length} actions)
                          </span>
                        </span>
                      </td>
                      {roles.map(role => {
                        const rolePerms = permissions[role]?.[resource] || [];
                        const count = rolePerms.length;
                        const total = actions.length;
                        return (
                          <td key={role} className="text-center py-2.5 px-2">
                            <span className={`text-xs font-medium ${
                              count === total
                                ? 'text-green-600 dark:text-green-400'
                                : count === 0
                                ? 'text-red-500 dark:text-red-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}>
                              {count}/{total}
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Individual action rows */}
                    {isExpanded && actions.map(action => (
                      <tr key={`${resource}-${action}`} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 pl-10 text-muted-foreground sticky left-0 bg-background">
                          {formatAction(action)}
                        </td>
                        {roles.map(role => {
                          const has = permissions[role]?.[resource]?.includes(action) || false;
                          return (
                            <td key={role} className="text-center py-2 px-2">
                              {has ? (
                                <Check size={16} className="inline-block text-green-600 dark:text-green-400" />
                              ) : (
                                <X size={14} className="inline-block text-red-300 dark:text-red-800" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
