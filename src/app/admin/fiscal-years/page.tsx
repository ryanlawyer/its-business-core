'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface FiscalYear {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED';
  closedAt: string | null;
  closedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  createdAt: string;
}

export default function FiscalYearsPage() {
  const router = useRouter();
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCopyForm, setShowCopyForm] = useState(false);
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    startDate: '',
    endDate: '',
  });
  const [copyData, setCopyData] = useState({
    sourceFiscalYear: new Date().getFullYear() - 1,
    targetFiscalYear: new Date().getFullYear(),
  });

  useEffect(() => {
    fetchFiscalYears();
  }, []);

  const fetchFiscalYears = async () => {
    try {
      const res = await fetch('/api/fiscal-years');
      if (!res.ok) throw new Error('Failed to load fiscal years');
      const data = await res.json();
      setFiscalYears(data.fiscalYears || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/fiscal-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create fiscal year');
      }

      setShowCreateForm(false);
      setFormData({
        year: new Date().getFullYear(),
        startDate: '',
        endDate: '',
      });
      fetchFiscalYears();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (
      !confirm(
        `Are you sure you want to change the status to ${newStatus}? ${
          newStatus === 'HARD_CLOSED'
            ? 'This action cannot be undone.'
            : ''
        }`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/fiscal-years/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update status');
      }

      fetchFiscalYears();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fiscal year?')) {
      return;
    }

    try {
      const res = await fetch(`/api/fiscal-years/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete fiscal year');
      }

      fetchFiscalYears();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'badge badge-success';
      case 'SOFT_CLOSED':
        return 'badge badge-warning';
      case 'HARD_CLOSED':
        return 'badge badge-error';
      default:
        return 'badge badge-neutral';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'Open';
      case 'SOFT_CLOSED':
        return 'Soft Closed';
      case 'HARD_CLOSED':
        return 'Hard Closed';
      default:
        return status;
    }
  };

  const handleCopyYear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/budget-copy-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(copyData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to copy budget year');
      }

      alert(data.message);
      setShowCopyForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (loading) return <div className="p-4 text-[var(--text-secondary)]">Loading fiscal years...</div>;
  if (error) return <div className="p-4 text-[var(--error)]">Error: {error}</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title">Fiscal Year Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCopyForm(true)}
            className="btn btn-success"
          >
            Copy Prior Year Budget
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
          >
            Create Fiscal Year
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="mb-6 card p-4">
          <h2 className="section-title mb-4">Create New Fiscal Year</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="form-label">Year</label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) =>
                  setFormData({ ...formData, year: parseInt(e.target.value) })
                }
                required
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="form-label">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                required
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                required
                className="form-input w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn btn-primary"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showCopyForm && (
        <div className="mb-6 card p-4">
          <h2 className="section-title mb-4">Copy Prior Year Budget</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            This will copy all budget items from the source year to the target year,
            preserving budget amounts and structure but resetting encumbered and actual spent to zero.
          </p>
          <form onSubmit={handleCopyYear} className="space-y-4">
            <div>
              <label className="form-label">
                Source Fiscal Year
              </label>
              <input
                type="number"
                value={copyData.sourceFiscalYear}
                onChange={(e) =>
                  setCopyData({
                    ...copyData,
                    sourceFiscalYear: parseInt(e.target.value),
                  })
                }
                required
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="form-label">
                Target Fiscal Year
              </label>
              <input
                type="number"
                value={copyData.targetFiscalYear}
                onChange={(e) =>
                  setCopyData({
                    ...copyData,
                    targetFiscalYear: parseInt(e.target.value),
                  })
                }
                required
                className="form-input w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn btn-success"
              >
                Copy Budget
              </button>
              <button
                type="button"
                onClick={() => setShowCopyForm(false)}
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
          {fiscalYears.map((fy) => (
            <div key={fy.id} className="card">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">FY {fy.year}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {new Date(fy.startDate).toLocaleDateString()} - {new Date(fy.endDate).toLocaleDateString()}
                  </p>
                </div>
                <span className={getStatusColor(fy.status)}>
                  {getStatusLabel(fy.status)}
                </span>
              </div>
              <div className="space-y-2 text-sm mb-4">
                {fy.closedAt && fy.closedBy && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Closed:</span>
                    <span className="text-[var(--text-primary)]">
                      {new Date(fy.closedAt).toLocaleDateString()} by {fy.closedBy.name || fy.closedBy.email}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-[var(--border-default)] pt-3">
                {fy.status === 'OPEN' && (
                  <button
                    onClick={() => handleStatusChange(fy.id, 'SOFT_CLOSED')}
                    className="btn btn-warning px-3 py-1"
                  >
                    Soft Close
                  </button>
                )}
                {fy.status === 'SOFT_CLOSED' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(fy.id, 'OPEN')}
                      className="btn btn-success px-3 py-1"
                    >
                      Reopen
                    </button>
                    <button
                      onClick={() => handleStatusChange(fy.id, 'HARD_CLOSED')}
                      className="btn btn-danger px-3 py-1"
                    >
                      Hard Close
                    </button>
                  </>
                )}
                {fy.status === 'HARD_CLOSED' && (
                  <span className="text-[var(--text-muted)] italic">Locked</span>
                )}
                {fy.status === 'OPEN' && (
                  <button
                    onClick={() => handleDelete(fy.id)}
                    className="btn btn-danger px-3 py-1"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
          {fiscalYears.length === 0 && (
            <div className="empty-state">
              <p className="empty-state-title">No fiscal years found</p>
              <p className="empty-state-description">Create one to get started.</p>
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block table-container">
          <table className="table" aria-label="Fiscal years">
            <thead>
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Year
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Period
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Closed Info
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {fiscalYears.map((fy) => (
                <tr key={fy.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {fy.year}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(fy.startDate).toLocaleDateString()} -{' '}
                    {new Date(fy.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={getStatusColor(fy.status)}
                    >
                      {getStatusLabel(fy.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-muted)]">
                    {fy.closedAt && fy.closedBy ? (
                      <div>
                        <div>{new Date(fy.closedAt).toLocaleDateString()}</div>
                        <div className="text-xs">
                          by {fy.closedBy.name || fy.closedBy.email}
                        </div>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      {fy.status === 'OPEN' && (
                        <button
                          onClick={() =>
                            handleStatusChange(fy.id, 'SOFT_CLOSED')
                          }
                          className="btn btn-warning px-3 py-1"
                        >
                          Soft Close
                        </button>
                      )}
                      {fy.status === 'SOFT_CLOSED' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(fy.id, 'OPEN')}
                            className="btn btn-success px-3 py-1"
                          >
                            Reopen
                          </button>
                          <button
                            onClick={() =>
                              handleStatusChange(fy.id, 'HARD_CLOSED')
                            }
                            className="btn btn-danger px-3 py-1"
                          >
                            Hard Close
                          </button>
                        </>
                      )}
                      {fy.status === 'HARD_CLOSED' && (
                        <span className="text-[var(--text-muted)] italic">Locked</span>
                      )}
                      {fy.status === 'OPEN' && (
                        <button
                          onClick={() => handleDelete(fy.id)}
                          className="btn btn-danger px-3 py-1"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {fiscalYears.length === 0 && (
          <div className="empty-state">
            <p className="empty-state-title">No fiscal years found</p>
            <p className="empty-state-description">Create one to get started.</p>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--info-muted)] bg-[var(--info-subtle)] text-[var(--info)] px-4 py-3">
        <h3 className="font-semibold mb-2">Fiscal Year Status Workflow:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>
            <strong>Open:</strong> Year is active, budget items and POs can be
            created/modified
          </li>
          <li>
            <strong>Soft Closed:</strong> Year is closed but can be reopened if
            needed
          </li>
          <li>
            <strong>Hard Closed:</strong> Year is permanently closed and cannot
            be reopened
          </li>
        </ul>
      </div>
    </div>
  );
}
