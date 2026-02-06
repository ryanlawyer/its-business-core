'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

type Role = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: any;
  _count?: {
    users: number;
  };
};

const permissionSections = [
  {
    name: 'Timeclock',
    key: 'timeclock',
    permissions: [
      { key: 'canClockInOut', label: 'Clock In/Out', description: 'Can clock in and out for time tracking' },
      { key: 'canViewOwnEntries', label: 'View Own Entries', description: 'Can view their own timeclock history' },
    ],
  },
  {
    name: 'Purchase Orders',
    key: 'purchaseOrders',
    permissions: [
      { key: 'canCreate', label: 'Create', description: 'Can create purchase orders' },
      { key: 'canViewOwn', label: 'View Own', description: 'Can view their own purchase orders' },
      { key: 'canViewDepartment', label: 'View Department', description: 'Can view department purchase orders' },
      { key: 'canViewAll', label: 'View All', description: 'Can view all purchase orders' },
      { key: 'canEdit', label: 'Edit', description: 'Can edit purchase orders' },
      { key: 'canApprove', label: 'Approve', description: 'Can approve purchase orders' },
      { key: 'canDelete', label: 'Delete', description: 'Can delete purchase orders' },
      { key: 'canUploadReceipts', label: 'Upload Receipts', description: 'Can upload receipt images/PDFs to purchase orders' },
    ],
  },
  {
    name: 'Budget',
    key: 'budgetItems',
    permissions: [
      { key: 'canView', label: 'View Budget Items', description: 'Can view budget items' },
      { key: 'canManage', label: 'Manage Budget Items', description: 'Can create and edit budget items' },
      { key: 'canCreateAmendments', label: 'Create Amendments', description: 'Can increase or decrease budget line items' },
      { key: 'canTransferFunds', label: 'Transfer Funds', description: 'Can transfer funds between budget line items' },
      { key: 'canViewAllCategories', label: 'View All Categories', description: 'Can view the entire budget category structure' },
      { key: 'canManageCategories', label: 'Manage Categories', description: 'Can create and edit budget categories' },
      { key: 'canCloseFiscalYear', label: 'Close Fiscal Year', description: 'Can perform soft/hard close on fiscal years' },
      { key: 'canAccessClosedYears', label: 'Access Closed Years', description: 'Can view and edit prior year data' },
      { key: 'canExportReports', label: 'Export Reports', description: 'Can export budget reports to CSV' },
    ],
  },
  {
    name: 'Vendors',
    key: 'vendors',
    permissions: [
      { key: 'canView', label: 'View', description: 'Can view vendors' },
      { key: 'canManage', label: 'Manage', description: 'Can create and edit vendors' },
    ],
  },
  {
    name: 'Users',
    key: 'users',
    permissions: [
      { key: 'canManage', label: 'Manage Users', description: 'Can create and manage user accounts' },
    ],
  },
  {
    name: 'Departments',
    key: 'departments',
    permissions: [
      { key: 'canManage', label: 'Manage Departments', description: 'Can create and manage departments' },
    ],
  },
  {
    name: 'Roles',
    key: 'roles',
    permissions: [
      { key: 'canManage', label: 'Manage Roles', description: 'Can create and manage roles' },
    ],
  },
];

export default function ManageRolesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    permissions: {} as any,
  });

  // Check if user has permission
  if (user && user.roleCode !== 'ADMIN') {
    router.push('/');
    return null;
  }

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles');
      if (!res.ok) {
        console.error('Fetch roles failed with status:', res.status);
        if (res.status === 401) {
          alert('Your session has expired. Please log in again.');
          router.push('/auth/signin');
          return;
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setRoles(data.roles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      alert('Failed to load roles. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        code: role.code,
        description: role.description || '',
        permissions: role.permissions || {},
      });
    } else {
      setEditingRole(null);
      setFormData({
        name: '',
        code: '',
        description: '',
        permissions: {},
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
    const method = editingRole ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        fetchRoles();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save role');
      }
    } catch (error) {
      console.error('Error saving role:', error);
      alert('Failed to save role');
    }
  };

  const handleDelete = async (role: Role) => {
    if (role.isSystem) {
      alert('Cannot delete system roles');
      return;
    }

    if (!confirm(`Delete role "${role.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchRoles();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete role');
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      alert('Failed to delete role');
    }
  };

  const togglePermission = (sectionKey: string, permKey: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [sectionKey]: {
          ...(prev.permissions[sectionKey] || {}),
          [permKey]: !prev.permissions[sectionKey]?.[permKey],
        },
      },
    }));
  };

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-[var(--text-secondary)]">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="page-title mb-2">Role Management</h1>
            <p className="text-[var(--text-secondary)]">Create and manage user roles with custom permissions</p>
          </div>
          <button
            onClick={() => openModal()}
            className="btn btn-primary"
          >
            + Create Role
          </button>
        </div>

        {/* Roles List */}
        <div className="card overflow-hidden">
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4 p-4">
            {roles.map((role) => {
              // Build a summary of enabled permissions
              const permSummary = permissionSections
                .map((section) => {
                  const enabledPerms = section.permissions.filter(
                    (perm) => role.permissions?.[section.key]?.[perm.key]
                  );
                  if (enabledPerms.length === 0) return null;
                  return `${section.name}: ${enabledPerms.map((p) => p.label).join(', ')}`;
                })
                .filter(Boolean);

              return (
                <div key={role.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">{role.name}</h3>
                      <code className="bg-[var(--bg-hover)] px-2 py-1 rounded text-xs">{role.code}</code>
                    </div>
                    {role.isSystem ? (
                      <span className="badge badge-info">System</span>
                    ) : (
                      <span className="badge badge-neutral">Custom</span>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-sm text-[var(--text-secondary)] mb-3">{role.description}</p>
                  )}
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Users:</span>
                      <span className="text-[var(--text-primary)]">{role._count?.users || 0}</span>
                    </div>
                    {permSummary.length > 0 && (
                      <div>
                        <span className="text-[var(--text-secondary)]">Permissions:</span>
                        <div className="mt-1 space-y-1">
                          {permSummary.map((summary, idx) => (
                            <p key={idx} className="text-xs text-[var(--text-muted)]">{summary}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-[var(--border-default)]">
                    <button
                      onClick={() => openModal(role)}
                      className="btn btn-secondary flex-1"
                    >
                      Edit
                    </button>
                    {!role.isSystem && (
                      <button
                        onClick={() => handleDelete(role)}
                        className="btn btn-danger flex-1"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Code</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Description</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Users</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Type</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td className="py-3 px-4 text-sm font-medium">{role.name}</td>
                    <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">
                      <code className="bg-[var(--bg-hover)] px-2 py-1 rounded text-xs">{role.code}</code>
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{role.description || '-'}</td>
                    <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{role._count?.users || 0}</td>
                    <td className="py-3 px-4 text-sm">
                      {role.isSystem ? (
                        <span className="badge badge-info">
                          System
                        </span>
                      ) : (
                        <span className="badge badge-neutral">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-right space-x-2">
                      <button
                        onClick={() => openModal(role)}
                        className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                      >
                        Edit
                      </button>
                      {!role.isSystem && (
                        <button
                          onClick={() => handleDelete(role)}
                          className="text-[var(--error)] hover:text-[var(--error)]"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border-default)] px-6 py-4">
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                  {editingRole ? 'Edit Role' : 'Create Role'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="form-input w-full"
                    />
                  </div>
                  <div>
                    <label className="form-label">
                      Code *
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      required
                      disabled={editingRole?.isSystem}
                      className="form-input w-full disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="form-input w-full"
                  />
                </div>

                {/* Permissions */}
                <div>
                  <h3 className="section-title mb-4">Permissions</h3>

                  {/* Warning for ADMIN role */}
                  {editingRole?.code === 'ADMIN' && (
                    <div className="rounded-[var(--radius-lg)] border border-[var(--warning-muted)] bg-[var(--warning-subtle)] text-[var(--warning)] px-4 py-3 mb-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <h4 className="font-semibold mb-1">Administrator Role - Full Access Enforced</h4>
                          <p className="text-sm">
                            The Administrator role always has full system access. All permissions are automatically enabled and cannot be disabled for this role.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    {permissionSections.map((section) => (
                      <div key={section.key} className="border border-[var(--border-default)] rounded-lg p-4">
                        <h4 className="font-semibold text-[var(--text-primary)] mb-3">{section.name}</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {section.permissions.map((perm) => (
                            <label key={perm.key} className={`flex items-start gap-3 ${editingRole?.code === 'ADMIN' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                checked={editingRole?.code === 'ADMIN' ? true : (formData.permissions[section.key]?.[perm.key] || false)}
                                onChange={() => editingRole?.code !== 'ADMIN' && togglePermission(section.key, perm.key)}
                                disabled={editingRole?.code === 'ADMIN'}
                                className="mt-1"
                              />
                              <div>
                                <div className="font-medium text-sm text-[var(--text-primary)]">{perm.label}</div>
                                <div className="text-xs text-[var(--text-muted)]">{perm.description}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-default)]">
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
                    {editingRole ? 'Update Role' : 'Create Role'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
