'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { permissions } from '@/lib/permissions';
import { useDebounce } from '@/hooks/useDebounce';

type BudgetItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  budgetAmount: number;
  fiscalYear: number;
  accrualType: string;
  department: { id: string; name: string } | null;
  category: { id: string; code: string; name: string } | null;
  encumbered: number;
  actualSpent: number;
  accruedAmount: number;
  available: number;
  remaining: number;
  spent: number; // Legacy compatibility
};

export default function BudgetItemsPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [items, setItems] = useState<BudgetItem[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 0,
  });

  const [formData, setFormData] = useState({
    code: '',
    description: '',
    budgetAmount: '',
    departmentId: '',
    fiscalYear: new Date().getFullYear().toString(),
    accrualType: 'ANNUAL',
  });

  const canManage = user && permissions.canManageBudgetItems(user.role as any);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [currentPage, departmentFilter, debouncedSearch]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      setDepartments(data.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '100',
      });

      if (debouncedSearch) params.append('search', debouncedSearch);
      if (departmentFilter) params.append('departmentId', departmentFilter);

      const res = await fetch(`/api/budget-items?${params}`);
      const data = await res.json();

      setItems(data.items || []);
      setPagination(data.pagination || {});
    } catch (error) {
      console.error('Error fetching budget items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = () => {
    setCurrentPage(1);
    fetchItems();
  };

  const openModal = () => {
    setFormData({
      code: '',
      description: '',
      budgetAmount: '',
      departmentId: '',
      fiscalYear: new Date().getFullYear().toString(),
      accrualType: 'ANNUAL',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/budget-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        alert('Error saving budget item');
      }
    } catch (error) {
      console.error('Error saving budget item:', error);
      alert('Error saving budget item');
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchItems();
  };

  const filteredItems = items; // Filtering now happens on backend

  const getPercentageUsed = (item: BudgetItem) => {
    if (item.budgetAmount === 0) return 0;
    return ((item.encumbered + item.actualSpent) / item.budgetAmount) * 100;
  };

  const getAccrualPercentage = (item: BudgetItem) => {
    if (item.budgetAmount === 0) return 0;
    return (item.accruedAmount / item.budgetAmount) * 100;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-[var(--error)]';
    if (percentage >= 80) return 'bg-[var(--warning)]';
    return 'bg-[var(--success)]';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="page-title">Budget Items</h1>
          {canManage && (
            <button
              onClick={openModal}
              className="btn btn-primary"
            >
              + Add Budget Item
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  placeholder="Search by code or description..."
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

        {/* Budget Items List */}
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="card empty-state">
              <p className="empty-state-title">
                {debouncedSearch || departmentFilter
                  ? 'No budget items match your filters'
                  : 'No budget items yet'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const percentage = getPercentageUsed(item);
              const accrualPct = getAccrualPercentage(item);
              return (
                <div
                  key={item.id}
                  className="card hover:border-[var(--border-default)] transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">
                        {item.code} {item.name && `- ${item.name}`}
                      </h3>
                      <p className="text-[var(--text-secondary)] text-sm">
                        {item.description || 'No description'}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {item.department && (
                          <span className="badge badge-info">
                            {item.department.name}
                          </span>
                        )}
                        {item.category && (
                          <span className="inline-block px-2 py-1 bg-[rgba(168,85,247,0.12)] text-[#c084fc] text-xs rounded">
                            {item.category.code}
                          </span>
                        )}
                        <span className={`badge ${
                          item.accrualType === 'ANNUAL' ? 'badge-success' :
                          item.accrualType === 'MONTHLY' ? 'badge-warning' :
                          'badge-warning'
                        }`}>
                          {item.accrualType === 'ANNUAL' ? '📅 Annual' :
                           item.accrualType === 'MONTHLY' ? '📆 Monthly' :
                           '📊 Quarterly'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm text-[var(--text-secondary)]">Total Budget</div>
                      <div className="text-xl font-bold text-[var(--text-primary)]">
                        ${item.budgetAmount.toFixed(2)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        FY {item.fiscalYear}
                      </div>
                    </div>
                  </div>

                  {/* Financial Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                    <div className="bg-[var(--info-subtle)] p-3 rounded">
                      <div className="text-xs text-[var(--info)] font-medium">Accrued</div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        ${item.accruedAmount.toFixed(2)}
                      </div>
                      <div className="text-xs text-[var(--info)]">
                        {accrualPct.toFixed(0)}% of budget
                      </div>
                    </div>
                    <div className="bg-[var(--warning-subtle)] p-3 rounded">
                      <div className="text-xs text-[var(--warning)] font-medium">Encumbered</div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        ${item.encumbered.toFixed(2)}
                      </div>
                      <div className="text-xs text-[var(--warning)]">Approved POs</div>
                    </div>
                    <div className="bg-[var(--error-subtle)] p-3 rounded">
                      <div className="text-xs text-[var(--error)] font-medium">Spent</div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        ${item.actualSpent.toFixed(2)}
                      </div>
                      <div className="text-xs text-[var(--error)]">Completed POs</div>
                    </div>
                    <div className="bg-[var(--success-subtle)] p-3 rounded">
                      <div className="text-xs text-[var(--success)] font-medium">Available</div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        ${item.available.toFixed(2)}
                      </div>
                      <div className="text-xs text-[var(--success)]">From accrued</div>
                    </div>
                    <div className="bg-[var(--bg-surface)] p-3 rounded">
                      <div className="text-xs text-[var(--text-secondary)] font-medium">Remaining</div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        ${item.remaining.toFixed(2)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">Of total budget</div>
                    </div>
                  </div>

                  {/* Usage Progress Bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                      <span>Total Usage (Encumbered + Spent)</span>
                      <span>{percentage.toFixed(1)}% of budget</span>
                    </div>
                    <div className="w-full bg-[var(--bg-surface)] rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getProgressColor(
                          percentage
                        )}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-[var(--text-secondary)]">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
            </span>
            <button
              onClick={() =>
                setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))
              }
              disabled={currentPage === pagination.totalPages}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Summary */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="stat-card">
            <div className="stat-label">Total Budget</div>
            <div className="stat-value">
              $
              {filteredItems
                .reduce((sum, item) => sum + item.budgetAmount, 0)
                .toFixed(2)}
            </div>
          </div>
          <div className="stat-card stat-card-info">
            <div className="stat-label text-[var(--info)]">Total Accrued</div>
            <div className="stat-value text-[var(--info)]">
              $
              {filteredItems
                .reduce((sum, item) => sum + item.accruedAmount, 0)
                .toFixed(2)}
            </div>
          </div>
          <div className="stat-card stat-card-accent">
            <div className="stat-label text-[var(--warning)]">Total Encumbered</div>
            <div className="stat-value text-[var(--warning)]">
              $
              {filteredItems
                .reduce((sum, item) => sum + item.encumbered, 0)
                .toFixed(2)}
            </div>
          </div>
          <div className="stat-card stat-card-error">
            <div className="stat-label text-[var(--error)]">Total Spent</div>
            <div className="stat-value text-[var(--error)]">
              $
              {filteredItems
                .reduce((sum, item) => sum + item.actualSpent, 0)
                .toFixed(2)}
            </div>
          </div>
          <div className="stat-card stat-card-success">
            <div className="stat-label text-[var(--success)]">Total Available</div>
            <div className="stat-value text-[var(--success)]">
              $
              {filteredItems
                .reduce((sum, item) => sum + item.available, 0)
                .toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && canManage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card w-full max-w-lg">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              Add Budget Item
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">
                  Budget Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  required
                  className="form-input"
                  placeholder="e.g., IT-001"
                />
              </div>

              <div>
                <label className="form-label">
                  Description *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  required
                  className="form-input"
                  placeholder="e.g., Hardware & Equipment"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">
                    Budget Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.budgetAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, budgetAmount: e.target.value })
                    }
                    required
                    className="form-input"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="form-label">
                    Fiscal Year
                  </label>
                  <input
                    type="number"
                    value={formData.fiscalYear}
                    onChange={(e) =>
                      setFormData({ ...formData, fiscalYear: e.target.value })
                    }
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">
                    Accrual Type
                  </label>
                  <select
                    value={formData.accrualType}
                    onChange={(e) =>
                      setFormData({ ...formData, accrualType: e.target.value })
                    }
                    className="form-input form-select"
                  >
                    <option value="ANNUAL">Annual - Full budget available immediately</option>
                    <option value="MONTHLY">Monthly - Budget accrues 1/12 per month</option>
                    <option value="QUARTERLY">Quarterly - Budget accrues 1/4 per quarter</option>
                  </select>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Controls how budget becomes available over the fiscal year
                  </p>
                </div>
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
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
