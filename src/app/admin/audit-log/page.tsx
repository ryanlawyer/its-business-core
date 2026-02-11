'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type UserOption = {
  id: string;
  name: string;
  email: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const actionColors: Record<string, string> = {
  USER_CREATED: 'badge badge-success',
  USER_UPDATED: 'badge badge-info',
  USER_DELETED: 'badge badge-error',
  PO_CREATED: 'badge badge-success',
  PO_APPROVED: 'badge badge-success',
  PO_REJECTED: 'badge badge-error',
  PO_VOIDED: 'badge badge-error',
  PO_COMPLETED: 'badge badge-info',
  LOGIN_SUCCESS: 'badge badge-success',
  LOGIN_FAILED: 'badge badge-error',
};

export default function AuditLogPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Users list for dropdown
  const [users, setUsers] = useState<UserOption[]>([]);

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterEntityId, setFilterEntityId] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const hasActiveFilters =
    filterAction !== '' ||
    filterEntityType !== '' ||
    filterEntityId !== '' ||
    filterUserId !== '' ||
    filterStartDate !== '' ||
    filterEndDate !== '';

  const clearAllFilters = () => {
    setFilterAction('');
    setFilterEntityType('');
    setFilterEntityId('');
    setFilterUserId('');
    setFilterStartDate('');
    setFilterEndDate('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Fetch users for the dropdown on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users?limit=500');
        const data = await res.json();
        if (res.ok && data.users) {
          setUsers(
            data.users.map((u: UserOption) => ({ id: u.id, name: u.name, email: u.email }))
          );
        }
      } catch (error) {
        console.error('Error fetching users for filter:', error);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, filterAction, filterEntityType, filterEntityId, filterUserId, filterStartDate, filterEndDate]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filterAction) params.append('action', filterAction);
      if (filterEntityType) params.append('entityType', filterEntityType);
      if (filterEntityId) params.append('entityId', filterEntityId);
      if (filterUserId) params.append('userId', filterUserId);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);

      const res = await fetch(`/api/audit-log?${params}`);
      const data = await res.json();

      if (res.ok) {
        setLogs(data.logs || []);
        setPagination(data.pagination || pagination);
      } else {
        console.error('Failed to fetch audit logs:', data.error);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filterAction) params.append('action', filterAction);
      if (filterEntityType) params.append('entityType', filterEntityType);
      if (filterEntityId) params.append('entityId', filterEntityId);
      if (filterUserId) params.append('userId', filterUserId);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);

      const res = await fetch(`/api/audit-log/export?${params}`);
      if (!res.ok) {
        console.error('Export failed:', res.statusText);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting audit logs:', error);
    } finally {
      setExporting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionColor = (action: string) => {
    return actionColors[action] || 'badge badge-neutral';
  };

  const formatActionName = (action: string) => {
    return action.replace(/_/g, ' ');
  };

  if (loading && logs.length === 0) {
    return (
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-[var(--text-secondary)]">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="page-title mb-2">Audit Log</h1>
            <p className="text-[var(--text-secondary)]">System activity and change history</p>
          </div>
          <button
            onClick={handleExport}
            disabled={logs.length === 0 || exporting}
            className="btn btn-success flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>

        {/* Filters */}
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Filters</h2>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="btn btn-secondary text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear All Filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="form-label">User</label>
              <select
                value={filterUserId}
                onChange={(e) => {
                  setFilterUserId(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                className="form-input form-select w-full"
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Action</label>
              <select
                value={filterAction}
                onChange={(e) => {
                  setFilterAction(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                className="form-input form-select w-full"
              >
                <option value="">All Actions</option>
                <option value="USER_CREATED">User Created</option>
                <option value="USER_UPDATED">User Updated</option>
                <option value="PO_CREATED">PO Created</option>
                <option value="PO_APPROVED">PO Approved</option>
                <option value="PO_REJECTED">PO Rejected</option>
                <option value="PO_VOIDED">PO Voided</option>
                <option value="LOGIN_SUCCESS">Login Success</option>
                <option value="LOGIN_FAILED">Login Failed</option>
              </select>
            </div>

            <div>
              <label className="form-label">Entity Type</label>
              <select
                value={filterEntityType}
                onChange={(e) => {
                  setFilterEntityType(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                className="form-input form-select w-full"
              >
                <option value="">All Types</option>
                <option value="User">User</option>
                <option value="PurchaseOrder">Purchase Order</option>
                <option value="Role">Role</option>
                <option value="Department">Department</option>
                <option value="BudgetItem">Budget Item</option>
                <option value="Auth">Authentication</option>
              </select>
            </div>

            <div>
              <label className="form-label">Entity ID</label>
              <input
                type="text"
                value={filterEntityId}
                onChange={(e) => {
                  setFilterEntityId(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                placeholder="Filter by ID..."
                className="form-input w-full"
              />
            </div>

            <div>
              <label className="form-label">Start Date</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => {
                  setFilterStartDate(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                className="form-input w-full"
              />
            </div>

            <div>
              <label className="form-label">End Date</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => {
                  setFilterEndDate(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                className="form-input w-full"
              />
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="card overflow-hidden">
          {logs.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">No audit logs found matching your filters</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4 p-4">
                {logs.map((log) => (
                  <div key={log.id} className="card">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className={getActionColor(log.action)}>
                          {formatActionName(log.action)}
                        </span>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">{log.entityType}</p>
                        {log.entityId && (
                          <p className="text-xs text-[var(--text-muted)] font-mono">{log.entityId.substring(0, 8)}...</p>
                        )}
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">{formatDateTime(log.createdAt)}</span>
                    </div>
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">User:</span>
                        <span className="text-[var(--text-primary)]">
                          {log.user ? log.user.name : <span className="italic text-[var(--text-muted)]">System</span>}
                        </span>
                      </div>
                      {log.user && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Email:</span>
                          <span className="text-[var(--text-primary)]">{log.user.email}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">IP Address:</span>
                        <span className="text-[var(--text-primary)] font-mono">{log.ipAddress || '-'}</span>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-[var(--border-default)]">
                      <button
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] text-sm"
                      >
                        {expandedLog === log.id ? 'Hide Details' : 'View Details'}
                      </button>
                      {expandedLog === log.id && (
                        <div className="mt-3 space-y-2">
                          <h4 className="font-semibold text-[var(--text-primary)] text-sm">Changes:</h4>
                          <pre className="card p-3 text-xs overflow-auto max-h-64">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                          {log.userAgent && (
                            <div className="text-xs text-[var(--text-secondary)]">
                              <strong>User Agent:</strong> {log.userAgent}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block table-container">
                <table className="table" aria-label="Audit log entries">
                  <thead>
                    <tr>
                      <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">Timestamp</th>
                      <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">Action</th>
                      <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">Entity</th>
                      <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">User</th>
                      <th scope="col" className="text-left py-3 px-4 text-sm font-semibold">IP Address</th>
                      <th scope="col" className="text-right py-3 px-4 text-sm font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-3 px-4 text-sm">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className={getActionColor(log.action)}>
                            {formatActionName(log.action)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <div>{log.entityType}</div>
                          {log.entityId && (
                            <div className="text-xs text-[var(--text-muted)] font-mono">{log.entityId.substring(0, 8)}...</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {log.user ? (
                            <div>
                              <div>{log.user.name}</div>
                              <div className="text-xs text-[var(--text-muted)]">{log.user.email}</div>
                            </div>
                          ) : (
                            <span className="text-[var(--text-muted)] italic">System</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--text-secondary)] font-mono">
                          {log.ipAddress || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <button
                            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                            className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                          >
                            {expandedLog === log.id ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Expanded Row */}
                    {expandedLog && logs.find((l) => l.id === expandedLog) && (
                      <tr>
                        <td colSpan={6} className="py-4 px-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-[var(--text-primary)]">Changes:</h4>
                            <pre className="card p-4 text-xs overflow-auto max-h-96">
                              {JSON.stringify(logs.find((l) => l.id === expandedLog)?.changes, null, 2)}
                            </pre>
                            {logs.find((l) => l.id === expandedLog)?.userAgent && (
                              <div className="text-sm text-[var(--text-secondary)]">
                                <strong>User Agent:</strong>{' '}
                                {logs.find((l) => l.id === expandedLog)?.userAgent}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 flex items-center justify-between border-t border-[var(--border-subtle)]">
                <div className="text-sm text-[var(--text-secondary)]">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="btn btn-secondary"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-[var(--text-secondary)]">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page >= pagination.totalPages}
                    className="btn btn-secondary"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
