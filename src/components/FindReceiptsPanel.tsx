'use client';

import { useState, useEffect, useCallback } from 'react';

type ReceiptSuggestion = {
  receipt: {
    id: string;
    merchantName: string | null;
    totalAmount: number | null;
    receiptDate: string | null;
    thumbnailUrl: string | null;
    status: string;
    currency: string;
  };
  matchScore: number;
  matchReasons: string[];
};

type UnlinkedReceipt = {
  id: string;
  merchantName: string | null;
  totalAmount: number | null;
  receiptDate: string | null;
  thumbnailUrl: string | null;
  status: string;
  currency: string;
};

interface FindReceiptsPanelProps {
  poId: string;
  isOpen: boolean;
  onClose: () => void;
  onLinked: () => void;
}

export default function FindReceiptsPanel({
  poId,
  isOpen,
  onClose,
  onLinked,
}: FindReceiptsPanelProps) {
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<ReceiptSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [allReceipts, setAllReceipts] = useState<UnlinkedReceipt[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [linking, setLinking] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const fetchSuggestions = useCallback(async () => {
    try {
      setLoadingSuggestions(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const res = await fetch(
        `/api/purchase-orders/${poId}/suggest-receipts?${params}`
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [poId, search]);

  const fetchAllUnlinked = useCallback(async () => {
    try {
      setLoadingAll(true);
      const params = new URLSearchParams({
        unlinked: 'true',
        page: page.toString(),
        limit: '10',
      });
      if (search) params.append('search', search);
      const res = await fetch(`/api/receipts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAllReceipts(data.receipts || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching unlinked receipts:', err);
    } finally {
      setLoadingAll(false);
    }
  }, [search, page]);

  useEffect(() => {
    if (isOpen) {
      fetchSuggestions();
      fetchAllUnlinked();
    }
  }, [isOpen, fetchSuggestions, fetchAllUnlinked]);

  const handleAttach = async (receiptId: string) => {
    try {
      setLinking(receiptId);
      const res = await fetch(`/api/receipts/${receiptId}/link-po`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseOrderId: poId }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to link receipt');
        return;
      }

      // Clear note state
      setNoteFor(null);
      setNote('');

      // Refresh lists and notify parent
      fetchSuggestions();
      fetchAllUnlinked();
      onLinked();
    } catch (err) {
      console.error('Error attaching receipt:', err);
      alert('Failed to attach receipt');
    } finally {
      setLinking(null);
    }
  };

  const formatAmount = (amount: number | null, currency: string = 'USD') => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'No date';
    return new Date(date).toLocaleDateString();
  };

  if (!isOpen) return null;

  const renderReceiptRow = (
    receipt: {
      id: string;
      merchantName: string | null;
      totalAmount: number | null;
      receiptDate: string | null;
      thumbnailUrl: string | null;
      status: string;
      currency?: string;
    },
    score?: number,
    reasons?: string[]
  ) => (
    <div
      key={receipt.id}
      className="border border-[var(--border-default)] rounded-lg p-4 hover:border-[var(--accent-primary)] transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {receipt.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/receipts/${receipt.id}/image?thumbnail=true`}
              alt="Receipt thumbnail"
              className="w-12 h-12 object-cover rounded flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 bg-[var(--bg-tertiary)] rounded flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 text-[var(--text-muted)]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                />
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium text-[var(--text-primary)] truncate">
              {receipt.merchantName || 'Untitled Receipt'}
            </div>
            <div className="text-sm text-[var(--text-muted)]">
              {formatDate(receipt.receiptDate)} &bull;{' '}
              {formatAmount(receipt.totalAmount, receipt.currency)}
            </div>
            {score !== undefined && reasons && reasons.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    score >= 60
                      ? 'badge badge-success'
                      : score >= 40
                      ? 'badge badge-warning'
                      : 'badge badge-neutral'
                  }`}
                >
                  {score}% match
                </span>
                {reasons.map((reason, idx) => (
                  <span key={idx} className="badge badge-info text-xs">
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <button
            onClick={() => handleAttach(receipt.id)}
            disabled={linking === receipt.id}
            className="btn btn-primary btn-sm disabled:opacity-50"
          >
            {linking === receipt.id ? 'Attaching...' : 'Attach'}
          </button>
          <button
            onClick={() =>
              setNoteFor(noteFor === receipt.id ? null : receipt.id)
            }
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            {noteFor === receipt.id ? 'Hide note' : 'Add note'}
          </button>
        </div>
      </div>
      {noteFor === receipt.id && (
        <div className="mt-3 pt-3 border-t border-[var(--border-default)]">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note about this attachment..."
            rows={2}
            className="form-input text-sm"
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-default)] flex justify-between items-center flex-shrink-0">
          <h3 className="section-title">Find & Attach Receipts</h3>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[var(--border-default)] flex-shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by merchant name..."
            className="form-input w-full"
          />
        </div>

        {/* Scrollable body */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Suggested Matches */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Suggested Matches
            </h4>
            {loadingSuggestions ? (
              <div className="text-center py-4">
                <svg
                  className="w-6 h-6 mx-auto animate-spin text-[var(--accent-primary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-2">
                No suggested matches found.
              </p>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s) =>
                  renderReceiptRow(
                    s.receipt,
                    s.matchScore,
                    s.matchReasons
                  )
                )}
              </div>
            )}
          </div>

          {/* All Unlinked Receipts */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              All Unlinked Receipts
            </h4>
            {loadingAll ? (
              <div className="text-center py-4">
                <svg
                  className="w-6 h-6 mx-auto animate-spin text-[var(--accent-primary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            ) : allReceipts.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-2">
                No unlinked receipts found.
              </p>
            ) : (
              <>
                <div className="space-y-3">
                  {allReceipts.map((r) => renderReceiptRow(r))}
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-4">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="btn btn-secondary btn-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-[var(--text-secondary)]">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="btn btn-secondary btn-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-default)] flex-shrink-0">
          <button onClick={onClose} className="btn btn-secondary w-full">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
