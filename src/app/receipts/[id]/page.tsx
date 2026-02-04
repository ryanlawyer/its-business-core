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

const statusColors: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  REVIEWED: 'bg-purple-100 text-purple-800',
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">{error || 'Receipt not found'}</h2>
          <Link href="/receipts" className="mt-4 text-blue-600 hover:underline">
            Back to Receipts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/receipts"
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
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
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center"
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
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
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image Section */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Receipt Image</h2>
            </div>
            <div
              className="p-4 cursor-pointer"
              onClick={() => setShowFullImage(true)}
            >
              {receipt.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/receipts/${receipt.id}/image?t=${Date.now()}`}
                  alt="Receipt"
                  className="w-full h-auto rounded-lg"
                />
              ) : (
                <div className="aspect-[4/3] bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400">No image available</span>
                </div>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Details</h2>
              </div>
              <div className="p-4 space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Merchant Name
                      </label>
                      <input
                        type="text"
                        value={formData.merchantName}
                        onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Receipt Date
                      </label>
                      <input
                        type="date"
                        value={formData.receiptDate}
                        onChange={(e) => setFormData({ ...formData, receiptDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Total Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.totalAmount}
                          onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Currency
                        </label>
                        <select
                          value={formData.currency}
                          onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="CAD">CAD</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tax Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.taxAmount}
                        onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="REVIEWED">Reviewed</option>
                        <option value="FAILED">Failed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Merchant</span>
                      <span className="text-sm font-medium text-gray-900">
                        {receipt.merchantName || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Receipt Date</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(receipt.receiptDate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Total Amount</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatAmount(receipt.totalAmount, receipt.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Tax</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatAmount(receipt.taxAmount, receipt.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Source</span>
                      <span className="text-sm font-medium text-gray-900">{receipt.source}</span>
                    </div>
                    {receipt.notes && (
                      <div>
                        <span className="text-sm text-gray-500">Notes</span>
                        <p className="mt-1 text-sm text-gray-900">{receipt.notes}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Line Items */}
            {receipt.lineItems.length > 0 && (
              <div className="bg-white rounded-lg shadow-md">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">
                          Description
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700">
                          Qty
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700">
                          Unit Price
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipt.lineItems.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {item.description}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900 text-right">
                            {item.quantity || '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900 text-right">
                            {formatAmount(item.unitPrice, receipt.currency)}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">
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
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Additional Info</h2>
              </div>
              <div className="p-4 space-y-3">
                {receipt.vendor && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Vendor</span>
                    <span className="text-sm font-medium text-gray-900">
                      {receipt.vendor.name}
                    </span>
                  </div>
                )}
                {receipt.budgetCategory && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Category</span>
                    <span className="text-sm font-medium text-gray-900">
                      {receipt.budgetCategory.name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Uploaded By</span>
                  <span className="text-sm font-medium text-gray-900">
                    {receipt.user?.name || receipt.user?.email || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Created</span>
                  <span className="text-sm text-gray-900">
                    {formatDateTime(receipt.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Updated</span>
                  <span className="text-sm text-gray-900">
                    {formatDateTime(receipt.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Purchase Order Linking */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Purchase Order</h2>
                {!receipt.purchaseOrder && (
                  <button
                    onClick={openPOLinking}
                    className="text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {receipt.purchaseOrder.poNumber}
                      </Link>
                      <p className="text-sm text-gray-500 mt-1">
                        This receipt is linked to a purchase order
                      </p>
                    </div>
                    <button
                      onClick={handleUnlinkPO}
                      disabled={linkingPO}
                      className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50"
                    >
                      {linkingPO ? 'Unlinking...' : 'Unlink'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No purchase order linked. Click &quot;Link to PO&quot; to find matching purchase orders.
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
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Link to Purchase Order</h3>
              <button
                onClick={() => setShowPOLinking(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingSuggestions ? (
                <div className="text-center py-8">
                  <svg className="w-8 h-8 mx-auto animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="mt-2 text-gray-500">Finding matching purchase orders...</p>
                </div>
              ) : poSuggestions.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <p className="mt-2 text-gray-500">No matching purchase orders found</p>
                  <p className="text-sm text-gray-400">Try adding a vendor to this receipt for better matches</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
                    We found {poSuggestions.length} potential match{poSuggestions.length > 1 ? 'es' : ''} based on vendor, amount, and date:
                  </p>
                  {poSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.purchaseOrder.id}
                      className="border rounded-lg p-4 hover:border-blue-500 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {suggestion.purchaseOrder.poNumber}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              suggestion.matchScore >= 60
                                ? 'bg-green-100 text-green-800'
                                : suggestion.matchScore >= 40
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {suggestion.matchScore}% match
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
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
                                className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => handleLinkPO(suggestion.purchaseOrder.id)}
                          disabled={linkingPO}
                          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                        >
                          {linkingPO ? 'Linking...' : 'Link'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowPOLinking(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Image Modal */}
      {showFullImage && receipt.imageUrl && (
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
