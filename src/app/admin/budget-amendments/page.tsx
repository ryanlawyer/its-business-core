'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface BudgetItem {
  id: string;
  code: string;
  description: string | null;
  budgetAmount: number;
  fiscalYear: number;
}

interface Amendment {
  id: string;
  type: string;
  amount: number;
  reason: string;
  fiscalYear: number;
  previousAmount: number;
  newAmount: number;
  createdAt: string;
  budgetItem: { id: string; code: string; description: string | null };
  createdBy: { id: string; name: string; email: string };
  relatedAmendment?: {
    id: string;
    type: string;
    amount: number;
    budgetItem: { code: string; description: string | null };
  };
  fromBudgetItem?: { id: string; code: string; description: string | null };
  toBudgetItem?: { id: string; code: string; description: string | null };
}

export default function BudgetAmendmentsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [amendmentType, setAmendmentType] = useState<'INCREASE' | 'DECREASE' | 'TRANSFER'>('INCREASE');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [typeFilter, setTypeFilter] = useState('');
  const [fiscalYearFilter, setFiscalYearFilter] = useState('');
  const [formData, setFormData] = useState({
    budgetItemId: '',
    amount: '',
    reason: '',
    toBudgetItemId: '',
  });

  useEffect(() => {
    if (!session) return;
    fetchBudgetItems();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchAmendments();
  }, [session, currentPage, typeFilter, fiscalYearFilter]);

  const fetchBudgetItems = async () => {
    try {
      const res = await fetch('/api/budget-items');
      const data = await res.json();
      setBudgetItems(data.items || []);
    } catch (err) {
      console.error('Error fetching budget items:', err);
    }
  };

  const fetchAmendments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
      });

      if (typeFilter) params.append('type', typeFilter);
      if (fiscalYearFilter) params.append('fiscalYear', fiscalYearFilter);

      const res = await fetch(`/api/budget-amendments?${params}`);

      if (!res.ok) {
        throw new Error('Failed to fetch amendments');
      }

      const data = await res.json();
      setAmendments(data.amendments || []);
      setPagination(data.pagination || {});
    } catch (err) {
      console.error('Error fetching amendments:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const payload: any = {
        budgetItemId: formData.budgetItemId,
        amount: parseFloat(formData.amount),
        reason: formData.reason,
      };

      if (amendmentType === 'TRANSFER') {
        payload.type = 'TRANSFER_OUT';
        payload.toBudgetItemId = formData.toBudgetItemId;
      } else {
        payload.type = amendmentType;
      }

      const res = await fetch('/api/budget-amendments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create amendment');
      }

      await fetchAmendments();
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      budgetItemId: '',
      amount: '',
      reason: '',
      toBudgetItemId: '',
    });
    setAmendmentType('INCREASE');
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'INCREASE':
      case 'TRANSFER_IN':
        return 'bg-green-100 text-green-800';
      case 'DECREASE':
      case 'TRANSFER_OUT':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'INCREASE':
      case 'TRANSFER_IN':
        return '↑';
      case 'DECREASE':
      case 'TRANSFER_OUT':
        return '↓';
      default:
        return '•';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Budget Amendments</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          New Amendment
        </button>
      </div>

      {error && !showModal && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amendment Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="INCREASE">Increase</option>
            <option value="DECREASE">Decrease</option>
            <option value="TRANSFER_OUT">Transfer Out</option>
            <option value="TRANSFER_IN">Transfer In</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fiscal Year
          </label>
          <input
            type="number"
            value={fiscalYearFilter}
            onChange={(e) => {
              setFiscalYearFilter(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="e.g., 2025"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-end">
          {!loading && pagination.total > 0 && (
            <p className="text-sm text-gray-600">
              Showing {amendments.length} of {pagination.total} amendments
            </p>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Budget Item
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Previous
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                New
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Reason
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Created By
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {amendments.map((amendment) => (
              <tr key={amendment.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(amendment.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded font-medium ${getTypeColor(amendment.type)}`}>
                    {getTypeIcon(amendment.type)} {amendment.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="font-medium">{amendment.budgetItem.code}</div>
                  <div className="text-xs text-gray-500">{amendment.budgetItem.description}</div>
                  {(amendment.type === 'TRANSFER_OUT' || amendment.type === 'TRANSFER_IN') && (
                    <div className="text-xs text-blue-600 mt-1">
                      {amendment.type === 'TRANSFER_OUT' && amendment.toBudgetItem && (
                        <>→ {amendment.toBudgetItem.code}</>
                      )}
                      {amendment.type === 'TRANSFER_IN' && amendment.fromBudgetItem && (
                        <>← {amendment.fromBudgetItem.code}</>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                  {amendment.type.includes('INCREASE') || amendment.type === 'TRANSFER_IN' ? '+' : '-'}
                  ${amendment.amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${amendment.previousAmount.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                  ${amendment.newAmount.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {amendment.reason}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {amendment.createdBy.name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {amendments.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No budget amendments found. Create one to get started.
          </div>
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
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
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

      {/* Amendment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              New Budget Amendment
            </h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Amendment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amendment Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAmendmentType('INCREASE')}
                    className={`px-4 py-2 rounded border ${
                      amendmentType === 'INCREASE'
                        ? 'bg-green-500 text-white border-green-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Increase
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmendmentType('DECREASE')}
                    className={`px-4 py-2 rounded border ${
                      amendmentType === 'DECREASE'
                        ? 'bg-red-500 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Decrease
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmendmentType('TRANSFER')}
                    className={`px-4 py-2 rounded border ${
                      amendmentType === 'TRANSFER'
                        ? 'bg-blue-500 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Transfer
                  </button>
                </div>
              </div>

              {/* Budget Item */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {amendmentType === 'TRANSFER' ? 'From Budget Item' : 'Budget Item'} *
                </label>
                <select
                  value={formData.budgetItemId}
                  onChange={(e) => setFormData({ ...formData, budgetItemId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select budget item...</option>
                  {budgetItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {item.description} (${item.budgetAmount.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* To Budget Item (only for transfers) */}
              {amendmentType === 'TRANSFER' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Budget Item *
                  </label>
                  <select
                    value={formData.toBudgetItemId}
                    onChange={(e) => setFormData({ ...formData, toBudgetItemId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select destination...</option>
                    {budgetItems
                      .filter((item) => item.id !== formData.budgetItemId)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} - {item.description} (${item.budgetAmount.toFixed(2)})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason *
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Explain the reason for this amendment..."
                  required
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Create Amendment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                    setError('');
                  }}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
