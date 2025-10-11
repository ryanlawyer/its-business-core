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
        return 'bg-green-100 text-green-800';
      case 'SOFT_CLOSED':
        return 'bg-yellow-100 text-yellow-800';
      case 'HARD_CLOSED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  if (loading) return <div className="p-4">Loading fiscal years...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Fiscal Year Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCopyForm(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Copy Prior Year Budget
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Fiscal Year
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <h2 className="text-lg font-semibold mb-4">Create New Fiscal Year</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Year</label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) =>
                  setFormData({ ...formData, year: parseInt(e.target.value) })
                }
                required
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                required
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                required
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showCopyForm && (
        <div className="mb-6 p-4 border rounded bg-green-50">
          <h2 className="text-lg font-semibold mb-4">Copy Prior Year Budget</h2>
          <p className="text-sm text-gray-600 mb-4">
            This will copy all budget items from the source year to the target year,
            preserving budget amounts and structure but resetting encumbered and actual spent to zero.
          </p>
          <form onSubmit={handleCopyYear} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
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
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
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
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Copy Budget
              </button>
              <button
                type="button"
                onClick={() => setShowCopyForm(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Year
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Period
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Closed Info
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
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
                    className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(
                      fy.status
                    )}`}
                  >
                    {getStatusLabel(fy.status)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                        className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                      >
                        Soft Close
                      </button>
                    )}
                    {fy.status === 'SOFT_CLOSED' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(fy.id, 'OPEN')}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          Reopen
                        </button>
                        <button
                          onClick={() =>
                            handleStatusChange(fy.id, 'HARD_CLOSED')
                          }
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Hard Close
                        </button>
                      </>
                    )}
                    {fy.status === 'HARD_CLOSED' && (
                      <span className="text-gray-400 italic">Locked</span>
                    )}
                    {fy.status === 'OPEN' && (
                      <button
                        onClick={() => handleDelete(fy.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
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
        {fiscalYears.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            No fiscal years found. Create one to get started.
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
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
