'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type PayPeriod = {
  startDate: string;
  endDate: string;
  label: string;
  type: string;
};

type Department = {
  id: string;
  name: string;
};

type TimeclockEntry = {
  id: string;
  userId: string;
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

type MissedPunch = TimeclockEntry & { clockOut: null };

type GroupedEntries = {
  [userId: string]: {
    user: TimeclockEntry['user'];
    entries: TimeclockEntry[];
  };
};

export default function PendingApprovalsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Data
  const [entries, setEntries] = useState<TimeclockEntry[]>([]);
  const [missedPunches, setMissedPunches] = useState<TimeclockEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [periods, setPeriods] = useState<PayPeriod[]>([]);

  // View and selection
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

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

  const fetchPendingEntries = useCallback(async () => {
    try {
      setLoading(true);

      const currentPeriod = periods[selectedPeriodIndex];
      if (!currentPeriod) return;

      const params = new URLSearchParams();
      params.set('periodStart', currentPeriod.startDate);
      params.set('periodEnd', currentPeriod.endDate);
      if (selectedDepartment !== 'all') {
        params.set('departmentId', selectedDepartment);
      }

      const res = await fetch(`/api/timeclock/pending?${params}`);
      const data = await res.json();

      if (res.ok) {
        setEntries(data.entries || []);
        setMissedPunches(data.missedPunches || []);
        setDepartments(data.departments || []);
        setSelectedIds(new Set()); // Clear selection on filter change
      } else if (res.status === 403) {
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching pending entries:', error);
    } finally {
      setLoading(false);
    }
  }, [periods, selectedPeriodIndex, selectedDepartment, router]);

  useEffect(() => {
    if (periods.length > 0) {
      fetchPendingEntries();
    }
  }, [periods, selectedPeriodIndex, selectedDepartment, fetchPendingEntries]);

  // Group entries by user
  const groupedEntries: GroupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.userId]) {
      acc[entry.userId] = {
        user: entry.user,
        entries: [],
      };
    }
    acc[entry.userId].entries.push(entry);
    return acc;
  }, {} as GroupedEntries);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getElapsedHours = (clockIn: string) => {
    const now = new Date();
    const start = new Date(clockIn);
    const diffMs = now.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours.toFixed(1);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
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

  const handleSelectEmployee = (userId: string) => {
    const employeeEntryIds = entries.filter((e) => e.userId === userId).map((e) => e.id);
    const allSelected = employeeEntryIds.every((id) => selectedIds.has(id));

    const newSelected = new Set(selectedIds);
    if (allSelected) {
      employeeEntryIds.forEach((id) => newSelected.delete(id));
    } else {
      employeeEntryIds.forEach((id) => newSelected.add(id));
    }
    setSelectedIds(newSelected);
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
        await fetchPendingEntries();
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
      await fetchPendingEntries();
    } catch (error) {
      console.error('Error rejecting entries:', error);
    } finally {
      setRejecting(false);
    }
  };

  const renderEntryBadges = (entry: TimeclockEntry) => {
    const badges: React.ReactNode[] = [];

    if (entry.flagReason === 'min_duration') {
      badges.push(
        <span
          key="min-duration"
          className="badge text-xs"
          style={{ background: 'var(--warning)', color: 'white' }}
        >
          Min Duration
        </span>
      );
    }

    if (entry.flagReason === 'missed_punch') {
      badges.push(
        <span
          key="missed-punch"
          className="badge text-xs"
          style={{ background: 'var(--error)', color: 'white' }}
        >
          Missed Punch
        </span>
      );
    }

    if (entry.breakDeducted && entry.breakDeducted > 0) {
      badges.push(
        <span
          key="break"
          className="badge text-xs"
          style={{ background: 'var(--info)', color: 'white' }}
        >
          Break: {Math.round(entry.breakDeducted / 60)}m
        </span>
      );
    }

    if (entry.autoApproved) {
      badges.push(
        <span
          key="auto-approved"
          className="badge text-xs"
          style={{ background: 'var(--success)', color: 'white' }}
        >
          Auto-approved
        </span>
      );
    }

    if (badges.length === 0) return null;

    return <span className="inline-flex gap-1 ml-2">{badges}</span>;
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="page-header animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="page-title">
              Pending Approvals
              {entries.length > 0 && (
                <span
                  className="ml-2 px-2 py-1 text-lg rounded-full"
                  style={{ background: 'var(--warning)', color: 'white' }}
                >
                  {entries.length}
                </span>
              )}
            </h1>
            <p className="page-subtitle">Review and approve team time entries</p>
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

      {/* Filters */}
      <div className="card mb-6 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <div className="flex flex-col md:flex-row gap-4">
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
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="input w-full"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              View Mode
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grouped')}
                className={`btn btn-sm flex-1 ${viewMode === 'grouped' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Grouped
              </button>
              <button
                onClick={() => setViewMode('flat')}
                className={`btn btn-sm flex-1 ${viewMode === 'flat' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Flat List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Needs Attention - Missed Punches */}
      {missedPunches.length > 0 && (
        <div
          className="card mb-6 animate-fade-in-up"
          style={{
            animationDelay: '75ms',
            borderColor: 'var(--error)',
            borderWidth: '1px',
            borderStyle: 'solid',
            background: 'var(--error-bg, rgba(239, 68, 68, 0.1))',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
              style={{ color: 'var(--error)' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <h2 className="section-title" style={{ color: 'var(--error)', margin: 0 }}>
              Needs Attention
            </h2>
            <span
              className="badge text-xs"
              style={{ background: 'var(--error)', color: 'white' }}
            >
              {missedPunches.length}
            </span>
          </div>
          <div className="space-y-3">
            {missedPunches.map((punch) => (
              <div
                key={punch.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg"
                style={{ background: 'var(--bg-primary, rgba(255, 255, 255, 0.5))' }}
              >
                <div className="flex-1">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {punch.user.name}
                  </span>
                  <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {punch.user.department?.name || 'No Department'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                    Clocked in: {new Date(punch.clockIn).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span
                    className="badge text-xs"
                    style={{ background: 'var(--error)', color: 'white' }}
                  >
                    {getElapsedHours(punch.clockIn)}h elapsed
                  </span>
                  <button
                    onClick={() => console.log('Edit missed punch:', punch.id)}
                    className="btn btn-sm btn-secondary"
                    style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              {approving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Approving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Approve Selected
                </>
              )}
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

      {/* Entries */}
      <div className="table-container animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="section-title">
            Entries Awaiting Approval
          </h2>
          {entries.length > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={selectedIds.size === entries.length}
                onChange={handleSelectAll}
                className="w-4 h-4"
              />
              Select All
            </label>
          )}
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-5 w-8"></div>
                <div className="skeleton h-5 w-40"></div>
                <div className="skeleton h-5 w-32"></div>
                <div className="skeleton h-5 w-20"></div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div className="empty-state-title">All caught up!</div>
            <div className="empty-state-description">
              No pending entries for the selected period and department.
            </div>
          </div>
        ) : viewMode === 'grouped' ? (
          // Grouped by employee view
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {Object.entries(groupedEntries).map(([userId, group], groupIndex) => {
              const employeeEntryIds = group.entries.map((e) => e.id);
              const allSelected = employeeEntryIds.every((id) => selectedIds.has(id));
              const someSelected = employeeEntryIds.some((id) => selectedIds.has(id));

              return (
                <div
                  key={userId}
                  className="p-4 animate-fade-in"
                  style={{ animationDelay: `${150 + groupIndex * 50}ms` }}
                >
                  <div className="flex items-center gap-4 mb-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate = someSelected && !allSelected;
                        }
                      }}
                      onChange={() => handleSelectEmployee(userId)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {group.user.name}
                      </span>
                      <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {group.user.department?.name || 'No Department'}
                      </span>
                    </div>
                    <span className="badge badge-warning badge-dot">
                      {group.entries.length} pending
                    </span>
                  </div>
                  <div className="ml-8 space-y-2">
                    {group.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-4 p-2 rounded"
                        style={{ background: 'var(--bg-secondary)' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          onChange={() => handleSelectEntry(entry.id)}
                          className="w-4 h-4"
                        />
                        <span className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {new Date(entry.clockIn).toLocaleDateString()}
                        </span>
                        <span className="font-mono text-sm">
                          {new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' — '}
                          {entry.clockOut
                            ? new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </span>
                        <span className="font-mono text-sm font-medium">
                          {formatDuration(entry.duration)}
                        </span>
                        {renderEntryBadges(entry)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Flat list view
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4 p-4">
              {entries.map((entry, index) => (
                <div
                  key={entry.id}
                  className="card animate-fade-in"
                  style={{ animationDelay: `${150 + index * 30}ms` }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => handleSelectEntry(entry.id)}
                        className="w-4 h-4"
                      />
                      <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">{entry.user.name}</h3>
                        <p className="text-sm text-[var(--text-muted)]">{entry.user.email}</p>
                      </div>
                    </div>
                    <span className="badge badge-warning">Pending</span>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Department:</span>
                      <span className="text-[var(--text-primary)]">{entry.user.department?.name || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Date:</span>
                      <span className="text-[var(--text-primary)] font-mono">{new Date(entry.clockIn).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Time:</span>
                      <span className="text-[var(--text-primary)] font-mono">
                        {new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' — '}
                        {entry.clockOut
                          ? new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-secondary)]">Duration:</span>
                      <span className="text-[var(--text-primary)] font-mono font-medium inline-flex items-center">
                        {formatDuration(entry.duration)}
                        {renderEntryBadges(entry)}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-[var(--border-default)] pt-3 flex justify-end gap-2">
                    <button
                      onClick={handleApproveSelected}
                      disabled={approving || !selectedIds.has(entry.id)}
                      className="btn btn-primary btn-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={handleRejectSelected}
                      disabled={rejecting || !selectedIds.has(entry.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block">
              <table className="table" aria-label="Time clock approvals">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.size === entries.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4"
                      />
                    </th>
                    <th scope="col">Employee</th>
                    <th scope="col">Department</th>
                    <th scope="col">Date</th>
                    <th scope="col">Time</th>
                    <th scope="col">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr
                      key={entry.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${150 + index * 30}ms` }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          onChange={() => handleSelectEntry(entry.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td>
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {entry.user.name}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {entry.user.email}
                        </div>
                      </td>
                      <td>{entry.user.department?.name || '—'}</td>
                      <td className="font-mono">
                        {new Date(entry.clockIn).toLocaleDateString()}
                      </td>
                      <td className="font-mono">
                        {new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' — '}
                        {entry.clockOut
                          ? new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="font-mono font-medium">
                        <span className="inline-flex items-center">
                          {formatDuration(entry.duration)}
                          {renderEntryBadges(entry)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="card w-full max-w-md animate-fade-in">
            <h3 className="section-title mb-4">
              Reject {selectedIds.size} {selectedIds.size === 1 ? 'Entry' : 'Entries'}
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Please provide a reason for rejecting these entries. This will be shown to the employees.
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
