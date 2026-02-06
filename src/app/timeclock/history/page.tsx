'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type TimeclockEntry = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  duration: number | null;
  rawDuration: number | null;
  breakDeducted: number | null;
  autoApproved: boolean;
  flagReason: string | null;
  status: string;
  isLocked: boolean;
  rejectedNote: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type Summary = {
  totalMinutes: number;
  statusCounts: {
    pending: number;
    approved: number;
    rejected: number;
  };
};

const DATE_PRESETS = [
  { value: '', label: 'All Time' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function TimeclockHistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<TimeclockEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [preset, setPreset] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchHistory();
  }, [preset, status, page]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (preset) params.set('preset', preset);
      if (status !== 'all') params.set('status', status);

      const res = await fetch(`/api/timeclock/history?${params}`);
      const data = await res.json();

      if (res.ok) {
        setEntries(data.entries || []);
        setPagination(data.pagination || null);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (preset) params.set('preset', preset);
      if (status !== 'all') params.set('status', status);

      const res = await fetch(`/api/timeclock/history/export?${params}`);

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timeclock-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting:', error);
    } finally {
      setExporting(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string, isLocked: boolean, autoApproved?: boolean) => {
    const config: Record<string, { class: string }> = {
      pending: { class: 'badge badge-warning badge-dot' },
      submitted: { class: 'badge badge-accent badge-dot' },
      approved: { class: 'badge badge-success' },
      rejected: { class: 'badge badge-error badge-dot' },
    };

    const style = config[status] || { class: 'badge' };

    return (
      <span className="inline-flex items-center gap-1">
        <span className={style.class}>
          {status === 'approved' && isLocked && (
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          )}
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        {autoApproved && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--success-subtle, rgba(34, 197, 94, 0.1))', color: 'var(--success)' }}>
            Auto
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="page-header animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Time History</h1>
            <p className="page-subtitle">View and export your complete timeclock history</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="btn btn-secondary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Timeclock
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="card mb-6 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Date Range
            </label>
            <select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                setPage(1);
              }}
              className="input w-full"
            >
              {DATE_PRESETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="input w-full"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExport}
              disabled={exporting || entries.length === 0}
              className="btn btn-secondary"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--text-primary)' }}>
              {formatMinutes(summary.totalMinutes)}
            </div>
            <div className="stat-label">Total Time</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--warning)' }}>
              {summary.statusCounts.pending}
            </div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {summary.statusCounts.approved}
            </div>
            <div className="stat-label">Approved</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--error)' }}>
              {summary.statusCounts.rejected}
            </div>
            <div className="stat-label">Rejected</div>
          </div>
        </div>
      )}

      {/* Entries Table */}
      <div className="table-container animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="section-title">
            Time Entries
          </h2>
          {pagination && (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Showing {((pagination.page - 1) * pagination.limit) + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount}
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-5 w-40"></div>
                <div className="skeleton h-5 w-40"></div>
                <div className="skeleton h-5 w-20"></div>
                <div className="skeleton h-5 w-20"></div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="empty-state-title">No entries found</div>
            <div className="empty-state-description">
              Try adjusting your filters or date range.
            </div>
          </div>
        ) : (
          <>
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4 p-4">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className="card animate-fade-in"
                style={{
                  animationDelay: `${200 + index * 30}ms`,
                  background: entry.status === 'rejected' ? 'var(--error-bg, rgba(239, 68, 68, 0.1))' : undefined,
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold text-[var(--text-primary)] font-mono">
                    {new Date(entry.clockIn).toLocaleDateString()}
                  </h3>
                  {getStatusBadge(entry.status, entry.isLocked, entry.autoApproved)}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Clock In:</span>
                    <span className="text-[var(--text-primary)] font-mono">
                      {new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Clock Out:</span>
                    <span className="text-[var(--text-primary)] font-mono">
                      {entry.clockOut
                        ? new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Duration:</span>
                    <span className="text-[var(--text-primary)] font-mono font-medium">
                      {entry.clockOut ? formatDuration(entry.duration) : '—'}
                    </span>
                  </div>
                  {entry.breakDeducted && entry.breakDeducted > 0 && (
                    <div className="text-xs" style={{ color: 'var(--info)' }}>
                      {Math.round(entry.breakDeducted / 60)}m break deducted
                    </div>
                  )}
                  {entry.rawDuration !== null && entry.duration !== null && entry.rawDuration !== entry.duration && !entry.breakDeducted && (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Rounded from {formatDuration(entry.rawDuration)}
                    </div>
                  )}
                </div>
                {entry.status === 'rejected' && entry.rejectedNote && (
                  <div className="mt-3 pt-3 border-t border-[var(--border-default)] text-xs" style={{ color: 'var(--error)' }}>
                    <span className="font-medium">Note:</span> {entry.rejectedNote}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className="animate-fade-in"
                    style={{
                      animationDelay: `${200 + index * 30}ms`,
                      background: entry.status === 'rejected' ? 'var(--error-bg, rgba(239, 68, 68, 0.1))' : undefined,
                    }}
                  >
                    <td className="font-mono">
                      {new Date(entry.clockIn).toLocaleDateString()}
                    </td>
                    <td className="font-mono">
                      {new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="font-mono">
                      {entry.clockOut
                        ? new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="font-mono font-medium">
                      <div>
                        {entry.clockOut ? formatDuration(entry.duration) : '—'}
                        {entry.breakDeducted && entry.breakDeducted > 0 && (
                          <div className="text-xs font-normal" style={{ color: 'var(--info)' }}>
                            -{Math.round(entry.breakDeducted / 60)}m break
                          </div>
                        )}
                        {entry.rawDuration !== null && entry.duration !== null && entry.rawDuration !== entry.duration && !entry.breakDeducted && (
                          <div className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                            Rounded from {formatDuration(entry.rawDuration)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {getStatusBadge(entry.status, entry.isLocked, entry.autoApproved)}
                      {entry.status === 'rejected' && entry.rejectedNote && (
                        <div className="mt-1 text-xs" style={{ color: 'var(--error)' }}>
                          <span className="font-medium">Note:</span> {entry.rejectedNote}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-4 border-t flex justify-between items-center" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrevPage}
              className="btn btn-secondary btn-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={!pagination.hasNextPage}
              className="btn btn-secondary btn-sm"
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
