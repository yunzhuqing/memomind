'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  UserIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ShieldCheckIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  team_id: number | null;
  address: string | null;
  created_at: string;
}

interface UserManagementProps {
  currentUserId: string;
}

export default function UserManagement({ currentUserId }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user',
    team_id: '',
    address: '',
  });

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users?requestingUserId=${currentUserId}`);
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.users);
      } else {
        toast.error(data.error || 'Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!formData.email || !formData.password || !formData.name) {
      toast.error('Email, password, and name are required');
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestingUserId: currentUserId,
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role,
          team_id: formData.team_id ? parseInt(formData.team_id) : null,
          address: formData.address || null,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('User created successfully!');
        loadUsers();
        setShowAddDialog(false);
        resetForm();
      } else {
        toast.error(data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestingUserId: currentUserId,
          userId: editingUser.id,
          email: formData.email,
          name: formData.name,
          role: formData.role,
          team_id: formData.team_id ? parseInt(formData.team_id) : null,
          address: formData.address || null,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('User updated successfully!');
        loadUsers();
        setShowEditDialog(false);
        setEditingUser(null);
        resetForm();
      } else {
        toast.error(data.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`/api/admin/users?requestingUserId=${currentUserId}&userId=${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('User deleted successfully!');
        loadUsers();
      } else {
        toast.error(data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      team_id: user.team_id?.toString() || '',
      address: user.address || '',
    });
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'user',
      team_id: '',
      address: '',
    });
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <ShieldCheckIcon className="w-3 h-3" />
          Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <UserIcon className="w-3 h-3" />
        User
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              User Management
            </h2>
            <p className="text-sm text-gray-500 mt-1">Manage system users and permissions</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowAddDialog(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            Add User
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">Total Users:</span>
            <span className="font-semibold text-gray-900">{users.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-purple-500" />
            <span className="text-gray-600">Admins:</span>
            <span className="font-semibold text-gray-900">
              {users.filter(u => u.role === 'admin').length}
            </span>
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 text-sm">Loading users...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="group flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-2xl hover:bg-white hover:shadow-md hover:border-indigo-200 transition-all duration-200"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm flex-shrink-0">
                    <UserIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-semibold text-gray-900 truncate">{user.name}</div>
                      {getRoleBadge(user.role)}
                    </div>
                    <div className="text-sm text-gray-600 truncate">{user.email}</div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      {user.team_id && (
                        <span>Team ID: {user.team_id}</span>
                      )}
                      {user.address && (
                        <span className="truncate max-w-xs">{user.address}</span>
                      )}
                      <span>Joined: {new Date(user.created_at).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                      })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditDialog(user)}
                    className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    title="Edit user"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Delete user"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <UsersIcon className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No users found</p>
                <p className="text-gray-400 text-sm mt-1">Add users to get started</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add User Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl transform transition-all">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add New User</h3>
              <button
                onClick={() => setShowAddDialog(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                  placeholder="user@example.com"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                  placeholder="John Doe"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team ID</label>
                <input
                  type="number"
                  value={formData.team_id}
                  onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-gray-900"
                  rows={2}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowAddDialog(false)}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg font-medium"
              >
                Add User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Dialog */}
      {showEditDialog && editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl transform transition-all">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Edit User</h3>
              <button
                onClick={() => {
                  setShowEditDialog(false);
                  setEditingUser(null);
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team ID</label>
                <input
                  type="number"
                  value={formData.team_id}
                  onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-gray-900"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowEditDialog(false);
                  setEditingUser(null);
                }}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleEditUser}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg font-medium"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
