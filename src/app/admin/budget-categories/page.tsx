'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface BudgetCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  glAccountCode: string | null;
  isActive: boolean;
  parent: { id: string; code: string; name: string } | null;
  children: { id: string; code: string; name: string; isActive: boolean }[];
  _count: { budgetItems: number };
}

export default function BudgetCategoriesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    parentId: '',
    glAccountCode: '',
    isActive: true,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchCategories();
    }
  }, [status, router]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/budget-categories');
      if (!res.ok) {
        if (res.status === 403) {
          setError('You do not have permission to view budget categories');
        } else {
          throw new Error('Failed to fetch categories');
        }
        return;
      }
      const data = await res.json();
      setCategories(data.categories);
    } catch (err) {
      setError('Failed to load budget categories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const url = editingId
        ? `/api/budget-categories/${editingId}`
        : '/api/budget-categories';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          parentId: formData.parentId || null,
          glAccountCode: formData.glAccountCode || null,
          description: formData.description || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save category');
      }

      await fetchCategories();
      resetForm();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = (category: BudgetCategory) => {
    setEditingId(category.id);
    setFormData({
      code: category.code,
      name: category.name,
      description: category.description || '',
      parentId: category.parentId || '',
      glAccountCode: category.glAccountCode || '',
      isActive: category.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const res = await fetch(`/api/budget-categories/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete category');
      }

      await fetchCategories();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      parentId: '',
      glAccountCode: '',
      isActive: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  // Build hierarchical display helper
  const buildHierarchy = (
    parentId: string | null = null,
    level: number = 0
  ): BudgetCategory[] => {
    return categories
      .filter((cat) => cat.parentId === parentId)
      .sort((a, b) => a.code.localeCompare(b.code))
      .flatMap((cat) => [
        { ...cat, level },
        ...buildHierarchy(cat.id, level + 1),
      ]) as BudgetCategory[];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  if (error && !showForm) {
    return (
      <div className="p-8">
        <div className="rounded-[var(--radius-lg)] border border-[var(--error-muted)] bg-[var(--error-subtle)] text-[var(--error)] px-4 py-3">
          {error}
        </div>
      </div>
    );
  }

  const hierarchicalCategories = buildHierarchy();

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title">Budget Categories</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
        >
          {showForm ? 'Cancel' : 'New Category'}
        </button>
      </div>

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--error-muted)] bg-[var(--error-subtle)] text-[var(--error)] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="section-title mb-4">
            {editingId ? 'Edit Category' : 'New Category'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">
                  Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  className="form-input w-full"
                  required
                />
              </div>
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
                  className="form-input w-full"
                  required
                />
              </div>
            </div>

            <div>
              <label className="form-label">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="form-input w-full"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">
                  Parent Category
                </label>
                <select
                  value={formData.parentId}
                  onChange={(e) =>
                    setFormData({ ...formData, parentId: e.target.value })
                  }
                  className="form-input form-select w-full"
                >
                  <option value="">None (Top Level)</option>
                  {categories
                    .filter((cat) => cat.id !== editingId)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.code} - {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="form-label">
                  GL Account Code
                </label>
                <input
                  type="text"
                  value={formData.glAccountCode}
                  onChange={(e) =>
                    setFormData({ ...formData, glAccountCode: e.target.value })
                  }
                  className="form-input w-full"
                  placeholder="For QuickBooks/Xero integration"
                />
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
                className="h-4 w-4 text-[var(--accent-primary)] rounded border-[var(--border-default)]"
              />
              <label htmlFor="isActive" className="ml-2 text-sm text-[var(--text-secondary)]">
                Active
              </label>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="btn btn-primary"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4 p-4">
          {hierarchicalCategories.map((category: any) => (
            <div key={category.id} className="card">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                      {category.level > 0 && (
                        <span className="text-[var(--text-muted)]" style={{ paddingLeft: `${(category.level - 1) * 12}px` }}>
                          {'\u2514\u2500 '}
                        </span>
                      )}
                      {category.name}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)]">{category.code}</p>
                  </div>
                </div>
                <span
                  className={
                    category.isActive
                      ? 'badge badge-success'
                      : 'badge badge-neutral'
                  }
                >
                  {category.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Parent:</span>
                  <span className="text-[var(--text-primary)]">{category.parent ? category.parent.code : '\u2014'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">GL Account:</span>
                  <span className="text-[var(--text-primary)]">{category.glAccountCode || '\u2014'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Budget Items:</span>
                  <span className="text-[var(--text-primary)]">{category._count.budgetItems}</span>
                </div>
              </div>
              <div className="flex gap-2 border-t border-[var(--border-default)] pt-3">
                <button
                  onClick={() => handleEdit(category)}
                  className="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(category.id)}
                  className="text-sm text-[var(--error)] hover:text-[var(--error)]"
                  disabled={
                    category._count.budgetItems > 0 || category.children.length > 0
                  }
                  title={
                    category._count.budgetItems > 0
                      ? 'Cannot delete category with budget items'
                      : category.children.length > 0
                      ? 'Cannot delete category with subcategories'
                      : 'Delete category'
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="empty-state">
              <p className="empty-state-title">No budget categories found</p>
              <p className="empty-state-description">Create one to get started.</p>
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block table-container">
          <table className="table" aria-label="Budget categories">
            <thead>
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                  Code
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                  Parent
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                  GL Account
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                  Budget Items
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {hierarchicalCategories.map((category: any) => (
                <tr key={category.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {category.code}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span style={{ paddingLeft: `${category.level * 20}px` }}>
                      {category.level > 0 && '\u2514\u2500 '}
                      {category.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-muted)]">
                    {category.parent ? `${category.parent.code}` : '\u2014'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-muted)]">
                    {category.glAccountCode || '\u2014'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-muted)]">
                    {category._count.budgetItems}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={
                        category.isActive
                          ? 'badge badge-success'
                          : 'badge badge-neutral'
                      }
                    >
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(category)}
                      className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="text-[var(--error)] hover:text-[var(--error)]"
                      disabled={
                        category._count.budgetItems > 0 || category.children.length > 0
                      }
                      title={
                        category._count.budgetItems > 0
                          ? 'Cannot delete category with budget items'
                          : category.children.length > 0
                          ? 'Cannot delete category with subcategories'
                          : 'Delete category'
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {categories.length === 0 && (
          <div className="empty-state">
            <p className="empty-state-title">No budget categories found</p>
            <p className="empty-state-description">Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
