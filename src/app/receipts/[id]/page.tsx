'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type LineItem = {
  id: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  total: number;
  budgetCategory: { id: string; name: string } | null;
};

type Receipt = {
  id: string;
  merchantName: string | null;
  receiptDate: string | null;
  totalAmount: number | null;
  currency: string;
  taxAmount: number | null;
  status: string;
  source: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  notes: string | null;
  rawOcrData: string | null;
  vendor: { id: string; name: string; vendorNumber: string | null } | null;
  budgetCategory: { id: string; name: string; code: string | null } | null;
  purchaseOrder: { id: string; poNumber: string } | null;
  user: { id: string; name: string | null; email: string | null } | null;
  lineItems: LineItem[];
  createdAt: string;
  updatedAt: string;
};

type POSuggestion = {
  purchaseOrder: {
    id: string;
    poNumber: string;
    poDate: string;
    totalAmount: number | null;
    status: string;
    vendor: { id: string; name: string } | null;
    requestedBy: { id: string; name: string } | null;
    linkedReceiptCount: number;
  };
  matchScore: number;
  matchReasons: string[];
};

type BudgetCategory = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
};

type CategorySuggestion = {
  category: BudgetCategory | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  source: 'user_mapping' | 'global_mapping' | 'pattern' | 'none';
  alternatives: Array<{ categoryId: string; categoryName: string; matchCount: number }>;
};

const statusColors: Record<string, string> = {
  PENDING: 'badge badge-neutral',
  PROCESSING: 'badge badge-info',
  COMPLETED: 'badge badge-success',
  FAILED: 'badge badge-error',
  REVIEWED: 'badge badge-info',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  REVIEWED: 'Reviewed',
};

export default function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showPOLinking, setShowPOLinking] = useState(false);
  const [poSuggestions, setPOSuggestions] = useState<POSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [linkingPO, setLinkingPO] = useState(false);

  // Category state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySuggestion, setCategorySuggestion] = useState<CategorySuggestion | null>(null);
  const [allCategories, setAllCategories] = useState<BudgetCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [assigningCategory, setAssigningCategory] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    merchantName: '',
    receiptDate: '',
    totalAmount: '',
    currency: 'USD',
    taxAmount: '',
    notes: '',
    status: '',
  });

  useEffect(() => {
    fetchReceipt();
  }, [id]);

  const fetchReceipt = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/receipts/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Receipt not found');
        } else {
          setError('Failed to load receipt');
        }
        return;
      }
      const data = await res.json();
      setReceipt(data.receipt);
      // Initialize form data
      setFormData({
        merchantName: data.receipt.merchantName || '',
        receiptDate: data.receipt.receiptDate
          ? new Date(data.receipt.receiptDate).toISOString().split('T')[0]
          : '',
        totalAmount: data.receipt.totalAmount?.toString() || '',
        currency: data.receipt.currency || 'USD',
        taxAmount: data.receipt.taxAmount?.toString() || '',
        notes: data.receipt.notes || '',
        status: data.receipt.status || '',
      });
    } catch (err) {
      console.error('Error fetching receipt:', err);
      setError('Failed to load receipt');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/receipts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantName: formData.merchantName || null,
          receiptDate: formData.receiptDate || null,
          totalAmount: formData.totalAmount || null,
          currency: formData.currency,
          taxAmount: formData.taxAmount || null,
          notes: formData.notes || null,
          status: formData.status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await res.json();
      setReceipt(data.receipt);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving receipt:', err);
      alert(err instanceof Error ? err.message : 'Failed to save receipt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this receipt? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/receipts/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      router.push('/receipts');
    } catch (err) {
      console.error('Error deleting receipt:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete receipt');
    }
  };

  const handleReprocess = async () => {
    try {
      setProcessing(true);
      const res = await fetch(`/api/receipts/${id}/process`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Processing failed');
      }

      // Refresh the receipt data
      await fetchReceipt();
    } catch (err) {
      console.error('Error processing receipt:', err);
      alert(err instanceof Error ? err.message : 'Failed to process receipt');
    } finally {
      setProcessing(false);
    }
  };

  const fetchPOSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const res = await fetch(`/api/receipts/${id}/suggest-po`);
      if (res.ok) {
        const data = await res.json();
        setPOSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error('Error fetching PO suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleLinkPO = async (purchaseOrderId: string) => {
    try {
      setLinkingPO(true);
      const res = await fetch(`/api/receipts/${id}/link-po`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseOrderId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to link PO');
      }

      const data = await res.json();
      if (data.warning) {
        alert(`Linked successfully. Note: ${data.warning}`);
      }

      // Refresh receipt data
      await fetchReceipt();
      setShowPOLinking(false);
    } catch (err) {
      console.error('Error linking PO:', err);
      alert(err instanceof Error ? err.message : 'Failed to link PO');
    } finally {
      setLinkingPO(false);
    }
  };

  const handleUnlinkPO = async () => {
    if (!confirm('Are you sure you want to unlink this receipt from the purchase order?')) {
      return;
    }

    try {
      setLinkingPO(true);
      const res = await fetch(`/api/receipts/${id}/link-po`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to unlink PO');
      }

      // Refresh receipt data
      await fetchReceipt();
    } catch (err) {
      console.error('Error unlinking PO:', err);
      alert(err instanceof Error ? err.message : 'Failed to unlink PO');
    } finally {
      setLinkingPO(false);
    }
  };

  const openPOLinking = () => {
    setShowPOLinking(true);
    fetchPOSuggestions();
  };

  const fetchCategorySuggestion = async () => {
    try {
      setLoadingCategories(true);
      const res = await fetch(`/api/receipts/${id}/suggest-category`);
      if (res.ok) {
        const data = await res.json();
        setCategorySuggestion(data.suggestion);
        setAllCategories(data.allCategories || []);
      }
    } catch (err) {
      console.error('Error fetching category suggestion:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleAssignCategory = async (categoryId: string, learnMapping = true) => {
    try {
      setAssigningCategory(true);
      const res = await fetch(`/api/receipts/${id}/category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, learnMapping }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to assign category');
      }

      // Refresh receipt data
      await fetchReceipt();
      setShowCategoryModal(false);
    } catch (err) {
      console.error('Error assigning category:', err);
      alert(err instanceof Error ? err.message : 'Failed to assign category');
    } finally {
      setAssigningCategory(false);
    }
  };

  const handleRemoveCategory = async () => {
    if (!confirm('Are you sure you want to remove the category from this receipt?')) {
      return;
    }

    try {
      setAssigningCategory(true);
      const res = await fetch(`/api/receipts/${id}/category`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove category');
      }

      // Refresh receipt data
      await fetchReceipt();
    } catch (err) {
      console.error('Error removing category:', err);
      alert(err instanceof Error ? err.message : 'Failed to remove category');
    } finally {
      setAssigningCategory(false);
    }
  };

  const openCategoryModal = () => {
    setShowCategoryModal(true);
    setCategorySearchTerm('');
    fetchCategorySuggestion();
  };

  const filteredCategories = allCategories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(categorySearchTerm.toLowerCase()) ||
      cat.code.toLowerCase().includes(categorySearchTerm.toLowerCase())
  );

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf') ?? false;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAmount = (amount: number | null, currency: string) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">{error || 'Receipt not found'}</h2>
          <Link href="/receipts" className="mt-4 text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] hover:underline">
            Back to Receipts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 pb-24">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/receipts"
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <h1 className="page-title">
              {receipt.merchantName || 'Receipt Details'}
            </h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[receipt.status]}`}>
              {statusLabels[receipt.status]}
            </span>
          </div>

          <div className="flex gap-2">
            {(receipt.status === 'PENDING' || receipt.status === 'FAILED') && (
              <button
                onClick={handleReprocess}
                disabled={processing}
                className="btn btn-primary disabled:opacity-50 flex items-center"
              >
                {processing ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Process with AI
                  </>
                )}
              </button>
            )}

            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn btn-primary"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="btn btn-danger"
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-success disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    // Reset form data
                    setFormData({
                      merchantName: receipt.merchantName || '',
                      receiptDate: receipt.receiptDate
                        ? new Date(receipt.receiptDate).toISOString().split('T')[0]
                        : '',
                      totalAmount: receipt.totalAmount?.toString() || '',
                      currency: receipt.currency || 'USD',
                      taxAmount: receipt.taxAmount?.toString() || '',
                      notes: receipt.notes || '',
                      status: receipt.status || '',
                    });
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image/PDF Section */}
          <div className="card overflow-hidden lg:sticky lg:top-4 lg:self-start">
            <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between">
              <h2 className="section-title">Receipt {isPdf(receipt.imageUrl) ? 'Document' : 'Image'}</h2>
              {receipt.imageUrl && isPdf(receipt.imageUrl) && (
                <a
                  href={`/api/receipts/${receipt.id}/image`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm inline-flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  Open in new tab
                </a>
              )}
            </div>
            <div className="p-4">
              {receipt.imageUrl ? (
                isPdf(receipt.imageUrl) ? (
                  <iframe
                    src={`/api/receipts/${receipt.id}/image?t=${Date.now()}#navpanes=0&view=FitH`}
                    className="w-full rounded-lg border border-[var(--border-default)]"
                    style={{ height: 'calc(100vh - 12rem)' }}
                    title="Receipt PDF"
                  />
                ) : (
                  <div
                    className="cursor-pointer"
                    onClick={() => setShowFullImage(true)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/receipts/${receipt.id}/image?t=${Date.now()}`}
                      alt="Receipt"
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                )
              ) : (
                <div className="aspect-[4/3] bg-[var(--bg-surface)] rounded-lg flex items-center justify-center">
                  <span className="text-[var(--text-muted)]">No image available</span>
                </div>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="card">
              <div className="p-4 border-b border-[var(--border-default)]">
                <h2 className="section-title">Details</h2>
              </div>
              <div className="p-4 space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="form-label">
                        Merchant Name
                      </label>
                      <input
                        type="text"
                        value={formData.merchantName}
                        onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">
                        Receipt Date
                      </label>
                      <input
                        type="date"
                        value={formData.receiptDate}
                        onChange={(e) => setFormData({ ...formData, receiptDate: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">
                          Total Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.totalAmount}
                          onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">
                          Currency
                        </label>
                        <select
                          value={formData.currency}
                          onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                          className="form-input form-select"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="CAD">CAD</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="form-label">
                        Tax Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.taxAmount}
                        onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="form-input form-select"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="REVIEWED">Reviewed</option>
                        <option value="FAILED">Failed</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">
                        Notes
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        className="form-input"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)]">Merchant</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {receipt.merchantName || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)]">Receipt Date</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {formatDate(receipt.receiptDate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)]">Total Amount</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {formatAmount(receipt.totalAmount, receipt.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)]">Tax</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {formatAmount(receipt.taxAmount, receipt.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)]">Source</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{receipt.source}</span>
                    </div>
                    {receipt.notes && (
                      <div>
                        <span className="text-sm text-[var(--text-secondary)]">Notes</span>
                        <p className="mt-1 text-sm text-[var(--text-primary)]">{receipt.notes}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Line Items */}
            {receipt.lineItems.length > 0 && (
              <div className="card">
                <div className="p-4 border-b border-[var(--border-default)]">
                  <h2 className="section-title">Line Items</h2>
                </div>
                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4 p-4">
                  {receipt.lineItems.map((item) => (
                    <div key={item.id} className="card">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">{item.description}</h3>
                        </div>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {formatAmount(item.total, receipt.currency)}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Quantity:</span>
                          <span className="text-[var(--text-primary)]">{item.quantity || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Unit Price:</span>
                          <span className="text-[var(--text-primary)]">{formatAmount(item.unitPrice, receipt.currency)}</span>
                        </div>
                        <div className="flex justify-between border-t border-[var(--border-default)] pt-2">
                          <span className="text-[var(--text-secondary)] font-medium">Total:</span>
                          <span className="text-[var(--text-primary)] font-medium">{formatAmount(item.total, receipt.currency)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block table-container">
                  <table className="table" aria-label="Receipt line items">
                    <thead>
                      <tr>
                        <th scope="col" className="text-left py-3 px-4 text-xs font-semibold">
                          Description
                        </th>
                        <th scope="col" className="text-right py-3 px-4 text-xs font-semibold">
                          Qty
                        </th>
                        <th scope="col" className="text-right py-3 px-4 text-xs font-semibold">
                          Unit Price
                        </th>
                        <th scope="col" className="text-right py-3 px-4 text-xs font-semibold">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipt.lineItems.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 px-4 text-sm">
                            {item.description}
                          </td>
                          <td className="py-3 px-4 text-sm text-right">
                            {item.quantity || '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-right">
                            {formatAmount(item.unitPrice, receipt.currency)}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-right">
                            {formatAmount(item.total, receipt.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="card">
              <div className="p-4 border-b border-[var(--border-default)]">
                <h2 className="section-title">Additional Info</h2>
              </div>
              <div className="p-4 space-y-3">
                {receipt.vendor && (
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">Vendor</span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {receipt.vendor.name}
                    </span>
                  </div>
                )}
                {receipt.budgetCategory && (
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">Category</span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {receipt.budgetCategory.name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">Uploaded By</span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {receipt.user?.name || receipt.user?.email || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">Created</span>
                  <span className="text-sm text-[var(--text-primary)]">
                    {formatDateTime(receipt.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">Updated</span>
                  <span className="text-sm text-[var(--text-primary)]">
                    {formatDateTime(receipt.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Purchase Order Linking */}
            <div className="card">
              <div className="p-4 border-b border-[var(--border-default)] flex justify-between items-center">
                <h2 className="section-title">Purchase Order</h2>
                {!receipt.purchaseOrder && (
                  <button
                    onClick={openPOLinking}
                    className="btn btn-primary btn-sm"
                  >
                    Link to PO
                  </button>
                )}
              </div>
              <div className="p-4">
                {receipt.purchaseOrder ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <Link
                        href={`/purchase-orders/${receipt.purchaseOrder.id}`}
                        className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] hover:underline font-medium"
                      >
                        {receipt.purchaseOrder.poNumber}
                      </Link>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        This receipt is linked to a purchase order
                      </p>
                    </div>
                    <button
                      onClick={handleUnlinkPO}
                      disabled={linkingPO}
                      className="btn btn-danger btn-sm disabled:opacity-50"
                    >
                      {linkingPO ? 'Unlinking...' : 'Unlink'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    No purchase order linked. Click &quot;Link to PO&quot; to find matching purchase orders.
                  </p>
                )}
              </div>
            </div>

            {/* Budget Category */}
            <div className="card">
              <div className="p-4 border-b border-[var(--border-default)] flex justify-between items-center">
                <h2 className="section-title">Budget Category</h2>
                {!receipt.budgetCategory && (
                  <button
                    onClick={openCategoryModal}
                    className="btn btn-success btn-sm"
                  >
                    Assign Category
                  </button>
                )}
              </div>
              <div className="p-4">
                {receipt.budgetCategory ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-[var(--text-primary)]">
                        {receipt.budgetCategory.code && (
                          <span className="text-[var(--text-secondary)] mr-2">{receipt.budgetCategory.code}</span>
                        )}
                        {receipt.budgetCategory.name}
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        Expense categorized for budget tracking
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={openCategoryModal}
                        className="btn btn-primary btn-sm"
                      >
                        Change
                      </button>
                      <button
                        onClick={handleRemoveCategory}
                        disabled={assigningCategory}
                        className="btn btn-danger btn-sm disabled:opacity-50"
                      >
                        {assigningCategory ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    No category assigned. Click &quot;Assign Category&quot; to categorize this expense.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PO Linking Modal */}
      {showPOLinking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="card max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-[var(--border-default)] flex justify-between items-center">
              <h3 className="section-title">Link to Purchase Order</h3>
              <button
                onClick={() => setShowPOLinking(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingSuggestions ? (
                <div className="text-center py-8">
                  <svg className="w-8 h-8 mx-auto animate-spin text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="mt-2 text-[var(--text-secondary)]">Finding matching purchase orders...</p>
                </div>
              ) : poSuggestions.length === 0 ? (
                <div className="empty-state py-8">
                  <svg className="empty-state-icon" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <p className="empty-state-title">No matching purchase orders found</p>
                  <p className="empty-state-description">Try adding a vendor to this receipt for better matches</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    We found {poSuggestions.length} potential match{poSuggestions.length > 1 ? 'es' : ''} based on vendor, amount, and date:
                  </p>
                  {poSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.purchaseOrder.id}
                      className="border border-[var(--border-default)] rounded-lg p-4 hover:border-[var(--accent-primary)] transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[var(--text-primary)]">
                              {suggestion.purchaseOrder.poNumber}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              suggestion.matchScore >= 60
                                ? 'badge badge-success'
                                : suggestion.matchScore >= 40
                                ? 'badge badge-warning'
                                : 'badge badge-neutral'
                            }`}>
                              {suggestion.matchScore}% match
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-[var(--text-secondary)]">
                            {suggestion.purchaseOrder.vendor?.name || 'No vendor'} &bull; {
                              suggestion.purchaseOrder.totalAmount !== null
                                ? formatAmount(suggestion.purchaseOrder.totalAmount, receipt.currency)
                                : 'No amount'
                            } &bull; {formatDate(suggestion.purchaseOrder.poDate)}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {suggestion.matchReasons.map((reason, idx) => (
                              <span
                                key={idx}
                                className="badge badge-info text-xs"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => handleLinkPO(suggestion.purchaseOrder.id)}
                          disabled={linkingPO}
                          className="ml-4 btn btn-primary btn-sm disabled:opacity-50"
                        >
                          {linkingPO ? 'Linking...' : 'Link'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-[var(--border-default)]">
              <button
                onClick={() => setShowPOLinking(false)}
                className="btn btn-secondary w-full"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Assignment Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="card max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-[var(--border-default)] flex justify-between items-center">
              <h3 className="section-title">Assign Budget Category</h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingCategories ? (
                <div className="text-center py-8">
                  <svg className="w-8 h-8 mx-auto animate-spin text-[var(--success)]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="mt-2 text-[var(--text-secondary)]">Loading categories...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* AI Suggestion */}
                  {categorySuggestion?.category && (
                    <div className="card border-[var(--success-muted)] bg-[var(--success-subtle)] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-[var(--success)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                        </svg>
                        <span className="font-medium text-[var(--success)]">AI Suggestion</span>
                        <span className={`${
                          categorySuggestion.confidence === 'high'
                            ? 'badge badge-success'
                            : categorySuggestion.confidence === 'medium'
                            ? 'badge badge-warning'
                            : 'badge badge-neutral'
                        }`}>
                          {categorySuggestion.confidence} confidence
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-[var(--text-primary)]">
                            {categorySuggestion.category.code && (
                              <span className="text-[var(--text-secondary)] mr-2">{categorySuggestion.category.code}</span>
                            )}
                            {categorySuggestion.category.name}
                          </span>
                          <p className="text-sm text-[var(--text-secondary)] mt-1">
                            Based on {categorySuggestion.source === 'user_mapping' ? 'your previous categorizations' :
                              categorySuggestion.source === 'global_mapping' ? 'common categorizations' : 'similar merchants'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAssignCategory(categorySuggestion.category!.id)}
                          disabled={assigningCategory}
                          className="btn btn-success btn-sm disabled:opacity-50"
                        >
                          {assigningCategory ? 'Assigning...' : 'Use This'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search */}
                  <div>
                    <input
                      type="text"
                      placeholder="Search categories..."
                      value={categorySearchTerm}
                      onChange={(e) => setCategorySearchTerm(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  {/* Category List */}
                  <div className="border border-[var(--border-default)] rounded-lg divide-y divide-[var(--border-subtle)] max-h-64 overflow-y-auto">
                    {filteredCategories.length === 0 ? (
                      <div className="p-4 text-center text-[var(--text-secondary)]">
                        No categories found
                      </div>
                    ) : (
                      filteredCategories.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between p-3 hover:bg-[var(--bg-hover)] cursor-pointer"
                          onClick={() => handleAssignCategory(cat.id)}
                        >
                          <div>
                            <span className="font-medium text-[var(--text-primary)]">
                              {cat.code && (
                                <span className="text-[var(--text-secondary)] mr-2">{cat.code}</span>
                              )}
                              {cat.name}
                            </span>
                            {cat.description && (
                              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{cat.description}</p>
                            )}
                          </div>
                          {receipt.budgetCategory?.id === cat.id && (
                            <span className="badge badge-success">
                              Current
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-[var(--border-default)]">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="btn btn-secondary w-full"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Image Modal (images only, not PDFs) */}
      {showFullImage && receipt.imageUrl && !isPdf(receipt.imageUrl) && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setShowFullImage(false)}
        >
          <div className="relative max-w-4xl max-h-full overflow-auto">
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/receipts/${receipt.id}/image?t=${Date.now()}`}
              alt="Receipt"
              className="max-w-full h-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
