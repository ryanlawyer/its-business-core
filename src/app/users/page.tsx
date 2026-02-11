'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { permissions, getRoleDisplay, getRoleBadgeColor } from '@/lib/permissions';
import { useDebounce } from '@/hooks/useDebounce';

type Role = {
  id: string;
  name: string;
  code: string;
};

type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  roleId: string;
  isActive: boolean;
  department: { name: string } | null;
  departmentId: string | null;
};

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm);
  const [roleFilter, setRoleFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    roleId: '',
    departmentId: '',
    isActive: true,
  });

  // Check if user is admin
  if (user && !permissions.canManageUsers(user.role as any)) {
    router.push('/');
    return null;
  }

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, roleFilter, departmentFilter, debouncedSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const fetchMetadata = async () => {
    try {
      const [rolesRes, deptsRes] = await Promise.all([
        fetch('/api/roles'),
        fetch('/api/departments'),
      ]);

      const rolesData = await rolesRes.json();
      const deptsData = await deptsRes.json();

      setRoles(rolesData.roles || []);
      setDepartments(deptsData.departments || []);
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
      });

      if (debouncedSearch) params.append('search', debouncedSearch);
      if (roleFilter) params.append('roleId', roleFilter);
      if (departmentFilter) params.append('departmentId', departmentFilter);

      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();

      setUsers(data.users || []);
      setPagination(data.pagination || {});
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = () => {
    setCurrentPage(1);
    fetchUsers();
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchUsers();
  };

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        name: user.name,
        password: '',
        roleId: user.roleId,
        departmentId: user.departmentId || '',
        isActive: user.isActive,
      });
    } else {
      setEditingUser(null);
      const userRole = roles.find(r => r.code === 'USER');
      setFormData({
        email: '',
        name: '',
        password: '',
        roleId: userRole?.id || '',
        departmentId: '',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    const method = editingUser ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Error saving user');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error saving user');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This will anonymize their data and deactivate their account.')) {
      return;
    }

    setDeletingUserId(userId);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Error deleting user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user');
    } finally {
      setDeletingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 pb-24">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="page-title">User Management</h1>
          <button
            onClick={() => openModal()}
            className="btn btn-primary"
          >
            + Add User
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">
                Search
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by name or email..."
                  className="form-input flex-1"
                />
                <button
                  onClick={handleSearch}
                  className="btn btn-primary"
                >
                  Search
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">
                Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="form-input form-select"
              >
                <option value="">All Roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">
                Department
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="form-input form-select"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="card overflow-hidden">
          {users.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">No users found</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4 p-4">
                {users.map((user) => (
                  <div key={user.id} className="card">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-[var(--text-primary)]">{user.name}</h3>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor(
                              user.role.code as any
                            )}`}
                          >
                            {user.role.name}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">{user.email}</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          user.isActive
                            ? 'badge badge-success'
                            : 'badge badge-neutral'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Department:</span>
                        <span className="text-[var(--text-primary)]">{user.department?.name || '-'}</span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openModal(user)}
                        className="btn btn-secondary btn-sm"
                      >
                        Edit
                      </button>
                      {user.id !== session?.user?.id && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={deletingUserId === user.id}
                          className="btn btn-sm text-red-600 hover:text-red-800 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete user"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block table-container">
                <table className="table" aria-label="Users">
                  <thead>
                    <tr>
                      <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">
                        Name
                      </th>
                      <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">
                        Email
                      </th>
                      <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">
                        Role
                      </th>
                      <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">
                        Department
                      </th>
                      <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">
                        Status
                      </th>
                      <th scope="col" className="text-right py-3 px-4 text-sm font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t">
                        <td className="py-3 px-4 text-sm font-medium text-[var(--text-primary)]">
                          {user.name}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">
                          {user.email}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor(
                              user.role.code as any
                            )}`}
                          >
                            {user.role.name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">
                          {user.department?.name || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              user.isActive
                                ? 'badge badge-success'
                                : 'badge badge-neutral'
                            }`}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => openModal(user)}
                              className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                            >
                              Edit
                            </button>
                            {user.id !== session?.user?.id && (
                              <button
                                onClick={() => handleDelete(user.id)}
                                disabled={deletingUserId === user.id}
                                className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete user"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-[var(--text-secondary)]">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} users)
            </span>
            <button
              onClick={() =>
                setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))
              }
              disabled={currentPage === pagination.totalPages}
              className="btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--text-primary)' }}>
              {pagination.total || 0}
            </div>
            <div className="stat-label">Total Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {users.filter((u) => u.isActive).length}
            </div>
            <div className="stat-label">Active Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent-secondary)' }}>
              {users.filter((u) => u.role.code === 'ADMIN').length}
            </div>
            <div className="stat-label">Administrators</div>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              {editingUser ? 'Edit User' : 'Add User'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">
                  Password {editingUser ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required={!editingUser}
                  className="form-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">
                    Role *
                  </label>
                  <select
                    value={formData.roleId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        roleId: e.target.value,
                      })
                    }
                    required
                    className="form-input form-select"
                  >
                    <option value="">Select a role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">
                    Department
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) =>
                      setFormData({ ...formData, departmentId: e.target.value })
                    }
                    className="form-input form-select"
                  >
                    <option value="">No department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="h-4 w-4 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] border-[var(--border-default)] rounded"
                />
                <label
                  htmlFor="isActive"
                  className="ml-2 block text-sm text-[var(--text-secondary)]"
                >
                  Active
                </label>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  {editingUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
