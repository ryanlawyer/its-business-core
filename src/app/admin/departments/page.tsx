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
            <h1 className="page-title mb-2">Department Management</h1>
            <p className="text-[var(--text-secondary)]">Manage organizational departments</p>
          </div>
          <button
            onClick={() => openModal()}
            className="btn btn-primary"
          >
            + Add Department
          </button>
        </div>

        {/* Departments List */}
        <div className="card overflow-hidden">
          {departments.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">No departments found</p>
              <p className="empty-state-description">Create your first department to get started.</p>
            </div>
          ) : (
            <>
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4 p-4">
              {departments.map((dept) => (
                <div key={dept.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">{dept.name}</h3>
                      <p className="text-sm text-[var(--text-secondary)]">{dept.description || 'No description'}</p>
                    </div>
                    {dept.isActive ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-neutral">Inactive</span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Users:</span>
                      <span className="text-[var(--text-primary)]">{dept._count?.users || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Budget Items:</span>
                      <span className="text-[var(--text-primary)]">{dept._count?.budgetItems || 0}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-[var(--border-default)]">
                    <button
                      onClick={() => openModal(dept)}
                      className="btn btn-secondary flex-1"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(dept)}
                      className="btn btn-warning flex-1"
                    >
                      {dept.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(dept)}
                      className="btn btn-danger flex-1"
                      disabled={dept._count && (dept._count.users > 0 || dept._count.budgetItems > 0)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block table-container">
              <table className="table" aria-label="Departments">
                <thead>
                  <tr>
                    <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">Name</th>
                    <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">Description</th>
                    <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">Users</th>
                    <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">Budget Items</th>
                    <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">Status</th>
                    <th scope="col" className="text-right py-3 px-4 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => (
                    <tr key={dept.id}>
                      <td className="py-3 px-4 text-sm font-medium">{dept.name}</td>
                      <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{dept.description || '-'}</td>
                      <td className="py-3 px-4 text-sm">{dept._count?.users || 0}</td>
                      <td className="py-3 px-4 text-sm">{dept._count?.budgetItems || 0}</td>
                      <td className="py-3 px-4 text-sm">
                        {dept.isActive ? (
                          <span className="badge badge-success">
                            Active
                          </span>
                        ) : (
                          <span className="badge badge-neutral">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-right space-x-2">
                        <button
                          onClick={() => openModal(dept)}
                          className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(dept)}
                          className="text-[var(--warning)] hover:text-[var(--warning)]"
                        >
                          {dept.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(dept)}
                          className="text-[var(--error)] hover:text-[var(--error)]"
                          disabled={dept._count && (dept._count.users > 0 || dept._count.budgetItems > 0)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-md">
              <div className="border-b border-[var(--border-default)] px-6 py-4">
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                  {editingDepartment ? 'Edit Department' : 'Add Department'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="form-input w-full"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
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
