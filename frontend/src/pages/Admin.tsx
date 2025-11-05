import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { adminApi } from '../lib/api';
import { User } from '../types';
import { Shield, Plus, Edit2, Check, X } from 'lucide-react';

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
                      <button
                        onClick={() => startEdit(user)}
                        className="p-2 hover:bg-accent rounded"
                      >
                        <Edit2 size={18} className="text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
