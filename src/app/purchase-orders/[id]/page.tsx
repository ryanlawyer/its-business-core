'use client';

import { useSession } from 'next-auth/react';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { POLineItem } from '@/components/POLineItemModal';

// Lazy load heavy components
const POLineItemModal = dynamic(() => import('@/components/POLineItemModal'), {
  loading: () => <div className="text-center py-4 text-gray-600">Loading...</div>,
  ssr: false,
});

const ReceiptUploader = dynamic(() => import('@/components/ReceiptUploader'), {
  loading: () => <div className="text-center py-4 text-gray-600">Loading...</div>,
});

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

type BudgetItem = {
  id: string;
  code: string;
  name: string;
};

type Vendor = {
  id: string;
  name: string;
  vendorNumber: string;
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  poDate: string;
  vendorId: string;
  vendor: Vendor;
  status: string;
  totalAmount: number;
  notes: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  requestedById: string;
  requestedBy: { id: string; name: string; email: string };
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionNote: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
  voidNote: string | null;
  completedAt: string | null;
  receiptFileName: string | null;
  receiptFilePath: string | null;
  lineItems: POLineItem[];
  createdAt: string;
  updatedAt: string;
};

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [showLineItemModal, setShowLineItemModal] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<POLineItem | null>(null);
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAction, setStatusAction] = useState<string>('');
  const [statusNote, setStatusNote] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const [receiptSuccess, setReceiptSuccess] = useState('');
  const [canUploadReceipt, setCanUploadReceipt] = useState(false);

  const [formData, setFormData] = useState({
    poDate: '',
    vendorId: '',
    notes: '',
  });

  useEffect(() => {
    fetchPO();
    fetchBudgetItems();
    fetchVendors();
    checkUploadPermission();
  }, [id]);

  const checkUploadPermission = async () => {
    try {
      const res = await fetch('/api/permissions/check?resource=purchaseOrders&permission=canUploadReceipts');
      if (res.ok) {
        const data = await res.json();
        setCanUploadReceipt(data.hasPermission);
      }
    } catch (error) {
      console.error('Error checking upload permission:', error);
      setCanUploadReceipt(false);
    }
  };

  const fetchPO = async () => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPo(data.purchaseOrder);
        setLineItems(data.purchaseOrder.lineItems || []);
        setFormData({
          poDate: data.purchaseOrder.poDate.split('T')[0],
          vendorId: data.purchaseOrder.vendorId,
          notes: data.purchaseOrder.notes || '',
        });
      } else {
        alert('Failed to load purchase order');
        router.push('/purchase-orders');
      }
    } catch (error) {
      console.error('Error fetching PO:', error);
      alert('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetItems = async () => {
    try {
      const res = await fetch('/api/budget-items');
      const data = await res.json();
      setBudgetItems(data.budgetItems || []);
    } catch (error) {
      console.error('Error fetching budget items:', error);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch('/api/vendors');
      const data = await res.json();
      setVendors(data.vendors || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          lineItems: lineItems.map((item) => ({
            id: item.id,
            description: item.description,
            amount: item.amount,
            budgetItemId: item.budgetItemId,
          })),
        }),
      });

      if (res.ok) {
        setEditing(false);
        fetchPO();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save purchase order');
      }
    } catch (error) {
      console.error('Error saving PO:', error);
      alert('Failed to save purchase order');
    }
  };

  const handleAddLineItem = (item: POLineItem) => {
    const budgetItem = budgetItems.find((bi) => bi.id === item.budgetItemId);
    setLineItems([
      ...lineItems,
      {
        ...item,
        id: `temp-${Date.now()}`,
        budgetItem: budgetItem
          ? { id: budgetItem.id, code: budgetItem.code, name: budgetItem.name }
          : undefined,
      },
    ]);
  };

  const handleEditLineItem = (item: POLineItem) => {
    const budgetItem = budgetItems.find((bi) => bi.id === item.budgetItemId);
    setLineItems(
      lineItems.map((li) =>
        li.id === editingLineItem?.id
          ? {
              ...item,
              id: li.id,
              budgetItem: budgetItem
                ? { id: budgetItem.id, code: budgetItem.code, name: budgetItem.name }
                : undefined,
            }
          : li
      )
    );
    setEditingLineItem(null);
  };

  const handleDeleteLineItem = (itemId: string) => {
    if (confirm('Remove this line item?')) {
      setLineItems(lineItems.filter((li) => li.id !== itemId));
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatusAction(newStatus);

    // Show modal for actions that require a note
    if (newStatus === 'CANCELLED' || (newStatus === 'DRAFT' && po?.status === 'PENDING_APPROVAL')) {
      setShowStatusModal(true);
      return;
    }

    // Process without note
    await processStatusChange(newStatus, '');
  };

  const processStatusChange = async (newStatus: string, note: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus, note }),
      });

      if (res.ok) {
        setShowStatusModal(false);
        setStatusNote('');
        fetchPO();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to change status');
      }
    } catch (error) {
      console.error('Error changing status:', error);
      alert('Failed to change status');
    }
  };

  const canEdit = () => {
    if (!po || !user) return false;
    // Can edit if: owner and DRAFT, or has canEdit permission
    return (po.status === 'DRAFT' && po.requestedById === user.id) || user.roleCode === 'ADMIN';
  };

  const getStatusActions = () => {
    if (!po || !user) return [];

    const actions: Array<{ label: string; action: string; color: string }> = [];

    switch (po.status) {
      case 'DRAFT':
        actions.push({ label: 'Submit for Approval', action: 'PENDING_APPROVAL', color: 'bg-blue-600 hover:bg-blue-700' });
        actions.push({ label: 'Cancel', action: 'CANCELLED', color: 'bg-red-600 hover:bg-red-700' });
        break;
      case 'PENDING_APPROVAL':
        actions.push({ label: 'Approve', action: 'APPROVED', color: 'bg-green-600 hover:bg-green-700' });
        actions.push({ label: 'Reject', action: 'DRAFT', color: 'bg-yellow-600 hover:bg-yellow-700' });
        actions.push({ label: 'Cancel', action: 'CANCELLED', color: 'bg-red-600 hover:bg-red-700' });
        break;
      case 'APPROVED':
        actions.push({ label: 'Mark Completed', action: 'COMPLETED', color: 'bg-blue-600 hover:bg-blue-700' });
        actions.push({ label: 'Void', action: 'CANCELLED', color: 'bg-red-600 hover:bg-red-700' });
        break;
      case 'COMPLETED':
        actions.push({ label: 'Void', action: 'CANCELLED', color: 'bg-red-600 hover:bg-red-700' });
        break;
    }

    return actions;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Purchase order not found</div>
      </div>
    );
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link href="/purchase-orders" className="hover:text-blue-600">
              Purchase Orders
            </Link>
            <span>/</span>
            <span>{po.poNumber}</span>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{po.poNumber}</h1>
              <span className={`px-3 py-1 rounded text-sm font-medium ${statusColors[po.status]}`}>
                {statusLabels[po.status]}
              </span>
            </div>
            <div className="flex gap-2">
              {!editing && canEdit() && po.status === 'DRAFT' && (
                <button
                  onClick={() => setEditing(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Edit
                </button>
              )}
              {editing && (
                <>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setLineItems(po.lineItems || []);
                      setFormData({
                        poDate: po.poDate.split('T')[0],
                        vendorId: po.vendorId,
                        notes: po.notes || '',
                      });
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Purchase Order Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PO Date</label>
                  {editing ? (
                    <input
                      type="date"
                      value={formData.poDate}
                      onChange={(e) => setFormData({ ...formData, poDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="text-gray-900">{new Date(po.poDate).toLocaleDateString()}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                  {editing ? (
                    <select
                      value={formData.vendorId}
                      onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vendorNumber} - {v.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-gray-900">
                      {po.vendor.vendorNumber} - {po.vendor.name}
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  {editing ? (
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="text-gray-900">{po.notes || '-'}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Line Items</h2>
                {editing && (
                  <button
                    onClick={() => {
                      setEditingLineItem(null);
                      setShowLineItemModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
                  >
                    + Add Item
                  </button>
                )}
              </div>
              {lineItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No line items</div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Description</th>
                      <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Budget Code</th>
                      <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Amount</th>
                      {editing && (
                        <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="py-2 px-3 text-sm text-gray-900">{item.description}</td>
                        <td className="py-2 px-3 text-sm text-gray-600">
                          {item.budgetItem ? `${item.budgetItem.code} - ${item.budgetItem.name}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-sm text-gray-900 text-right">
                          ${item.amount.toFixed(2)}
                        </td>
                        {editing && (
                          <td className="py-2 px-3 text-sm text-right space-x-2">
                            <button
                              onClick={() => {
                                setEditingLineItem(item);
                                setShowLineItemModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteLineItem(item.id!)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-300 font-bold">
                      <td colSpan={2} className="py-2 px-3 text-sm text-gray-900 text-right">
                        Total:
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-900 text-right">
                        ${totalAmount.toFixed(2)}
                      </td>
                      {editing && <td></td>}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Receipt Upload Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Receipt</h2>

              {/* Success/Error Messages */}
              {receiptSuccess && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                  {receiptSuccess}
                </div>
              )}
              {receiptError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {receiptError}
                </div>
              )}

              <ReceiptUploader
                poId={id}
                poNumber={po.poNumber}
                existingReceipt={
                  po.receiptFileName
                    ? {
                        filename: po.receiptFileName,
                        filepath: po.receiptFilePath || '',
                      }
                    : null
                }
                onUploadSuccess={() => {
                  setReceiptSuccess('Receipt operation completed successfully!');
                  setReceiptError('');
                  setTimeout(() => setReceiptSuccess(''), 3000);
                  fetchPO(); // Refresh PO to show updated receipt status
                }}
                onUploadError={(error) => {
                  setReceiptError(error);
                  setReceiptSuccess('');
                }}
                canUpload={canUploadReceipt}
              />
            </div>

            {/* Status Actions */}
            {!editing && getStatusActions().length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Actions</h2>
                <div className="flex gap-3">
                  {getStatusActions().map((action) => (
                    <button
                      key={action.action}
                      onClick={() => handleStatusChange(action.action)}
                      className={`${action.color} text-white px-6 py-2 rounded-lg font-semibold transition-colors`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Metadata */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Information</h2>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-600">Department</div>
                  <div className="text-gray-900">{po.department?.name || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Requested By</div>
                  <div className="text-gray-900">{po.requestedBy.name}</div>
                  <div className="text-xs text-gray-500">{po.requestedBy.email}</div>
                </div>
                {po.approvedAt && (
                  <div>
                    <div className="text-sm text-gray-600">Approved</div>
                    <div className="text-gray-900">{new Date(po.approvedAt).toLocaleDateString()}</div>
                  </div>
                )}
                {po.completedAt && (
                  <div>
                    <div className="text-sm text-gray-600">Completed</div>
                    <div className="text-gray-900">{new Date(po.completedAt).toLocaleDateString()}</div>
                  </div>
                )}
                {po.rejectedAt && (
                  <div>
                    <div className="text-sm text-gray-600">Rejected</div>
                    <div className="text-gray-900">{new Date(po.rejectedAt).toLocaleDateString()}</div>
                    {po.rejectionNote && (
                      <div className="mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        {po.rejectionNote}
                      </div>
                    )}
                  </div>
                )}
                {po.voidedAt && (
                  <div>
                    <div className="text-sm text-gray-600">Voided</div>
                    <div className="text-gray-900">{new Date(po.voidedAt).toLocaleDateString()}</div>
                    {po.voidNote && (
                      <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-sm">
                        {po.voidNote}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Receipt */}
            {po.receiptFileName && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Receipt</h2>
                <div className="text-sm text-gray-900">{po.receiptFileName}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Item Modal */}
      <POLineItemModal
        isOpen={showLineItemModal}
        onClose={() => {
          setShowLineItemModal(false);
          setEditingLineItem(null);
        }}
        onSave={editingLineItem ? handleEditLineItem : handleAddLineItem}
        budgetItems={budgetItems}
        editingItem={editingLineItem}
      />

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="border-b px-6 py-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {statusAction === 'CANCELLED' ? 'Void Purchase Order' : 'Reject Purchase Order'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note *
                </label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  rows={4}
                  placeholder={statusAction === 'CANCELLED' ? 'Reason for voiding...' : 'Reason for rejection...'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusNote('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => processStatusChange(statusAction, statusNote)}
                  disabled={!statusNote.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
