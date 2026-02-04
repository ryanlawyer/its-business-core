'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

type PayPeriod = {
  startDate: string;
  endDate: string;
  label: string;
  type: string;
};

type TimeclockEntry = {
  id: string;
  userId: string;
  clockIn: string;
  clockOut: string | null;
  duration: number | null;
  status: string;
  isLocked: boolean;
  rejectedNote: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    department: {
      id: string;
      name: string;
    } | null;
  };
};

type EmployeeSummary = {
  userId: string;
  userName: string;
  userEmail: string;
  departmentName: string | null;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  entryCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Data
  const [entries, setEntries] = useState<TimeclockEntry[]>([]);
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeSummary | null>(null);
  const [periods, setPeriods] = useState<PayPeriod[]>([]);

  // Selection and editing
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  // Filters
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);

  // Fetch pay periods first
  useEffect(() => {
    fetchPayPeriods();
  }, []);

  const fetchPayPeriods = async () => {
    try {
      const periodsRes = await fetch('/api/timeclock?includePeriods=true');
      const periodsData = await periodsRes.json();

      if (periodsData.availablePeriods) {
        setPeriods(periodsData.availablePeriods);
      }
    } catch (error) {
      console.error('Error fetching pay periods:', error);
    }
  };

  const fetchEmployeeData = useCallback(async () => {
    try {
      setLoading(true);

      const currentPeriod = periods[selectedPeriodIndex];
      if (!currentPeriod) return;

      const params = new URLSearchParams();
      params.set('userId', userId);
      params.set('periodStart', currentPeriod.startDate);
      params.set('periodEnd', currentPeriod.endDate);

      const res = await fetch(`/api/timeclock/team?${params}`);
      const data = await res.json();

      if (res.ok) {
        setEntries(data.entries || []);

        // Find the employee info
        const empInfo = (data.employeeTotals || []).find(
          (e: EmployeeSummary) => e.userId === userId
        );
        setEmployeeInfo(empInfo || null);
      } else if (res.status === 403) {
        router.push('/timeclock/team');
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    } finally {
      setLoading(false);
    }
  }, [periods, selectedPeriodIndex, userId, router]);

  useEffect(() => {
    if (periods.length > 0) {
      fetchEmployeeData();
    }
  }, [periods, selectedPeriodIndex, fetchEmployeeData]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDateTimeInput = (dateString: string) => {
    const date = new Date(dateString);
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    return date.toISOString().slice(0, 16);
  };

  const handleSelectAll = () => {
    const selectableEntries = entries.filter((e) => !e.isLocked && e.clockOut);
    if (selectedIds.size === selectableEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableEntries.map((e) => e.id)));
    }
  };

  const handleSelectEntry = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleStartEdit = (entry: TimeclockEntry) => {
    if (entry.isLocked) return;
    setEditingId(entry.id);
    setEditClockIn(formatDateTimeInput(entry.clockIn));
    setEditClockOut(entry.clockOut ? formatDateTimeInput(entry.clockOut) : '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditClockIn('');
    setEditClockOut('');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/timeclock/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clockIn: new Date(editClockIn).toISOString(),
          clockOut: editClockOut ? new Date(editClockOut).toISOString() : null,
        }),
      });

      if (res.ok) {
        handleCancelEdit();
        await fetchEmployeeData();
      }
    } catch (error) {
      console.error('Error saving entry:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleApproveSelected = async () => {
    if (selectedIds.size === 0) return;

    try {
      setApproving(true);
      const res = await fetch('/api/timeclock/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIds: Array.from(selectedIds) }),
      });

      if (res.ok) {
        setSelectedIds(new Set());
        await fetchEmployeeData();
      }
    } catch (error) {
      console.error('Error approving entries:', error);
    } finally {
      setApproving(false);
    }
  };

  const handleRejectSelected = () => {
    if (selectedIds.size === 0) return;
    setRejectNote('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectNote.trim()) return;

    try {
      setRejecting(true);

      // Reject each entry individually
      for (const id of selectedIds) {
        await fetch(`/api/timeclock/${id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejectedNote: rejectNote.trim() }),
        });
      }

      setShowRejectModal(false);
      setRejectNote('');
      setSelectedIds(new Set());
      await fetchEmployeeData();
    } catch (error) {
      console.error('Error rejecting entries:', error);
    } finally {
      setRejecting(false);
    }
  };

  const getStatusBadge = (status: string, isLocked: boolean) => {
    const config: Record<string, { class: string }> = {
      pending: { class: 'badge badge-warning badge-dot' },
      approved: { class: 'badge badge-success' },
      rejected: { class: 'badge badge-error badge-dot' },
    };

    const style = config[status] || { class: 'badge' };

    return (
      <span className={style.class}>
        {status === 'approved' && isLocked && (
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        )}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const selectableCount = entries.filter((e) => !e.isLocked && e.clockOut).length;

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="page-header animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="page-title font-display">
              {employeeInfo?.userName || 'Employee Details'}
            </h1>
            <p className="page-subtitle">
              {employeeInfo?.userEmail}
              {employeeInfo?.departmentName && ` • ${employeeInfo.departmentName}`}
            </p>
          </div>
          <button
            onClick={() => router.push('/timeclock/team')}
            className="btn btn-secondary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Team
          </button>
        </div>
      </header>

      {/* Period Selector */}
      <div className="card mb-6 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Pay Period
            </label>
            <select
              value={selectedPeriodIndex}
              onChange={(e) => setSelectedPeriodIndex(parseInt(e.target.value))}
              className="input w-full"
              disabled={periods.length === 0}
            >
              {periods.map((period, index) => (
                <option key={index} value={index}>
                  {period.label}
                  {index === 0 ? ' (Current)' : ''}
                </option>
              ))}
            </select>
          </div>
          {employeeInfo && (
            <>
              <div className="text-center px-4">
                <div className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {formatHours(employeeInfo.regularMinutes)}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Regular</div>
              </div>
              <div className="text-center px-4">
                <div className="text-lg font-bold font-mono" style={{ color: employeeInfo.overtimeMinutes > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                  {formatHours(employeeInfo.overtimeMinutes)}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Overtime</div>
              </div>
              <div className="text-center px-4">
                <div className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {formatHours(employeeInfo.totalMinutes)}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="card mb-4 animate-fade-in" style={{ background: 'var(--bg-secondary)' }}>
          <div className="flex flex-wrap items-center gap-4">
            <span style={{ color: 'var(--text-secondary)' }}>
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleApproveSelected}
              disabled={approving}
              className="btn btn-primary btn-sm"
            >
              {approving ? 'Approving...' : 'Approve Selected'}
            </button>
            <button
              onClick={handleRejectSelected}
              disabled={rejecting}
              className="btn btn-secondary btn-sm"
              style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
            >
              Reject Selected
            </button>
          </div>
        </div>
      )}

      {/* Entries Table */}
      <div className="table-container animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-lg font-display font-medium" style={{ color: 'var(--text-primary)' }}>
            Time Entries
          </h2>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {entries.length} entries
          </span>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-5 w-8"></div>
                <div className="skeleton h-5 w-32"></div>
                <div className="skeleton h-5 w-32"></div>
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
              This employee has no time entries for the selected period.
            </div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectableCount > 0 && selectedIds.size === selectableCount}
                    onChange={handleSelectAll}
                    disabled={selectableCount === 0}
                    className="w-4 h-4"
                  />
                </th>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Duration</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <>
                  <tr
                    key={entry.id}
                    className="animate-fade-in"
                    style={{
                      animationDelay: `${150 + index * 30}ms`,
                      background: entry.status === 'rejected' ? 'var(--error-bg, rgba(239, 68, 68, 0.1))' : undefined,
                    }}
                  >
                    <td>
                      {!entry.isLocked && entry.clockOut ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          onChange={() => handleSelectEntry(entry.id)}
                          className="w-4 h-4"
                        />
                      ) : (
                        <span className="w-4 h-4 block"></span>
                      )}
                    </td>
                    <td className="font-mono">
                      {new Date(entry.clockIn).toLocaleDateString()}
                    </td>
                    <td className="font-mono">
                      {new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="font-mono">
                      {entry.clockOut
                        ? new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : <span className="badge badge-warning badge-dot">Active</span>}
                    </td>
                    <td className="font-mono font-medium">
                      {entry.clockOut ? formatDuration(entry.duration) : '—'}
                    </td>
                    <td>
                      {getStatusBadge(entry.status, entry.isLocked)}
                      {entry.status === 'rejected' && entry.rejectedNote && (
                        <div className="mt-1 text-xs" style={{ color: 'var(--error)' }}>
                          {entry.rejectedNote}
                        </div>
                      )}
                    </td>
                    <td>
                      {!entry.isLocked && entry.clockOut && (
                        <button
                          onClick={() => handleStartEdit(entry)}
                          className="btn btn-secondary btn-sm"
                          title="Edit entry"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                      {entry.isLocked && (
                        <span
                          className="inline-flex items-center text-sm"
                          style={{ color: 'var(--text-muted)' }}
                          title="Entry is locked"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                        </span>
                      )}
                    </td>
                  </tr>
                  {editingId === entry.id && (
                    <tr key={`edit-${entry.id}`} style={{ background: 'var(--bg-secondary)' }}>
                      <td colSpan={7}>
                        <div className="p-4 flex flex-wrap items-end gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                              Clock In
                            </label>
                            <input
                              type="datetime-local"
                              value={editClockIn}
                              onChange={(e) => setEditClockIn(e.target.value)}
                              className="input"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                              Clock Out
                            </label>
                            <input
                              type="datetime-local"
                              value={editClockOut}
                              onChange={(e) => setEditClockOut(e.target.value)}
                              className="input"
                            />
                          </div>
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="btn btn-primary btn-sm"
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="btn btn-secondary btn-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="card w-full max-w-md animate-fade-in">
            <h3 className="text-lg font-display font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
              Reject {selectedIds.size} {selectedIds.size === 1 ? 'Entry' : 'Entries'}
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Please provide a reason for rejecting these entries. This will be shown to the employee.
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Enter rejection reason..."
              className="input w-full h-24 resize-none mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={rejecting}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={rejecting || !rejectNote.trim()}
                className="btn"
                style={{ background: 'var(--error)', color: 'white' }}
              >
                {rejecting ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
