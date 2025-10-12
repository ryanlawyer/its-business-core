'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { permissions } from '@/lib/permissions';

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
  }, [currentPage, departmentFilter]);

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

      if (searchTerm) params.append('search', searchTerm);
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
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Budget Items</h1>
          {canManage && (
            <button
              onClick={openModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              + Add Budget Item
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by code or description..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Search
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
              {searchTerm || departmentFilter
                ? 'No budget items match your filters'
                : 'No budget items yet'}
            </div>
          ) : (
            filteredItems.map((item) => {
              const percentage = getPercentageUsed(item);
              const accrualPct = getAccrualPercentage(item);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">
                        {item.code} {item.name && `- ${item.name}`}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {item.description || 'No description'}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {item.department && (
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {item.department.name}
                          </span>
                        )}
                        {item.category && (
                          <span className="inline-block px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                            {item.category.code}
                          </span>
                        )}
                        <span className={`inline-block px-2 py-1 text-xs rounded font-medium ${
                          item.accrualType === 'ANNUAL' ? 'bg-green-100 text-green-800' :
                          item.accrualType === 'MONTHLY' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.accrualType === 'ANNUAL' ? '📅 Annual' :
                           item.accrualType === 'MONTHLY' ? '📆 Monthly' :
                           '📊 Quarterly'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm text-gray-600">Total Budget</div>
                      <div className="text-xl font-bold text-gray-900">
                        ${item.budgetAmount.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        FY {item.fiscalYear}
                      </div>
                    </div>
                  </div>

                  {/* Financial Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                    <div className="bg-blue-50 p-3 rounded">
                      <div className="text-xs text-blue-600 font-medium">Accrued</div>
                      <div className="text-sm font-bold text-blue-900">
                        ${item.accruedAmount.toFixed(2)}
                      </div>
                      <div className="text-xs text-blue-500">
                        {accrualPct.toFixed(0)}% of budget
                      </div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded">
                      <div className="text-xs text-yellow-600 font-medium">Encumbered</div>
                      <div className="text-sm font-bold text-yellow-900">
                        ${item.encumbered.toFixed(2)}
                      </div>
                      <div className="text-xs text-yellow-500">Approved POs</div>
                    </div>
                    <div className="bg-red-50 p-3 rounded">
                      <div className="text-xs text-red-600 font-medium">Spent</div>
                      <div className="text-sm font-bold text-red-900">
                        ${item.actualSpent.toFixed(2)}
                      </div>
                      <div className="text-xs text-red-500">Completed POs</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded">
                      <div className="text-xs text-green-600 font-medium">Available</div>
                      <div className="text-sm font-bold text-green-900">
                        ${item.available.toFixed(2)}
                      </div>
                      <div className="text-xs text-green-500">From accrued</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-xs text-gray-600 font-medium">Remaining</div>
                      <div className="text-sm font-bold text-gray-900">
                        ${item.remaining.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">Of total budget</div>
                    </div>
                  </div>

                  {/* Usage Progress Bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Total Usage (Encumbered + Spent)</span>
                      <span>{percentage.toFixed(1)}% of budget</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
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
              className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
            </span>
            <button
              onClick={() =>
                setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))
              }
              disabled={currentPage === pagination.totalPages}
              className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}

        {/* Summary */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Budget</div>
            <div className="text-2xl font-bold text-gray-900">
              $
              {filteredItems
                .reduce((sum, item) => sum + item.budgetAmount, 0)
                .toFixed(2)}
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4">
            <div className="text-sm text-blue-600 font-medium">Total Accrued</div>
            <div className="text-2xl font-bold text-blue-900">
              $
              {filteredItems
                .reduce((sum, item) => sum + item.accruedAmount, 0)
                .toFixed(2)}
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-4">
            <div className="text-sm text-yellow-600 font-medium">Total Encumbered</div>
            <div className="text-2xl font-bold text-yellow-900">
              $
              {filteredItems
                .reduce((sum, item) => sum + item.encumbered, 0)
                .toFixed(2)}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-4">
            <div className="text-sm text-red-600 font-medium">Total Spent</div>
            <div className="text-2xl font-bold text-red-900">
              $
              {filteredItems
                .reduce((sum, item) => sum + item.actualSpent, 0)
                .toFixed(2)}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4">
            <div className="text-sm text-green-600 font-medium">Total Available</div>
            <div className="text-2xl font-bold text-green-900">
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
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Add Budget Item
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Budget Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., IT-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Hardware & Equipment"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fiscal Year
                  </label>
                  <input
                    type="number"
                    value={formData.fiscalYear}
                    onChange={(e) =>
                      setFormData({ ...formData, fiscalYear: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accrual Type
                  </label>
                  <select
                    value={formData.accrualType}
                    onChange={(e) =>
                      setFormData({ ...formData, accrualType: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ANNUAL">Annual - Full budget available immediately</option>
                    <option value="MONTHLY">Monthly - Budget accrues 1/12 per month</option>
                    <option value="QUARTERLY">Quarterly - Budget accrues 1/4 per quarter</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Controls how budget becomes available over the fiscal year
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) =>
                    setFormData({ ...formData, departmentId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
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
