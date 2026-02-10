'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useDebounce } from '@/hooks/useDebounce';

type MatchedReceipt = {
  id: string;
  merchantName: string | null;
  totalAmount: number | null;
  receiptDate: string | null;
  imagePath: string | null;
};

type MatchedPO = {
  id: string;
  poNumber: string;
  totalAmount: number;
  vendor: { name: string } | null;
};

type Transaction = {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  matchedReceiptId: string | null;
  matchedReceipt: MatchedReceipt | null;
  matchedPurchaseOrderId: string | null;
  matchedPurchaseOrder: MatchedPO | null;
  noReceiptRequired: boolean;
};

type Statement = {
  id: string;
  filename: string;
  accountName: string | null;
  uploadDate: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  user: { id: string; name: string | null; email: string };
  transactions: Transaction[];
};

type Summary = {
  totalTransactions: number;
  matchedToReceipt: number;
  matchedToPO: number;
  noReceiptRequired: number;
  unmatched: number;
  totalDebits: number;
  totalCredits: number;
  matchedAmount: number;
  unmatchedAmount: number;
};

type MatchSuggestion = {
  receiptId?: string;
  purchaseOrderId?: string;
  matchScore: number;
  matchReasons: string[];
};

type MatchModalData = {
  transaction: Transaction;
  suggestions: MatchSuggestion[] | null;
};

export default function StatementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();

  const [statement, setStatement] = useState<Statement | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoMatching, setAutoMatching] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm);
  const [matchModal, setMatchModal] = useState<MatchModalData | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [availableReceipts, setAvailableReceipts] = useState<MatchedReceipt[]>([]);
  const [receiptSearchTerm, setReceiptSearchTerm] = useState('');

  const fetchStatement = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/statements/${id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch statement');
      }

      setStatement(data.statement);
      setSummary(data.summary);
    } catch (error) {
      console.error('Error fetching statement:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const handleAutoMatch = async () => {
    if (!confirm('Run auto-matching? This will match transactions with high confidence scores automatically.')) {
      return;
    }

    setAutoMatching(true);
    try {
      const res = await fetch(`/api/statements/${id}/auto-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minConfidence: 70 }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Auto-match failed');
        return;
      }

      alert(`Auto-match complete! ${data.matched} transactions matched, ${data.unmatched} unmatched.`);
      fetchStatement();
    } catch (error) {
      console.error('Error auto-matching:', error);
      alert('Auto-match failed');
    } finally {
      setAutoMatching(false);
    }
  };

  const openMatchModal = async (transaction: Transaction) => {
    setMatchModal({ transaction, suggestions: null });
    setReceiptSearchTerm('');

    // Fetch suggestions
    try {
      const res = await fetch(`/api/statements/${id}/transactions/${transaction.id}`);
      const data = await res.json();
      if (data.suggestions) {
        setMatchModal({ transaction, suggestions: data.suggestions });
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }

    // Fetch available receipts
    try {
      const res = await fetch('/api/receipts?limit=50&status=COMPLETED');
      const data = await res.json();
      setAvailableReceipts(data.receipts || []);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    }
  };

  const handleMatchReceipt = async (transactionId: string, receiptId: string) => {
    setMatchLoading(true);
    try {
      const res = await fetch(`/api/statements/${id}/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'match-receipt', receiptId }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to match');
        return;
      }

      setMatchModal(null);
      fetchStatement();
    } catch (error) {
      console.error('Error matching receipt:', error);
      alert('Failed to match');
    } finally {
      setMatchLoading(false);
    }
  };

  const handleMatchPO = async (transactionId: string, purchaseOrderId: string) => {
    setMatchLoading(true);
    try {
      const res = await fetch(`/api/statements/${id}/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'match-po', purchaseOrderId }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to match');
        return;
      }

      setMatchModal(null);
      fetchStatement();
    } catch (error) {
      console.error('Error matching PO:', error);
      alert('Failed to match');
    } finally {
      setMatchLoading(false);
    }
  };

  const handleUnmatch = async (transactionId: string) => {
    try {
      const res = await fetch(`/api/statements/${id}/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unmatch' }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to unmatch');
        return;
      }

      fetchStatement();
    } catch (error) {
      console.error('Error unmatching:', error);
      alert('Failed to unmatch');
    }
  };

  const handleMarkNoReceipt = async (transactionId: string, noReceiptRequired: boolean) => {
    try {
      const res = await fetch(`/api/statements/${id}/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'no-receipt', noReceiptRequired }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to update');
        return;
      }

      fetchStatement();
    } catch (error) {
      console.error('Error updating:', error);
      alert('Failed to update');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getFilteredTransactions = () => {
    if (!statement) return [];

    return statement.transactions.filter((t) => {
      // Status filter
      if (statusFilter === 'matched') {
        if (!t.matchedReceiptId && !t.matchedPurchaseOrderId) return false;
      } else if (statusFilter === 'unmatched') {
        if (t.matchedReceiptId || t.matchedPurchaseOrderId || t.noReceiptRequired) return false;
      } else if (statusFilter === 'no-receipt') {
        if (!t.noReceiptRequired) return false;
      }

      // Type filter
      if (typeFilter && t.type !== typeFilter) return false;

      // Search filter
      if (debouncedSearch && !t.description.toLowerCase().includes(debouncedSearch.toLowerCase())) {
        return false;
      }

      return true;
    });
  };

  const getMatchStatus = (t: Transaction) => {
    if (t.matchedReceiptId) return { label: 'Matched (Receipt)', color: 'badge badge-success' };
    if (t.matchedPurchaseOrderId) return { label: 'Matched (PO)', color: 'badge badge-success' };
    if (t.noReceiptRequired) return { label: 'No Receipt', color: 'badge badge-neutral' };
    return { label: 'Unmatched', color: 'badge badge-warning' };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--error)]">Statement not found</div>
      </div>
    );
  }

  const filteredTransactions = getFilteredTransactions();
  const reconciliationPercent = summary
    ? Math.round(((summary.matchedToReceipt + summary.matchedToPO + summary.noReceiptRequired) / summary.totalTransactions) * 100)
    : 0;

  return (
    <div className="min-h-screen py-8 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/statements" className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] text-sm mb-2 inline-block">
            &larr; Back to Statements
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="page-title">{statement.filename}</h1>
              <p className="text-[var(--text-secondary)] mt-1">
                {statement.accountName && <span className="mr-4">{statement.accountName}</span>}
                {formatDate(statement.startDate)} - {formatDate(statement.endDate)}
              </p>
            </div>
            <button
              onClick={handleAutoMatch}
              disabled={autoMatching}
              className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {autoMatching ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Auto-Matching...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Auto-Match
                </>
              )}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="stat-card">
              <div className="stat-value">{summary.totalTransactions}</div>
              <div className="stat-label">Total Transactions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-[var(--success)]">{summary.matchedToReceipt + summary.matchedToPO}</div>
              <div className="stat-label">Matched</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-[var(--warning)]">{summary.unmatched}</div>
              <div className="stat-label">Unmatched</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-[var(--info)]">{reconciliationPercent}%</div>
              <div className="stat-label">Reconciled</div>
            </div>
          </div>
        )}

        {/* Reconciliation Progress */}
        {summary && (
          <div className="card p-4 mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Reconciliation Progress</span>
              <span className="text-sm text-[var(--text-secondary)]">{reconciliationPercent}%</span>
            </div>
            <div className="w-full bg-[var(--bg-surface)] rounded-full h-2.5">
              <div
                className="bg-[var(--accent-primary)] h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${reconciliationPercent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-[var(--success)] rounded-full" />
                {summary.matchedToReceipt} receipts
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-[var(--info)] rounded-full" />
                {summary.matchedToPO} POs
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full" />
                {summary.noReceiptRequired} no-receipt
              </span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-input form-select"
          >
            <option value="">All Status</option>
            <option value="matched">Matched</option>
            <option value="unmatched">Unmatched</option>
            <option value="no-receipt">No Receipt Needed</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="form-input form-select"
          >
            <option value="">All Types</option>
            <option value="DEBIT">Debits</option>
            <option value="CREDIT">Credits</option>
          </select>
          <input
            type="text"
            placeholder="Search description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
          />
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-secondary)]">
              No transactions match the current filters.
            </div>
          ) : (
            filteredTransactions.map((transaction) => {
              const matchStatus = getMatchStatus(transaction);
              return (
                <div key={transaction.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{transaction.description}</h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{formatDate(transaction.transactionDate)}</p>
                    </div>
                    <span className={`text-sm font-semibold whitespace-nowrap ${
                      transaction.type === 'DEBIT' ? 'text-[var(--error)]' : 'text-[var(--success)]'
                    }`}>
                      {transaction.type === 'DEBIT' ? '-' : '+'}{formatCurrency(transaction.amount)}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-secondary)]">Type:</span>
                      <span className={`font-medium ${
                        transaction.type === 'DEBIT' ? 'text-[var(--error)]' : 'text-[var(--success)]'
                      }`}>{transaction.type}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-secondary)]">Status:</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${matchStatus.color}`}>
                        {matchStatus.label}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-secondary)]">Matched To:</span>
                      <span className="text-[var(--text-primary)]">
                        {transaction.matchedReceipt && (
                          <Link
                            href={`/receipts/${transaction.matchedReceipt.id}`}
                            className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                          >
                            {transaction.matchedReceipt.merchantName || 'Receipt'}
                          </Link>
                        )}
                        {transaction.matchedPurchaseOrder && (
                          <Link
                            href={`/purchase-orders/${transaction.matchedPurchaseOrder.id}`}
                            className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                          >
                            PO #{transaction.matchedPurchaseOrder.poNumber}
                          </Link>
                        )}
                        {!transaction.matchedReceipt && !transaction.matchedPurchaseOrder && '-'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-default)]">
                    {!transaction.matchedReceiptId && !transaction.matchedPurchaseOrderId && !transaction.noReceiptRequired && (
                      <>
                        <button
                          onClick={() => openMatchModal(transaction)}
                          className="btn btn-primary btn-sm"
                        >
                          Match
                        </button>
                        <button
                          onClick={() => handleMarkNoReceipt(transaction.id, true)}
                          className="btn btn-ghost btn-sm"
                        >
                          No Receipt
                        </button>
                      </>
                    )}
                    {(transaction.matchedReceiptId || transaction.matchedPurchaseOrderId) && (
                      <button
                        onClick={() => handleUnmatch(transaction.id)}
                        className="btn btn-danger btn-sm"
                      >
                        Unmatch
                      </button>
                    )}
                    {transaction.noReceiptRequired && (
                      <button
                        onClick={() => handleMarkNoReceipt(transaction.id, false)}
                        className="btn btn-secondary btn-sm"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block table-container">
          <table className="table">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Matched To
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => {
                const matchStatus = getMatchStatus(transaction);
                return (
                  <tr key={transaction.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {formatDate(transaction.transactionDate)}
                    </td>
                    <td className="px-6 py-4 text-sm max-w-xs truncate">
                      {transaction.description}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      transaction.type === 'DEBIT' ? 'text-[var(--error)]' : 'text-[var(--success)]'
                    }`}>
                      {transaction.type === 'DEBIT' ? '-' : '+'}{formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${matchStatus.color}`}>
                        {matchStatus.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)]">
                      {transaction.matchedReceipt && (
                        <Link
                          href={`/receipts/${transaction.matchedReceipt.id}`}
                          className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                        >
                          {transaction.matchedReceipt.merchantName || 'Receipt'}
                        </Link>
                      )}
                      {transaction.matchedPurchaseOrder && (
                        <Link
                          href={`/purchase-orders/${transaction.matchedPurchaseOrder.id}`}
                          className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                        >
                          PO #{transaction.matchedPurchaseOrder.poNumber}
                        </Link>
                      )}
                      {!transaction.matchedReceipt && !transaction.matchedPurchaseOrder && '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {!transaction.matchedReceiptId && !transaction.matchedPurchaseOrderId && !transaction.noReceiptRequired && (
                          <>
                            <button
                              onClick={() => openMatchModal(transaction)}
                              className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                            >
                              Match
                            </button>
                            <button
                              onClick={() => handleMarkNoReceipt(transaction.id, true)}
                              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            >
                              No Receipt
                            </button>
                          </>
                        )}
                        {(transaction.matchedReceiptId || transaction.matchedPurchaseOrderId) && (
                          <button
                            onClick={() => handleUnmatch(transaction.id)}
                            className="text-[var(--error)] hover:text-[var(--error)]"
                          >
                            Unmatch
                          </button>
                        )}
                        {transaction.noReceiptRequired && (
                          <button
                            onClick={() => handleMarkNoReceipt(transaction.id, false)}
                            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            Undo
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredTransactions.length === 0 && (
            <div className="p-8 text-center text-[var(--text-secondary)]">
              No transactions match the current filters.
            </div>
          )}
        </div>

        {/* Match Modal */}
        {matchModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
              <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setMatchModal(null)} />

              <div className="relative inline-block card text-left overflow-hidden transform transition-all sm:my-8 sm:max-w-2xl sm:w-full">
                <div className="px-4 pt-5 pb-4 sm:p-6">
                  <h3 className="section-title mb-4">
                    Match Transaction
                  </h3>

                  {/* Transaction Info */}
                  <div className="bg-[var(--bg-surface)] rounded-lg p-4 mb-4">
                    <div className="text-sm text-[var(--text-secondary)]">Transaction</div>
                    <div className="font-medium text-[var(--text-primary)]">{matchModal.transaction.description}</div>
                    <div className="text-sm text-[var(--text-secondary)] mt-1">
                      {formatDate(matchModal.transaction.transactionDate)} &bull;{' '}
                      <span className={matchModal.transaction.type === 'DEBIT' ? 'text-[var(--error)]' : 'text-[var(--success)]'}>
                        {formatCurrency(matchModal.transaction.amount)}
                      </span>
                    </div>
                  </div>

                  {/* AI Suggestions */}
                  {matchModal.suggestions && matchModal.suggestions.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">AI Suggestions</h4>
                      <div className="space-y-2">
                        {matchModal.suggestions.slice(0, 5).map((suggestion, idx) => (
                          <div
                            key={idx}
                            className="border border-[var(--border-default)] rounded-lg p-3 hover:bg-[var(--bg-hover)] cursor-pointer"
                            onClick={() => {
                              if (suggestion.receiptId) {
                                handleMatchReceipt(matchModal.transaction.id, suggestion.receiptId);
                              } else if (suggestion.purchaseOrderId) {
                                handleMatchPO(matchModal.transaction.id, suggestion.purchaseOrderId);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium text-[var(--text-primary)]">
                                {suggestion.receiptId ? 'Receipt' : 'Purchase Order'}
                              </div>
                              <div className="text-xs text-[var(--text-secondary)]">
                                Score: {suggestion.matchScore}
                              </div>
                            </div>
                            <div className="text-xs text-[var(--text-secondary)] mt-1">
                              {suggestion.matchReasons.join(' \u2022 ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual Search */}
                  <div>
                    <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Or search receipts</h4>
                    <input
                      type="text"
                      placeholder="Search by merchant name..."
                      value={receiptSearchTerm}
                      onChange={(e) => setReceiptSearchTerm(e.target.value)}
                      className="form-input mb-2"
                    />
                    <div className="max-h-48 overflow-y-auto border border-[var(--border-default)] rounded-lg">
                      {availableReceipts
                        .filter((r) =>
                          receiptSearchTerm
                            ? r.merchantName?.toLowerCase().includes(receiptSearchTerm.toLowerCase())
                            : true
                        )
                        .slice(0, 10)
                        .map((receipt) => (
                          <div
                            key={receipt.id}
                            className="p-2 hover:bg-[var(--bg-hover)] cursor-pointer border-b border-[var(--border-subtle)] last:border-b-0"
                            onClick={() => handleMatchReceipt(matchModal.transaction.id, receipt.id)}
                          >
                            <div className="text-sm font-medium text-[var(--text-primary)]">{receipt.merchantName || 'Unknown'}</div>
                            <div className="text-xs text-[var(--text-secondary)]">
                              {formatDate(receipt.receiptDate)} &bull; {formatCurrency(receipt.totalAmount || 0)}
                            </div>
                          </div>
                        ))}
                      {availableReceipts.length === 0 && (
                        <div className="p-4 text-center text-[var(--text-secondary)] text-sm">No receipts available</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 sm:px-6 flex justify-end border-t border-[var(--border-default)]">
                  <button
                    onClick={() => setMatchModal(null)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
