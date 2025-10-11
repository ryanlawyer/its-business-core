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

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const actionColors: Record<string, string> = {
  USER_CREATED: 'bg-green-100 text-green-800',
  USER_UPDATED: 'bg-blue-100 text-blue-800',
  USER_DELETED: 'bg-red-100 text-red-800',
  PO_CREATED: 'bg-green-100 text-green-800',
  PO_APPROVED: 'bg-green-100 text-green-800',
  PO_REJECTED: 'bg-red-100 text-red-800',
  PO_VOIDED: 'bg-red-100 text-red-800',
  PO_COMPLETED: 'bg-blue-100 text-blue-800',
  LOGIN_SUCCESS: 'bg-green-100 text-green-800',
  LOGIN_FAILED: 'bg-red-100 text-red-800',
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

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterEntityId, setFilterEntityId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, filterAction, filterEntityType, filterEntityId, filterStartDate, filterEndDate]);

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
    const params = new URLSearchParams();
    if (filterAction) params.append('action', filterAction);
    if (filterEntityType) params.append('entityType', filterEntityType);
    if (filterEntityId) params.append('entityId', filterEntityId);
    if (filterStartDate) params.append('startDate', filterStartDate);
    if (filterEndDate) params.append('endDate', filterEndDate);

    window.location.href = `/api/audit-log/export?${params}`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionColor = (action: string) => {
    return actionColors[action] || 'bg-gray-100 text-gray-800';
  };

  const formatActionName = (action: string) => {
    return action.replace(/_/g, ' ');
  };

  if (loading && logs.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-gray-600">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Audit Log</h1>
            <p className="text-gray-600">System activity and change history</p>
          </div>
          <button
            onClick={handleExport}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={filterAction}
                onChange={(e) => {
                  setFilterAction(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
              <select
                value={filterEntityType}
                onChange={(e) => {
                  setFilterEntityType(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Entity ID</label>
              <input
                type="text"
                value={filterEntityId}
                onChange={(e) => {
                  setFilterEntityId(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                placeholder="Filter by ID..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => {
                  setFilterStartDate(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => {
                  setFilterEndDate(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No audit logs found matching your filters
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Timestamp</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Entity</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">User</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">IP Address</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-t hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                            {formatActionName(log.action)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          <div>{log.entityType}</div>
                          {log.entityId && (
                            <div className="text-xs text-gray-500 font-mono">{log.entityId.substring(0, 8)}...</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {log.user ? (
                            <div>
                              <div>{log.user.name}</div>
                              <div className="text-xs text-gray-500">{log.user.email}</div>
                            </div>
                          ) : (
                            <span className="text-gray-500 italic">System</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 font-mono">
                          {log.ipAddress || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <button
                            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {expandedLog === log.id ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Expanded Row */}
                    {expandedLog && logs.find((l) => l.id === expandedLog) && (
                      <tr className="bg-gray-50 border-t">
                        <td colSpan={6} className="py-4 px-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-900">Changes:</h4>
                            <pre className="bg-white p-4 rounded border text-xs overflow-auto max-h-96">
                              {JSON.stringify(logs.find((l) => l.id === expandedLog)?.changes, null, 2)}
                            </pre>
                            {logs.find((l) => l.id === expandedLog)?.userAgent && (
                              <div className="text-sm text-gray-600">
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
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
                <div className="text-sm text-gray-700">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-700">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
