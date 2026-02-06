'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useDebounce } from '@/hooks/useDebounce';

type PurchaseOrder = {
  id: string;
  poNumber: string;
  poDate: string;
  vendor: {
    name: string;
    vendorNumber: string;
  };
  status: string;
  totalAmount: number;
  department: string | null;
};

const statusColors: Record<string, string> = {
  DRAFT: 'badge badge-neutral',
  PENDING_APPROVAL: 'badge badge-warning',
  APPROVED: 'badge badge-success',
  COMPLETED: 'badge badge-info',
  CANCELLED: 'badge badge-error',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function PurchaseOrdersPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm);
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    fetchOrders();
  }, [currentPage, statusFilter, debouncedSearch]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
      });

      if (statusFilter) params.append('status', statusFilter);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await fetch(`/api/purchase-orders?${params}`);
      const data = await res.json();
      setOrders(data.orders || []);
      setPagination(data.pagination || {});
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchOrders();
  };

  const filteredOrders = orders;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="page-header flex justify-between items-center mb-8">
          <h1 className="page-title">Purchase Orders</h1>
          <Link
            href="/purchase-orders/new"
            className="btn btn-primary"
          >
            + New Purchase Order
          </Link>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Search
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by PO number or vendor..."
                  className="form-input flex-1"
                />
                <button
                  onClick={handleSearch}
                  className="btn btn-primary"
                >
                  Search
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-input form-select"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="card overflow-hidden">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">
              {debouncedSearch || statusFilter
                ? 'No purchase orders match your filters'
                : 'No purchase orders yet'}
            </div>
          ) : (
            <>
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4 p-4">
              {filteredOrders.map((order) => (
                <Link key={order.id} href={`/purchase-orders/${order.id}`} className="block">
                  <div className="card">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--accent-primary)]">{order.poNumber}</h3>
                        <p className="text-sm text-[var(--text-secondary)]">{order.vendor.name}</p>
                      </div>
                      <span className={statusColors[order.status]}>
                        {statusLabels[order.status]}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Date:</span>
                        <span className="text-[var(--text-primary)]">{new Date(order.poDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Department:</span>
                        <span className="text-[var(--text-primary)]">{order.department || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Amount:</span>
                        <span className="text-[var(--text-primary)] font-medium">${order.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="border-t border-[var(--border-default)] pt-3 flex justify-end">
                      <span className="text-[var(--accent-primary)] text-sm font-medium">View Details →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th className="text-left py-3 px-4">
                      PO Number
                    </th>
                    <th className="text-left py-3 px-4">
                      Date
                    </th>
                    <th className="text-left py-3 px-4">
                      Vendor
                    </th>
                    <th className="text-left py-3 px-4">
                      Department
                    </th>
                    <th className="text-left py-3 px-4">
                      Status
                    </th>
                    <th className="text-right py-3 px-4">
                      Amount
                    </th>
                    <th className="text-right py-3 px-4">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="py-3 px-4 text-sm font-medium text-[var(--accent-primary)]">
                        <Link href={`/purchase-orders/${order.id}`}>
                          {order.poNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--text-primary)]">
                        {new Date(order.poDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--text-primary)]">
                        {order.vendor.name}
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">
                        {order.department || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={statusColors[order.status]}
                        >
                          {statusLabels[order.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--text-primary)] text-right">
                        ${order.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        <Link
                          href={`/purchase-orders/${order.id}`}
                          className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="btn btn-secondary btn-sm"
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
              className="btn btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        )}

        {/* Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="stat-label">Total Orders</div>
            <div className="stat-value">
              {pagination.total || 0}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Amount</div>
            <div className="stat-value">
              $
              {filteredOrders
                .reduce((sum, order) => sum + order.totalAmount, 0)
                .toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Approval</div>
            <div className="stat-value text-[var(--warning)]">
              {
                filteredOrders.filter((o) => o.status === 'PENDING_APPROVAL')
                  .length
              }
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed</div>
            <div className="stat-value text-[var(--success)]">
              {filteredOrders.filter((o) => o.status === 'COMPLETED').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
