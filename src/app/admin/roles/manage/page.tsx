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
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-gray-600">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Role Management</h1>
            <p className="text-gray-600">Create and manage user roles with custom permissions</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            + Create Role
          </button>
        </div>

        {/* Roles List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Code</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Users</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-t hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{role.name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs">{role.code}</code>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{role.description || '-'}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{role._count?.users || 0}</td>
                  <td className="py-3 px-4 text-sm">
                    {role.isSystem ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        System
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-right space-x-2">
                    <button
                      onClick={() => openModal(role)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    {!role.isSystem && (
                      <button
                        onClick={() => handleDelete(role)}
                        className="text-red-600 hover:text-red-800"
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

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingRole ? 'Edit Role' : 'Create Role'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code *
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      required
                      disabled={editingRole?.isSystem}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>

                {/* Permissions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Permissions</h3>

                  {/* Warning for ADMIN role */}
                  {editingRole?.code === 'ADMIN' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <h4 className="font-semibold text-yellow-900 mb-1">Administrator Role - Full Access Enforced</h4>
                          <p className="text-sm text-yellow-800">
                            The Administrator role always has full system access. All permissions are automatically enabled and cannot be disabled for this role.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    {permissionSections.map((section) => (
                      <div key={section.key} className="border rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">{section.name}</h4>
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
                                <div className="font-medium text-sm text-gray-900">{perm.label}</div>
                                <div className="text-xs text-gray-500">{perm.description}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-semibold transition-colors"
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
