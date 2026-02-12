'use client';

import { useSession } from 'next-auth/react';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { POLineItem } from '@/components/POLineItemModal';
import ReconciliationBar from '@/components/ReconciliationBar';
import FindReceiptsPanel from '@/components/FindReceiptsPanel';

// Lazy load heavy components
const POLineItemModal = dynamic(() => import('@/components/POLineItemModal'), {
  loading: () => <div className="text-center py-4 text-[var(--text-secondary)]">Loading...</div>,
  ssr: false,
});

const ReceiptUploader = dynamic(() => import('@/components/ReceiptUploader'), {
  loading: () => <div className="text-center py-4 text-[var(--text-secondary)]">Loading...</div>,
});

const statusColors: Record<string, string> = {
  DRAFT: 'badge badge-neutral',
  PENDING_APPROVAL: 'badge badge-warning',
  APPROVED: 'badge badge-success',
  REJECTED: 'badge badge-error',
  COMPLETED: 'badge badge-info',
  CANCELLED: 'badge badge-error',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

type BudgetItem = {
  id: string;
  code: string;
  description: string;
  budgetAmount?: number;
  encumbered?: number;
  actualSpent?: number;
};

type Vendor = {
  id: string;
  name: string;
  vendorNumber: string;
};

type LinkedReceipt = {
  id: string;
  merchantName: string | null;
  receiptDate: string | null;
  totalAmount: number | null;
  currency: string;
  status: string;
  thumbnailUrl: string | null;
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
  autoApprovalNote: string | null;
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
  receipts: LinkedReceipt[];
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
  const [showFindReceipts, setShowFindReceipts] = useState(false);
  const [canEditReceipts, setCanEditReceipts] = useState(false);
  const [receiptSummary, setReceiptSummary] = useState<{
    poTotal: number;
    receiptedTotal: number;
    remainingAmount: number;
    receiptCount: number;
    percentCovered: number;
  } | null>(null);

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
    checkReceiptEditPermission();
    fetchReceiptSummary();
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

  const checkReceiptEditPermission = async () => {
    try {
      const res = await fetch('/api/permissions/check?resource=receipts&permission=canEdit');
      if (res.ok) {
        const data = await res.json();
        setCanEditReceipts(data.hasPermission);
      }
    } catch (error) {
      console.error('Error checking receipt edit permission:', error);
      setCanEditReceipts(false);
    }
  };

  const fetchReceiptSummary = async () => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}/receipt-summary`);
      if (res.ok) {
        const data = await res.json();
        setReceiptSummary(data);
      }
    } catch (error) {
      console.error('Error fetching receipt summary:', error);
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
          ? {
              id: budgetItem.id,
              code: budgetItem.code,
              description: budgetItem.description,
              budgetAmount: budgetItem.budgetAmount,
              encumbered: budgetItem.encumbered,
              actualSpent: budgetItem.actualSpent,
            }
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
                ? {
                    id: budgetItem.id,
                    code: budgetItem.code,
                    description: budgetItem.description,
                    budgetAmount: budgetItem.budgetAmount,
                    encumbered: budgetItem.encumbered,
                    actualSpent: budgetItem.actualSpent,
                  }
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
    if (newStatus === 'CANCELLED' || newStatus === 'REJECTED') {
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
        actions.push({ label: 'Submit for Approval', action: 'PENDING_APPROVAL', color: 'btn-primary' });
        actions.push({ label: 'Cancel', action: 'CANCELLED', color: 'btn-danger' });
        break;
      case 'PENDING_APPROVAL':
        actions.push({ label: 'Approve', action: 'APPROVED', color: 'btn-success' });
        actions.push({ label: 'Reject', action: 'REJECTED', color: 'bg-[var(--warning)] hover:bg-[var(--warning)] text-white' });
        actions.push({ label: 'Cancel', action: 'CANCELLED', color: 'btn-danger' });
        break;
      case 'REJECTED':
        actions.push({ label: 'Revise & Resubmit', action: 'DRAFT', color: 'btn-primary' });
        actions.push({ label: 'Cancel', action: 'CANCELLED', color: 'btn-danger' });
        break;
      case 'APPROVED':
        actions.push({ label: 'Mark Completed', action: 'COMPLETED', color: 'btn-primary' });
        actions.push({ label: 'Void', action: 'CANCELLED', color: 'btn-danger' });
        break;
      case 'COMPLETED':
        actions.push({ label: 'Void', action: 'CANCELLED', color: 'btn-danger' });
        break;
    }

    return actions;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Purchase order not found</div>
      </div>
    );
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

  const renderBudgetContext = (item: POLineItem) => {
    if (po.status !== 'PENDING_APPROVAL' || !item.budgetItem) return null;

    const budget = item.budgetItem.budgetAmount || 0;
    const committed = item.budgetItem.encumbered || 0;
    const actualSpent = item.budgetItem.actualSpent || 0;
    const thisAmount = item.amount;
    const remainingAfter = budget - committed - actualSpent - thisAmount;
    const isOverBudget = remainingAfter < 0;

    return (
      <div
        className={`mt-2 text-xs px-3 py-2 rounded ${
          isOverBudget
            ? 'bg-[var(--error-subtle)] text-[var(--error)] border border-[var(--error-muted)]'
            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
        }`}
      >
        <span className="font-medium">Budget:</span> ${budget.toFixed(2)} |
        <span className="font-medium"> Committed:</span> ${committed.toFixed(2)} |
        <span className="font-medium"> This PO:</span> ${thisAmount.toFixed(2)} |
        <span className="font-medium"> Remaining after:</span> ${remainingAfter.toFixed(2)}
        {isOverBudget && <span className="font-bold ml-1">(OVER BUDGET)</span>}
      </div>
    );
  };

  return (
    <div className="min-h-screen py-8 pb-24">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-2">
            <Link href="/purchase-orders" className="hover:text-[var(--accent-primary)]">
              Purchase Orders
            </Link>
            <span>/</span>
            <span>{po.poNumber}</span>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="page-title mb-2">{po.poNumber}</h1>
              <span className={statusColors[po.status]}>
                {statusLabels[po.status]}
              </span>
            </div>
            <div className="flex gap-2">
              {!editing && canEdit() && po.status === 'DRAFT' && (
                <button
                  onClick={() => setEditing(true)}
                  className="btn btn-primary"
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
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn btn-success"
                  >
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Auto-approval Note Banner */}
        {po.autoApprovalNote && po.status === 'PENDING_APPROVAL' && (
          <div className="mb-6 rounded-[var(--radius-lg)] border border-[var(--warning-muted)] bg-[var(--warning-subtle)] px-4 py-3 text-sm text-[var(--warning)]">
            <strong>Auto-approval skipped:</strong> {po.autoApprovalNote}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="card p-6">
              <h2 className="section-title mb-4">Purchase Order Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">PO Date</label>
                  {editing ? (
                    <input
                      type="date"
                      value={formData.poDate}
                      onChange={(e) => setFormData({ ...formData, poDate: e.target.value })}
                      className="form-input"
                    />
                  ) : (
                    <div className="text-[var(--text-primary)]">{new Date(po.poDate).toLocaleDateString()}</div>
                  )}
                </div>
                <div>
                  <label className="form-label">Vendor</label>
                  {editing ? (
                    <select
                      value={formData.vendorId}
                      onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                      className="form-input form-select"
                    >
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vendorNumber} - {v.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-[var(--text-primary)]">
                      {po.vendor.vendorNumber} - {po.vendor.name}
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="form-label">Notes</label>
                  {editing ? (
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="form-input"
                    />
                  ) : (
                    <div className="text-[var(--text-primary)]">{po.notes || '-'}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="card p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="section-title">Line Items</h2>
                {editing && (
                  <button
                    onClick={() => {
                      setEditingLineItem(null);
                      setShowLineItemModal(true);
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    + Add Item
                  </button>
                )}
              </div>
              {lineItems.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">No line items</div>
              ) : (
                <>
                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                  {lineItems.map((item) => (
                    <div key={item.id} className="card">
                      <div className="mb-3">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">{item.description}</h3>
                        {item.budgetItem && (
                          <p className="text-sm text-[var(--text-secondary)]">{item.budgetItem.code} - {item.budgetItem.description}</p>
                        )}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Amount:</span>
                          <span className="text-[var(--text-primary)] font-medium">${item.amount.toFixed(2)}</span>
                        </div>
                      </div>
                      {renderBudgetContext(item)}
                      {editing && (
                        <div className="border-t border-[var(--border-default)] pt-3 mt-3 flex justify-end gap-3">
                          <button
                            onClick={() => {
                              setEditingLineItem(item);
                              setShowLineItemModal(true);
                            }}
                            className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteLineItem(item.id!)}
                            className="text-[var(--error)] hover:text-[var(--error)] text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="border-t-2 border-[var(--border-default)] pt-3 flex justify-between">
                    <span className="text-sm font-bold text-[var(--text-primary)]">Total:</span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block table-container">
                  <table className="table" aria-label="Purchase order line items">
                    <thead>
                      <tr>
                        <th scope="col" className="text-left py-2 px-3">Description</th>
                        <th scope="col" className="text-left py-2 px-3">Budget Code</th>
                        <th scope="col" className="text-right py-2 px-3">Amount</th>
                        {editing && (
                          <th scope="col" className="text-right py-2 px-3">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item) => (
                        <>
                          <tr key={item.id}>
                            <td className="py-2 px-3 text-sm text-[var(--text-primary)]">{item.description}</td>
                            <td className="py-2 px-3 text-sm text-[var(--text-secondary)]">
                              {item.budgetItem ? `${item.budgetItem.code} - ${item.budgetItem.description}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-sm text-[var(--text-primary)] text-right">
                              ${item.amount.toFixed(2)}
                            </td>
                            {editing && (
                              <td className="py-2 px-3 text-sm text-right space-x-2">
                                <button
                                  onClick={() => {
                                    setEditingLineItem(item);
                                    setShowLineItemModal(true);
                                  }}
                                  className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteLineItem(item.id!)}
                                  className="text-[var(--error)] hover:text-[var(--error)]"
                                >
                                  Remove
                                </button>
                              </td>
                            )}
                          </tr>
                          {renderBudgetContext(item) && (
                            <tr key={`${item.id}-budget`}>
                              <td colSpan={editing ? 4 : 3} className="py-0 px-3 pb-2">
                                {renderBudgetContext(item)}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                      <tr className="border-t-2 border-[var(--border-default)] font-bold">
                        <td colSpan={2} className="py-2 px-3 text-sm text-[var(--text-primary)] text-right">
                          Total:
                        </td>
                        <td className="py-2 px-3 text-sm text-[var(--text-primary)] text-right">
                          ${totalAmount.toFixed(2)}
                        </td>
                        {editing && <td></td>}
                      </tr>
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>

            {/* Receipt Upload Section */}
            <div className="card p-6">
              <h2 className="section-title mb-4">Receipt</h2>

              {/* Success/Error Messages */}
              {receiptSuccess && (
                <div className="mb-4 card border-[var(--success-muted)] bg-[var(--success-subtle)] text-[var(--success)] px-4 py-3">
                  {receiptSuccess}
                </div>
              )}
              {receiptError && (
                <div className="mb-4 card border-[var(--error-muted)] bg-[var(--error-subtle)] text-[var(--error)] px-4 py-3">
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

            {/* Reconciliation Bar */}
            {receiptSummary && receiptSummary.receiptCount > 0 && (
              <div className="card p-6">
                <ReconciliationBar
                  poTotal={receiptSummary.poTotal}
                  receiptedTotal={receiptSummary.receiptedTotal}
                  receiptCount={receiptSummary.receiptCount}
                />
              </div>
            )}

            {/* Linked Receipts Section */}
            {po.receipts && po.receipts.length > 0 && (
              <div className="card p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="section-title">Linked Receipts</h2>
                  {canEditReceipts && po.status !== 'CANCELLED' && (
                    <button
                      onClick={() => setShowFindReceipts(true)}
                      className="btn btn-primary btn-sm"
                    >
                      Find & Attach Receipts
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {po.receipts.map((receipt) => (
                    <Link
                      key={receipt.id}
                      href={`/receipts/${receipt.id}`}
                      className="block border border-[var(--border-default)] rounded-lg p-4 hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {receipt.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/receipts/${receipt.id}/image?thumbnail=true`}
                              alt="Receipt thumbnail"
                              className="w-12 h-12 object-cover rounded"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-[var(--bg-tertiary)] rounded flex items-center justify-center">
                              <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                              </svg>
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-[var(--text-primary)]">
                              {receipt.merchantName || 'Untitled Receipt'}
                            </div>
                            <div className="text-sm text-[var(--text-muted)]">
                              {receipt.receiptDate
                                ? new Date(receipt.receiptDate).toLocaleDateString()
                                : 'No date'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-[var(--text-primary)]">
                            {receipt.totalAmount !== null
                              ? new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: receipt.currency || 'USD',
                                }).format(receipt.totalAmount)
                              : '-'}
                          </div>
                          <span className={`${
                            receipt.status === 'COMPLETED' || receipt.status === 'REVIEWED'
                              ? 'badge badge-success'
                              : receipt.status === 'PROCESSING'
                              ? 'badge badge-info'
                              : receipt.status === 'FAILED'
                              ? 'badge badge-error'
                              : 'badge badge-neutral'
                          }`}>
                            {receipt.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Find & Attach Receipts (when no receipts linked yet) */}
            {(!po.receipts || po.receipts.length === 0) &&
              canEditReceipts &&
              po.status !== 'CANCELLED' && (
              <div className="card p-6">
                <div className="flex justify-between items-center">
                  <h2 className="section-title">Linked Receipts</h2>
                  <button
                    onClick={() => setShowFindReceipts(true)}
                    className="btn btn-primary btn-sm"
                  >
                    Find & Attach Receipts
                  </button>
                </div>
                <p className="text-sm text-[var(--text-muted)] mt-2">
                  No receipts linked to this purchase order yet.
                </p>
              </div>
            )}

            {/* Status Actions */}
            {!editing && getStatusActions().length > 0 && (
              <div className="card p-6">
                <h2 className="section-title mb-4">Actions</h2>
                <div className="flex gap-3">
                  {getStatusActions().map((action) => (
                    <button
                      key={action.action}
                      onClick={() => handleStatusChange(action.action)}
                      className={`btn ${action.color}`}
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
            <div className="card p-6">
              <h2 className="section-title mb-4">Information</h2>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-[var(--text-secondary)]">Department</div>
                  <div className="text-[var(--text-primary)]">{po.department?.name || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--text-secondary)]">Requested By</div>
                  <div className="text-[var(--text-primary)]">{po.requestedBy.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{po.requestedBy.email}</div>
                </div>
                {po.approvedAt && (
                  <div>
                    <div className="text-sm text-[var(--text-secondary)]">Approved</div>
                    <div className="text-[var(--text-primary)]">{new Date(po.approvedAt).toLocaleDateString()}</div>
                  </div>
                )}
                {po.completedAt && (
                  <div>
                    <div className="text-sm text-[var(--text-secondary)]">Completed</div>
                    <div className="text-[var(--text-primary)]">{new Date(po.completedAt).toLocaleDateString()}</div>
                  </div>
                )}
                {po.rejectedAt && (
                  <div>
                    <div className="text-sm text-[var(--text-secondary)]">Rejected</div>
                    <div className="text-[var(--text-primary)]">{new Date(po.rejectedAt).toLocaleDateString()}</div>
                    {po.rejectionNote && (
                      <div className="mt-1 p-2 card border-[var(--warning-muted)] bg-[var(--warning-subtle)] text-sm">
                        {po.rejectionNote}
                      </div>
                    )}
                  </div>
                )}
                {po.voidedAt && (
                  <div>
                    <div className="text-sm text-[var(--text-secondary)]">Voided</div>
                    <div className="text-[var(--text-primary)]">{new Date(po.voidedAt).toLocaleDateString()}</div>
                    {po.voidNote && (
                      <div className="mt-1 p-2 card border-[var(--error-muted)] bg-[var(--error-subtle)] text-sm">
                        {po.voidNote}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Receipt */}
            {po.receiptFileName && (
              <div className="card p-6">
                <h2 className="section-title mb-4">Receipt</h2>
                <div className="text-sm text-[var(--text-primary)]">{po.receiptFileName}</div>
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
          <div className="card w-full max-w-md">
            <div className="border-b border-[var(--border-default)] px-6 py-4">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                {statusAction === 'CANCELLED' ? 'Void Purchase Order' : 'Reject Purchase Order'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">
                  Note *
                </label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  rows={4}
                  placeholder={statusAction === 'CANCELLED' ? 'Reason for voiding...' : 'Reason for rejection...'}
                  className="form-input"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusNote('');
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => processStatusChange(statusAction, statusNote)}
                  disabled={!statusNote.trim()}
                  className="btn btn-danger"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Find & Attach Receipts Panel */}
      <FindReceiptsPanel
        poId={id}
        isOpen={showFindReceipts}
        onClose={() => setShowFindReceipts(false)}
        onLinked={() => {
          fetchPO();
          fetchReceiptSummary();
        }}
      />
    </div>
  );
}
