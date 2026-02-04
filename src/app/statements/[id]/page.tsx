'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';

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
      if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      return true;
    });
  };

  const getMatchStatus = (t: Transaction) => {
    if (t.matchedReceiptId) return { label: 'Matched (Receipt)', color: 'bg-green-100 text-green-800' };
    if (t.matchedPurchaseOrderId) return { label: 'Matched (PO)', color: 'bg-green-100 text-green-800' };
    if (t.noReceiptRequired) return { label: 'No Receipt', color: 'bg-gray-100 text-gray-800' };
    return { label: 'Unmatched', color: 'bg-yellow-100 text-yellow-800' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Statement not found</div>
      </div>
    );
  }

  const filteredTransactions = getFilteredTransactions();
  const reconciliationPercent = summary
    ? Math.round(((summary.matchedToReceipt + summary.matchedToPO + summary.noReceiptRequired) / summary.totalTransactions) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/statements" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
            &larr; Back to Statements
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{statement.filename}</h1>
              <p className="text-gray-600 mt-1">
                {statement.accountName && <span className="mr-4">{statement.accountName}</span>}
                {formatDate(statement.startDate)} - {formatDate(statement.endDate)}
              </p>
            </div>
            <button
              onClick={handleAutoMatch}
              disabled={autoMatching}
              className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{summary.totalTransactions}</div>
              <div className="text-sm text-gray-500">Total Transactions</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-green-600">{summary.matchedToReceipt + summary.matchedToPO}</div>
              <div className="text-sm text-gray-500">Matched</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-yellow-600">{summary.unmatched}</div>
              <div className="text-sm text-gray-500">Unmatched</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-blue-600">{reconciliationPercent}%</div>
              <div className="text-sm text-gray-500">Reconciled</div>
            </div>
          </div>
        )}

        {/* Reconciliation Progress */}
        {summary && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Reconciliation Progress</span>
              <span className="text-sm text-gray-500">{reconciliationPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${reconciliationPercent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                {summary.matchedToReceipt} receipts
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                {summary.matchedToPO} POs
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full" />
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
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="matched">Matched</option>
            <option value="unmatched">Unmatched</option>
            <option value="no-receipt">No Receipt Needed</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Matched To
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => {
                const matchStatus = getMatchStatus(transaction);
                return (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.transactionDate)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {transaction.description}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      transaction.type === 'DEBIT' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {transaction.type === 'DEBIT' ? '-' : '+'}{formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${matchStatus.color}`}>
                        {matchStatus.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.matchedReceipt && (
                        <Link
                          href={`/receipts/${transaction.matchedReceipt.id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {transaction.matchedReceipt.merchantName || 'Receipt'}
                        </Link>
                      )}
                      {transaction.matchedPurchaseOrder && (
                        <Link
                          href={`/purchase-orders/${transaction.matchedPurchaseOrder.id}`}
                          className="text-blue-600 hover:text-blue-800"
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
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Match
                            </button>
                            <button
                              onClick={() => handleMarkNoReceipt(transaction.id, true)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              No Receipt
                            </button>
                          </>
                        )}
                        {(transaction.matchedReceiptId || transaction.matchedPurchaseOrderId) && (
                          <button
                            onClick={() => handleUnmatch(transaction.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Unmatch
                          </button>
                        )}
                        {transaction.noReceiptRequired && (
                          <button
                            onClick={() => handleMarkNoReceipt(transaction.id, false)}
                            className="text-gray-600 hover:text-gray-900"
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
            <div className="p-8 text-center text-gray-500">
              No transactions match the current filters.
            </div>
          )}
        </div>

        {/* Match Modal */}
        {matchModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setMatchModal(null)} />

              <div className="relative inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Match Transaction
                  </h3>

                  {/* Transaction Info */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="text-sm text-gray-500">Transaction</div>
                    <div className="font-medium">{matchModal.transaction.description}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {formatDate(matchModal.transaction.transactionDate)} &bull;{' '}
                      <span className={matchModal.transaction.type === 'DEBIT' ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(matchModal.transaction.amount)}
                      </span>
                    </div>
                  </div>

                  {/* AI Suggestions */}
                  {matchModal.suggestions && matchModal.suggestions.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">AI Suggestions</h4>
                      <div className="space-y-2">
                        {matchModal.suggestions.slice(0, 5).map((suggestion, idx) => (
                          <div
                            key={idx}
                            className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
                            onClick={() => {
                              if (suggestion.receiptId) {
                                handleMatchReceipt(matchModal.transaction.id, suggestion.receiptId);
                              } else if (suggestion.purchaseOrderId) {
                                handleMatchPO(matchModal.transaction.id, suggestion.purchaseOrderId);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium">
                                {suggestion.receiptId ? 'Receipt' : 'Purchase Order'}
                              </div>
                              <div className="text-xs text-gray-500">
                                Score: {suggestion.matchScore}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {suggestion.matchReasons.join(' \u2022 ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual Search */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Or search receipts</h4>
                    <input
                      type="text"
                      placeholder="Search by merchant name..."
                      value={receiptSearchTerm}
                      onChange={(e) => setReceiptSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                    />
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
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
                            className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                            onClick={() => handleMatchReceipt(matchModal.transaction.id, receipt.id)}
                          >
                            <div className="text-sm font-medium">{receipt.merchantName || 'Unknown'}</div>
                            <div className="text-xs text-gray-500">
                              {formatDate(receipt.receiptDate)} &bull; {formatCurrency(receipt.totalAmount || 0)}
                            </div>
                          </div>
                        ))}
                      {availableReceipts.length === 0 && (
                        <div className="p-4 text-center text-gray-500 text-sm">No receipts available</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end">
                  <button
                    onClick={() => setMatchModal(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
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
