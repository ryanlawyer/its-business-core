'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import ReceiptUpload from '@/components/receipts/ReceiptUpload';
import ReceiptCard from '@/components/receipts/ReceiptCard';
import { useDebounce } from '@/hooks/useDebounce';

type Receipt = {
  id: string;
  merchantName: string | null;
  receiptDate: string | null;
  totalAmount: number | null;
  currency: string;
  status: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  vendor: { id: string; name: string } | null;
  budgetCategory: { id: string; name: string } | null;
  user: { id: string; name: string | null } | null;
  createdAt: string;
  _count?: { lineItems: number };
};

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REVIEWED', label: 'Reviewed' },
];

export default function ReceiptsPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm);
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });

      if (statusFilter) params.append('status', statusFilter);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await fetch(`/api/receipts?${params}`);
      const data = await res.json();
      setReceipts(data.receipts || []);
      setPagination(data.pagination || {});
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchReceipts();
  };

  const handleUploadComplete = () => {
    // Refresh the receipts list
    fetchReceipts();
    // Keep the upload dialog open for more uploads
  };

  const calculateTotals = () => {
    const pending = receipts.filter((r) => r.status === 'PENDING').length;
    const processing = receipts.filter((r) => r.status === 'PROCESSING').length;
    const completed = receipts.filter((r) => ['COMPLETED', 'REVIEWED'].includes(r.status)).length;
    const totalAmount = receipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    return { pending, processing, completed, totalAmount };
  };

  const totals = calculateTotals();

  if (loading && receipts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="page-title">Receipts</h1>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="btn btn-primary flex items-center"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Upload Receipt
          </button>
        </div>

        {/* Upload Section */}
        {showUpload && (
          <div className="card p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="section-title">Upload Receipt</h2>
              <button
                onClick={() => setShowUpload(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ReceiptUpload onUploadComplete={handleUploadComplete} />
          </div>
        )}

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
                  placeholder="Search by merchant name..."
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
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="form-input form-select"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Receipt Grid */}
        {receipts.length === 0 ? (
          <div className="card p-12">
            <div className="empty-state">
              <svg
                className="empty-state-icon"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                />
              </svg>
              <p className="empty-state-title">
                {searchTerm || statusFilter
                  ? 'No receipts match your filters'
                  : 'No receipts yet'}
              </p>
              <p className="empty-state-description">
                Upload your first receipt to get started
              </p>
              {!showUpload && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="btn btn-primary mt-4"
                >
                  Upload Receipt
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {receipts.map((receipt) => (
              <ReceiptCard key={receipt.id} receipt={receipt} />
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="stat-label">Total Receipts</div>
            <div className="stat-value">
              {pagination.total || 0}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending/Processing</div>
            <div className="stat-value text-[var(--warning)]">
              {totals.pending + totals.processing}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed</div>
            <div className="stat-value text-[var(--success)]">
              {totals.completed}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Amount (This Page)</div>
            <div className="stat-value">
              ${totals.totalAmount.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
