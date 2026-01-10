import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { adminApi } from '../lib/api';
import { User } from '../types';
import { Shield, Plus, Edit2, Check, X, Key, Copy } from 'lucide-react';
import { SlackSettingsPanel } from '../components/SlackSettingsPanel';

export function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'creative',
    upload_limit_monthly: 100,
  });
  const [error, setError] = useState('');

  // Password reset state
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getStats(),
      ]);
      setUsers(usersRes.data.data || []);
      setStats(statsRes.data.data || null);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      setError('All fields are required');
      return;
    }

    try {
      await adminApi.createUser(formData);
      setFormData({ name: '', email: '', password: '', role: 'creative', upload_limit_monthly: 100 });
      setShowAddForm(false);
      setError('');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (id: string) => {
    try {
      await adminApi.updateUser(id, {
        name: formData.name,
        role: formData.role as any,
        upload_limit_monthly: formData.upload_limit_monthly,
      });
      setEditingId(null);
      setFormData({ name: '', email: '', password: '', role: 'creative', upload_limit_monthly: 100 });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      upload_limit_monthly: user.upload_limit_monthly,
    });
  };

  const handleResetPassword = async (userId: string) => {
    if (!adminPassword || !newPassword) {
      setError('Please enter both your admin password and new user password');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    try {
      const response = await adminApi.resetUserPassword(userId, {
        admin_password: adminPassword,
        new_password: newPassword
      });

      setGeneratedPassword(response.data.data.new_password);
      setAdminPassword('');
      setNewPassword('');
      setError('');

      // Log activity
      console.log('Password reset successful for user:', userId);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const closeResetModal = () => {
    setResetPasswordUserId(null);
    setAdminPassword('');
    setNewPassword('');
    setGeneratedPassword(null);
    setError('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Password copied to clipboard!');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">User and system management</p>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={16} className="mr-2" />
            Add User
          </Button>
        </div>

        {/* System Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Users</CardDescription>
                <CardTitle className="text-3xl">{stats.users?.total || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Editors</CardDescription>
                <CardTitle className="text-3xl">{stats.editors?.total || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Files</CardDescription>
                <CardTitle className="text-3xl">{stats.storage?.total_files || 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Slack Integration */}
        <SlackSettingsPanel />

        {/* Add User Form */}
        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add New User</CardTitle>
              <CardDescription>Create a new user account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      <option value="creative">Creative</option>
                      <option value="buyer">Buyer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-medium">Upload Limit (per month)</label>
                    <Input
                      type="number"
                      value={formData.upload_limit_monthly}
                      onChange={(e) => setFormData({ ...formData, upload_limit_monthly: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddUser}>Create User</Button>
                  <Button variant="outline" onClick={() => {
                    setShowAddForm(false);
                    setFormData({ name: '', email: '', password: '', role: 'creative', upload_limit_monthly: 100 });
                    setError('');
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>Manage user accounts and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield size={20} className="text-primary" />
                    </div>
                    {editingId === user.id ? (
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Name"
                        />
                        <select
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          className="h-10 px-3 rounded-md border border-input bg-background"
                        >
                          <option value="creative">Creative</option>
                          <option value="buyer">Buyer</option>
                          <option value="admin">Admin</option>
                        </select>
                        <Input
                          type="number"
                          value={formData.upload_limit_monthly}
                          onChange={(e) => setFormData({ ...formData, upload_limit_monthly: parseInt(e.target.value) })}
                          placeholder="Upload limit"
                        />
                      </div>
                    ) : (
                      <div className="flex-1">
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    )}
                    {!editingId && (
                      <div className="flex gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Role:</span>{' '}
                          <span className="font-medium capitalize">{user.role}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Limit:</span>{' '}
                          <span className="font-medium">{user.upload_limit_monthly}/month</span>
                        </div>
                        <div>
                          <span className={user.is_active ? 'text-primary' : 'text-destructive'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {editingId === user.id ? (
                      <>
                        <button
                          onClick={() => handleUpdateUser(user.id)}
                          className="p-2 hover:bg-accent rounded"
                        >
                          <Check size={18} className="text-primary" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setFormData({ name: '', email: '', password: '', role: 'creative', upload_limit_monthly: 100 });
                          }}
                          className="p-2 hover:bg-accent rounded"
                        >
                          <X size={18} className="text-muted-foreground" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(user)}
                          className="p-2 hover:bg-accent rounded"
                          title="Edit user"
                        >
                          <Edit2 size={18} className="text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => setResetPasswordUserId(user.id)}
                          className="p-2 hover:bg-accent rounded"
                          title="Reset password"
                        >
                          <Key size={18} className="text-muted-foreground" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Password Reset Modal */}
        {resetPasswordUserId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle>Reset User Password</CardTitle>
                <CardDescription>
                  {generatedPassword
                    ? 'Password has been reset successfully'
                    : 'Enter your admin password to confirm password reset'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!generatedPassword ? (
                  <div className="space-y-4">
                    {error && (
                      <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                        {error}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Your Admin Password</label>
                      <Input
                        type="password"
                        placeholder="Enter your password to confirm"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">New Password for User</label>
                      <Input
                        type="text"
                        placeholder="Enter new password (min 8 characters)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Min 8 characters. You can copy this password to give to the user.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={closeResetModal}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleResetPassword(resetPasswordUserId)}
                        className="flex-1"
                        disabled={!adminPassword || !newPassword}
                      >
                        Reset Password
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-primary/10 rounded-lg space-y-2">
                      <p className="text-sm font-medium">New Password:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-background rounded text-sm font-mono">
                          {generatedPassword}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(generatedPassword)}
                        >
                          <Copy size={16} />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Copy this password and provide it to the user.
                      </p>
                    </div>

                    <Button onClick={closeResetModal} className="w-full">
                      Done
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
