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

type EmployeeSummary = {
  userId: string;
  userName: string;
  userEmail: string;
  departmentId: string | null;
  departmentName: string | null;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  entryCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  hasOvertime: boolean;
  dailyOvertimeMinutes: number;
  weeklyOvertimeMinutes: number;
};

type TimeclockEntry = {
  id: string;
  userId: string;
  clockIn: string;
  clockOut: string | null;
  status: string;
  user: {
    id: string;
    name: string;
    department: {
      id: string;
      name: string;
    } | null;
  };
};

export default function TeamOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  // Data
  const [employeeTotals, setEmployeeTotals] = useState<EmployeeSummary[]>([]);
  const [pendingEntryIds, setPendingEntryIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [periods, setPeriods] = useState<PayPeriod[]>([]);

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);

  // Summary totals
  const [summary, setSummary] = useState({
    totalEmployees: 0,
    totalApproved: 0,
    totalPending: 0,
    totalRejected: 0,
  });

  // Fetch pay period config first
  useEffect(() => {
    fetchPayPeriods();
  }, []);

  const fetchPayPeriods = async () => {
    try {
      // Fetch pay period config
      const res = await fetch('/api/timeclock/config');
      const data = await res.json();

      // Get periods from API which calculates based on config
      const periodsRes = await fetch('/api/timeclock?includePeriods=true');
      const periodsData = await periodsRes.json();

      if (periodsData.availablePeriods) {
        setPeriods(periodsData.availablePeriods);
      }
    } catch (error) {
      console.error('Error fetching pay periods:', error);
    }
  };

  const fetchTeamData = useCallback(async () => {
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

      const res = await fetch(`/api/timeclock/team?${params}`);
      const data = await res.json();

      if (res.ok) {
        setEmployeeTotals(data.employeeTotals || []);
        setDepartments(data.accessibleDepartments || []);

        // Extract pending entry IDs
        const pendingIds = (data.entries || [])
          .filter((e: TimeclockEntry) => e.status === 'pending' && e.clockOut)
          .map((e: TimeclockEntry) => e.id);
        setPendingEntryIds(pendingIds);

        // Calculate summary
        const totals = (data.employeeTotals || []).reduce(
          (acc: typeof summary, emp: EmployeeSummary) => ({
            totalEmployees: acc.totalEmployees + 1,
            totalApproved: acc.totalApproved + emp.approvedCount,
            totalPending: acc.totalPending + emp.pendingCount,
            totalRejected: acc.totalRejected + emp.rejectedCount,
          }),
          { totalEmployees: 0, totalApproved: 0, totalPending: 0, totalRejected: 0 }
        );
        setSummary(totals);
      } else if (res.status === 403) {
        // User doesn't have permission
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  }, [periods, selectedPeriodIndex, selectedDepartment, router]);

  useEffect(() => {
    if (periods.length > 0) {
      fetchTeamData();
    }
  }, [periods, selectedPeriodIndex, selectedDepartment, fetchTeamData]);

  const handleApproveAll = async () => {
    if (pendingEntryIds.length === 0) return;

    try {
      setApproving(true);
      const res = await fetch('/api/timeclock/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIds: pendingEntryIds }),
      });

      if (res.ok) {
        // Refresh data
        await fetchTeamData();
      }
    } catch (error) {
      console.error('Error approving entries:', error);
    } finally {
      setApproving(false);
    }
  };

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="page-header animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Team Overview</h1>
            <p className="page-subtitle">View and manage team time entries</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/timeclock/approvals')}
              className="btn btn-secondary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Pending Approvals
              {summary.totalPending > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full" style={{ background: 'var(--warning)', color: 'white' }}>
                  {summary.totalPending}
                </span>
              )}
            </button>
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
          <div className="flex items-end">
            <button
              onClick={handleApproveAll}
              disabled={approving || pendingEntryIds.length === 0}
              className="btn btn-primary"
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
                  Approve All Pending
                  {pendingEntryIds.length > 0 && (
                    <span className="ml-1">({pendingEntryIds.length})</span>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>
            {summary.totalEmployees}
          </div>
          <div className="stat-label">Total Employees</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {summary.totalApproved}
          </div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {summary.totalPending}
          </div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--error)' }}>
            {summary.totalRejected}
          </div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="table-container animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="section-title">
            Employees
          </h2>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-5 w-40"></div>
                <div className="skeleton h-5 w-32"></div>
                <div className="skeleton h-5 w-20"></div>
                <div className="skeleton h-5 w-20"></div>
                <div className="skeleton h-5 w-24"></div>
              </div>
            ))}
          </div>
        ) : employeeTotals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="empty-state-title">No team members found</div>
            <div className="empty-state-description">
              No employees have time entries for this period.
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4 p-4">
              {employeeTotals.map((employee, index) => (
                <div
                  key={employee.userId}
                  className="card cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${200 + index * 30}ms` }}
                  onClick={() => router.push(`/timeclock/team/${employee.userId}`)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">{employee.userName}</h3>
                        {employee.hasOvertime && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--warning)', color: 'white' }}
                            title={`OT: ${formatHours(employee.overtimeMinutes)}`}
                          >
                            OT
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">{employee.userEmail}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Department:</span>
                      <span className="text-[var(--text-primary)]">{employee.departmentName || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Regular Hours:</span>
                      <span className="text-[var(--text-primary)] font-mono">{formatHours(employee.regularMinutes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">OT Hours:</span>
                      <span className="font-mono">
                        {employee.overtimeMinutes > 0 ? (
                          <span style={{ color: 'var(--warning)' }}>
                            {formatHours(employee.overtimeMinutes)}
                          </span>
                        ) : (
                          <span className="text-[var(--text-primary)]">—</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {employee.approvedCount > 0 && (
                      <span className="badge badge-success">
                        {employee.approvedCount} approved
                      </span>
                    )}
                    {employee.pendingCount > 0 && (
                      <span className="badge badge-warning badge-dot">
                        {employee.pendingCount} pending
                      </span>
                    )}
                    {employee.rejectedCount > 0 && (
                      <span className="badge badge-error badge-dot">
                        {employee.rejectedCount} rejected
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block">
              <table className="table" aria-label="Team time clock summary">
                <thead>
                  <tr>
                    <th scope="col">Employee</th>
                    <th scope="col">Department</th>
                    <th scope="col">Regular Hours</th>
                    <th scope="col">OT Hours</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeTotals.map((employee, index) => (
                    <tr
                      key={employee.userId}
                      className="cursor-pointer hover:bg-[var(--bg-secondary)] animate-fade-in"
                      style={{ animationDelay: `${200 + index * 30}ms` }}
                      onClick={() => router.push(`/timeclock/team/${employee.userId}`)}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {employee.userName}
                          </span>
                          {employee.hasOvertime && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--warning)', color: 'white' }}
                              title={`OT: ${formatHours(employee.overtimeMinutes)}`}
                            >
                              OT
                            </span>
                          )}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {employee.userEmail}
                        </div>
                      </td>
                      <td>{employee.departmentName || '—'}</td>
                      <td className="font-mono">{formatHours(employee.regularMinutes)}</td>
                      <td className="font-mono">
                        {employee.overtimeMinutes > 0 ? (
                          <span style={{ color: 'var(--warning)' }}>
                            {formatHours(employee.overtimeMinutes)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {employee.approvedCount > 0 && (
                            <span className="badge badge-success">
                              {employee.approvedCount} approved
                            </span>
                          )}
                          {employee.pendingCount > 0 && (
                            <span className="badge badge-warning badge-dot">
                              {employee.pendingCount} pending
                            </span>
                          )}
                          {employee.rejectedCount > 0 && (
                            <span className="badge badge-error badge-dot">
                              {employee.rejectedCount} rejected
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
