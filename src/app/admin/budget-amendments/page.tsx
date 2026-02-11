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
        return 'badge-success';
      case 'DECREASE':
      case 'TRANSFER_OUT':
        return 'badge-error';
      default:
        return 'badge-neutral';
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
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title">Budget Amendments</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary"
        >
          New Amendment
        </button>
      </div>

      {error && !showModal && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--error-muted)] bg-[var(--error-subtle)] text-[var(--error)] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="form-label">
            Amendment Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="form-input form-select"
          >
            <option value="">All Types</option>
            <option value="INCREASE">Increase</option>
            <option value="DECREASE">Decrease</option>
            <option value="TRANSFER_OUT">Transfer Out</option>
            <option value="TRANSFER_IN">Transfer In</option>
          </select>
        </div>
        <div>
          <label className="form-label">
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
            className="form-input"
          />
        </div>
        <div className="flex items-end">
          {!loading && pagination.total > 0 && (
            <p className="text-sm text-[var(--text-secondary)]">
              Showing {amendments.length} of {pagination.total} amendments
            </p>
          )}
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {amendments.map((amendment) => (
          <div key={amendment.id} className="card">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">{amendment.budgetItem.code}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{amendment.budgetItem.description}</p>
                {(amendment.type === 'TRANSFER_OUT' || amendment.type === 'TRANSFER_IN') && (
                  <p className="text-xs text-[var(--accent-primary)] mt-1">
                    {amendment.type === 'TRANSFER_OUT' && amendment.toBudgetItem && (
                      <>&rarr; {amendment.toBudgetItem.code}</>
                    )}
                    {amendment.type === 'TRANSFER_IN' && amendment.fromBudgetItem && (
                      <>&larr; {amendment.fromBudgetItem.code}</>
                    )}
                  </p>
                )}
              </div>
              <span className={`badge ${getTypeColor(amendment.type)}`}>
                {getTypeIcon(amendment.type)} {amendment.type.replace('_', ' ')}
              </span>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Amount:</span>
                <span className="text-[var(--text-primary)] font-bold">
                  {amendment.type.includes('INCREASE') || amendment.type === 'TRANSFER_IN' ? '+' : '-'}
                  ${amendment.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Previous:</span>
                <span className="text-[var(--text-muted)]">${amendment.previousAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">New:</span>
                <span className="text-[var(--text-primary)] font-medium">${amendment.newAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Date:</span>
                <span className="text-[var(--text-primary)]">{new Date(amendment.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Created By:</span>
                <span className="text-[var(--text-primary)]">{amendment.createdBy.name}</span>
              </div>
              {amendment.reason && (
                <div className="border-t border-[var(--border-default)] pt-2">
                  <span className="text-[var(--text-secondary)]">Reason:</span>
                  <p className="text-[var(--text-primary)] mt-1">{amendment.reason}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {amendments.length === 0 && (
          <div className="empty-state">
            <p className="empty-state-title">No budget amendments found.</p>
            <p className="empty-state-description">Create one to get started.</p>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block table-container">
        <table className="table" aria-label="Budget amendments">
          <thead>
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                Date
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                Budget Item
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                Amount
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                Previous
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                New
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                Reason
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">
                Created By
              </th>
            </tr>
          </thead>
          <tbody>
            {amendments.map((amendment) => (
              <tr key={amendment.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {new Date(amendment.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`badge ${getTypeColor(amendment.type)}`}>
                    {getTypeIcon(amendment.type)} {amendment.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="font-medium">{amendment.budgetItem.code}</div>
                  <div className="text-xs text-[var(--text-muted)]">{amendment.budgetItem.description}</div>
                  {(amendment.type === 'TRANSFER_OUT' || amendment.type === 'TRANSFER_IN') && (
                    <div className="text-xs text-[var(--accent-primary)] mt-1">
                      {amendment.type === 'TRANSFER_OUT' && amendment.toBudgetItem && (
                        <>&rarr; {amendment.toBudgetItem.code}</>
                      )}
                      {amendment.type === 'TRANSFER_IN' && amendment.fromBudgetItem && (
                        <>&larr; {amendment.fromBudgetItem.code}</>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                  {amendment.type.includes('INCREASE') || amendment.type === 'TRANSFER_IN' ? '+' : '-'}
                  ${amendment.amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-muted)]">
                  ${amendment.previousAmount.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  ${amendment.newAmount.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                  {amendment.reason}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-muted)]">
                  {amendment.createdBy.name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {amendments.length === 0 && (
          <div className="empty-state">
            <p className="empty-state-title">No budget amendments found.</p>
            <p className="empty-state-description">Create one to get started.</p>
          </div>
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
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
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

      {/* Amendment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card w-full max-w-lg">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              New Budget Amendment
            </h2>

            {error && (
              <div className="rounded-[var(--radius-lg)] border border-[var(--error-muted)] bg-[var(--error-subtle)] text-[var(--error)] px-4 py-3 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Amendment Type */}
              <div>
                <label className="form-label">
                  Amendment Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAmendmentType('INCREASE')}
                    className={`px-4 py-2 rounded border transition-colors ${
                      amendmentType === 'INCREASE'
                        ? 'bg-[var(--success)] text-[var(--bg-void)] border-[var(--success)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    Increase
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmendmentType('DECREASE')}
                    className={`px-4 py-2 rounded border transition-colors ${
                      amendmentType === 'DECREASE'
                        ? 'bg-[var(--error)] text-[var(--bg-void)] border-[var(--error)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    Decrease
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmendmentType('TRANSFER')}
                    className={`px-4 py-2 rounded border transition-colors ${
                      amendmentType === 'TRANSFER'
                        ? 'bg-[var(--info)] text-[var(--bg-void)] border-[var(--info)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    Transfer
                  </button>
                </div>
              </div>

              {/* Budget Item */}
              <div>
                <label className="form-label">
                  {amendmentType === 'TRANSFER' ? 'From Budget Item' : 'Budget Item'} *
                </label>
                <select
                  value={formData.budgetItemId}
                  onChange={(e) => setFormData({ ...formData, budgetItemId: e.target.value })}
                  className="form-input form-select"
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
                  <label className="form-label">
                    To Budget Item *
                  </label>
                  <select
                    value={formData.toBudgetItemId}
                    onChange={(e) => setFormData({ ...formData, toBudgetItemId: e.target.value })}
                    className="form-input form-select"
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
                <label className="form-label">
                  Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="form-input"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Reason */}
              <div>
                <label className="form-label">
                  Reason *
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="form-input"
                  rows={3}
                  placeholder="Explain the reason for this amendment..."
                  required
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="btn btn-primary"
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
                  className="btn btn-secondary"
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
