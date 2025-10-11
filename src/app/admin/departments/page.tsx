'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

type Department = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count?: {
    users: number;
    budgetItems: number;
  };
};

export default function DepartmentsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments?includeInactive=true');
      const data = await res.json();
      setDepartments(data.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (department?: Department) => {
    if (department) {
      setEditingDepartment(department);
      setFormData({
        name: department.name,
        description: department.description || '',
      });
    } else {
      setEditingDepartment(null);
      setFormData({
        name: '',
        description: '',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingDepartment
      ? `/api/departments/${editingDepartment.id}`
      : '/api/departments';
    const method = editingDepartment ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          isActive: editingDepartment ? editingDepartment.isActive : true,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        fetchDepartments();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save department');
      }
    } catch (error) {
      console.error('Error saving department:', error);
      alert('Failed to save department');
    }
  };

  const handleToggleActive = async (department: Department) => {
    if (!confirm(`${department.isActive ? 'Deactivate' : 'Activate'} department "${department.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/departments/${department.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: department.name,
          description: department.description,
          isActive: !department.isActive,
        }),
      });

      if (res.ok) {
        fetchDepartments();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update department');
      }
    } catch (error) {
      console.error('Error updating department:', error);
      alert('Failed to update department');
    }
  };

  const handleDelete = async (department: Department) => {
    if (department._count && (department._count.users > 0 || department._count.budgetItems > 0)) {
      alert(
        `Cannot delete department with ${department._count.users} user(s) and ${department._count.budgetItems} budget item(s). Please reassign them first.`
      );
      return;
    }

    if (!confirm(`Delete department "${department.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/departments/${department.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchDepartments();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete department');
      }
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Failed to delete department');
    }
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Department Management</h1>
            <p className="text-gray-600">Manage organizational departments</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            + Add Department
          </button>
        </div>

        {/* Departments List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {departments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No departments found. Create your first department to get started.
            </div>
          ) : (
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Users</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Budget Items</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id} className="border-t hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{dept.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{dept.description || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{dept._count?.users || 0}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{dept._count?.budgetItems || 0}</td>
                    <td className="py-3 px-4 text-sm">
                      {dept.isActive ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-right space-x-2">
                      <button
                        onClick={() => openModal(dept)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(dept)}
                        className="text-yellow-600 hover:text-yellow-800"
                      >
                        {dept.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(dept)}
                        className="text-red-600 hover:text-red-800"
                        disabled={dept._count && (dept._count.users > 0 || dept._count.budgetItems > 0)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-md">
              <div className="border-b px-6 py-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingDepartment ? 'Edit Department' : 'Add Department'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
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
                    {editingDepartment ? 'Update' : 'Create'}
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
