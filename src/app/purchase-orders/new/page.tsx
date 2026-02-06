'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BudgetItemSelector from '@/components/BudgetItemSelector';

type Vendor = {
  id: string;
  name: string;
  vendorNumber: string;
};

type Department = {
  id: string;
  name: string;
};

type BudgetItem = {
  id: string;
  code: string;
  name: string;
  allocated?: number;
  encumbered?: number;
  actualSpent?: number;
  remaining?: number;
  department?: {
    id: string;
    name: string;
  };
};

type LineItem = {
  id: string;
  budgetItemId: string;
  description: string;
  amount: string;
};

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showOverBudgetDialog, setShowOverBudgetDialog] = useState(false);
  const [overBudgetItems, setOverBudgetItems] = useState<Array<{
    code: string;
    name: string;
    amount: number;
    available: number;
    overBy: number;
  }>>([]);

  const [vendorId, setVendorId] = useState('');
  const [department, setDepartment] = useState('');
  const [note, setNote] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', budgetItemId: '', description: '', amount: '' },
  ]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [canUploadReceipt, setCanUploadReceipt] = useState(false);

  useEffect(() => {
    fetchData();
    checkUploadPermission();
  }, []);

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

  const fetchData = async () => {
    try {
      // Use combined endpoint to reduce API calls (2 requests → 1 request)
      const res = await fetch('/api/purchase-orders/form-data');
      const data = await res.json();

      setVendors(data.vendors || []);
      setBudgetItems(data.budgetItems || []);
      setDepartments(data.departments || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: Date.now().toString(),
        budgetItemId: '',
        description: '',
        amount: '',
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems(
      lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const calculateTotal = () => {
    return lineItems.reduce(
      (sum, item) => sum + (parseFloat(item.amount) || 0),
      0
    );
  };

  const checkBudgetOverages = () => {
    const overages: Array<{
      code: string;
      name: string;
      amount: number;
      available: number;
      overBy: number;
    }> = [];

    // Group line items by budget item
    const budgetTotals = new Map<string, number>();
    lineItems.forEach(item => {
      const amount = parseFloat(item.amount) || 0;
      const current = budgetTotals.get(item.budgetItemId) || 0;
      budgetTotals.set(item.budgetItemId, current + amount);
    });

    // Check each budget item for overages
    budgetTotals.forEach((totalAmount, budgetItemId) => {
      const budget = budgetItems.find(b => b.id === budgetItemId);
      if (budget && budget.remaining !== undefined) {
        if (totalAmount > budget.remaining) {
          overages.push({
            code: budget.code,
            name: budget.name,
            amount: totalAmount,
            available: budget.remaining,
            overBy: totalAmount - budget.remaining,
          });
        }
      }
    });

    return overages;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for budget overages
    const overages = checkBudgetOverages();
    if (overages.length > 0) {
      setOverBudgetItems(overages);
      setShowOverBudgetDialog(true);
      return;
    }

    // If no overages, proceed with normal submission
    await submitPO(false);
  };

  const submitPO = async (saveAsDraft: boolean) => {
    setSubmitting(true);

    try {
      // Step 1: Create the PO
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          department: department || null,
          note: note || null,
          status: saveAsDraft ? 'DRAFT' : undefined, // If over budget, save as DRAFT
          lineItems: lineItems.map((item) => ({
            budgetItemId: item.budgetItemId,
            description: item.description,
            amount: item.amount,
          })),
        }),
      });

      if (!res.ok) {
        alert('Error creating purchase order');
        return;
      }

      const data = await res.json();
      const poId = data.po.id;

      // Step 2: If receipt file is attached, upload it and change status to Pending Approval
      if (receiptFile && canUploadReceipt) {
        const formData = new FormData();
        formData.append('file', receiptFile);

        const uploadRes = await fetch(`/api/purchase-orders/${poId}/upload-receipt`, {
          method: 'POST',
          body: formData,
        });

        if (uploadRes.ok) {
          // Step 3: Change status to PENDING_APPROVAL
          await fetch(`/api/purchase-orders/${poId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              newStatus: 'PENDING_APPROVAL',
              note: 'Receipt uploaded during PO creation',
            }),
          });
        } else {
          console.error('Failed to upload receipt');
          // Still redirect to the PO page even if receipt upload fails
        }
      }

      router.push(`/purchase-orders/${poId}`);
    } catch (error) {
      console.error('Error submitting PO:', error);
      alert('Error creating purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="page-header flex justify-between items-center mb-8">
          <h1 className="page-title">
            New Purchase Order
          </h1>
          <Link
            href="/purchase-orders"
            className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
          >
            &larr; Back to List
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vendor and Department */}
          <div className="card p-6">
            <h2 className="section-title mb-4">
              Order Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">
                  Vendor *
                </label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  required
                  className="form-input form-select"
                >
                  <option value="">Select a vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name} ({vendor.vendorNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">
                  Department
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="form-input"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="form-label">
                Note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="form-input"
                placeholder="Optional notes..."
              />
            </div>
          </div>

          {/* Receipt Upload (Optional) */}
          {canUploadReceipt && (
            <div className="card p-6">
              <h2 className="section-title mb-4">
                Receipt (Optional)
              </h2>
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  Upload a receipt image or PDF. If you upload a receipt, the PO will automatically be submitted for approval.
                </p>
                <div>
                  <label className="block">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-[var(--text-muted)]
                        file:mr-4 file:py-2 file:px-4
                        file:rounded file:border-0
                        file:text-sm file:font-semibold
                        file:bg-[var(--accent-primary-subtle)] file:text-[var(--accent-primary)]
                        hover:file:bg-[var(--accent-primary-subtle)]
                        cursor-pointer"
                    />
                  </label>
                  {receiptFile && (
                    <div className="mt-2 text-sm text-[var(--text-secondary)]">
                      Selected: {receiptFile.name} ({(receiptFile.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Line Items */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="section-title">
                Line Items
              </h2>
              <button
                type="button"
                onClick={addLineItem}
                className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] text-sm font-medium"
              >
                + Add Line Item
              </button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item, index) => (
                <div
                  key={item.id}
                  className="border border-[var(--border-default)] rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-medium text-[var(--text-secondary)]">
                      Item {index + 1}
                    </span>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        className="text-[var(--error)] hover:text-[var(--error)] text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="form-label text-xs">
                        Budget Code *
                      </label>
                      <BudgetItemSelector
                        budgetItems={budgetItems}
                        departments={departments}
                        selectedBudgetItemId={item.budgetItemId}
                        onChange={(budgetItemId) =>
                          updateLineItem(item.id, 'budgetItemId', budgetItemId)
                        }
                        userDepartmentId={session?.user?.departmentId}
                        userDepartmentName={session?.user?.departmentName}
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label text-xs">
                        Description *
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateLineItem(item.id, 'description', e.target.value)
                        }
                        required
                        className="form-input text-sm"
                        placeholder="Item description"
                      />
                    </div>

                    <div>
                      <label className="form-label text-xs">
                        Amount *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.amount}
                        onChange={(e) =>
                          updateLineItem(item.id, 'amount', e.target.value)
                        }
                        required
                        className="form-input text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-6 pt-4 border-t border-[var(--border-default)]">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-[var(--text-primary)]">
                  Total Amount:
                </span>
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  ${calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <Link
              href="/purchase-orders"
              className="btn btn-secondary"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? 'Creating...' : 'Create Purchase Order'}
            </button>
          </div>
        </form>

        {/* Over Budget Confirmation Dialog */}
        {showOverBudgetDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="border-b border-[var(--border-default)] px-6 py-4">
                <h2 className="text-2xl font-bold text-[var(--error)]">
                  Budget Exceeded
                </h2>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-[var(--text-secondary)]">
                  The following budget items will be exceeded by this purchase order:
                </p>

                <div className="card border-[var(--error-muted)] bg-[var(--error-subtle)] p-4 space-y-3">
                  {overBudgetItems.map((item, index) => (
                    <div key={index} className="card p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-[var(--text-primary)]">{item.code}</div>
                          <div className="text-sm text-[var(--text-secondary)]">{item.name}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-[var(--text-secondary)]">Available:</span>
                          <div className="font-semibold text-[var(--success)]">
                            ${item.available.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <span className="text-[var(--text-secondary)]">Requested:</span>
                          <div className="font-semibold text-[var(--text-primary)]">
                            ${item.amount.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <span className="text-[var(--text-secondary)]">Over by:</span>
                          <div className="font-semibold text-[var(--error)]">
                            ${item.overBy.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card border-[var(--info-muted)] bg-[var(--info-subtle)] p-4">
                  <p className="text-sm text-[var(--info)]">
                    <strong>Note:</strong> If you continue, the purchase order will be saved as a <strong>DRAFT</strong> and will not affect budget allocations until approved.
                  </p>
                </div>

                <p className="text-[var(--text-secondary)]">
                  What would you like to do?
                </p>
              </div>

              <div className="border-t border-[var(--border-default)] px-6 py-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowOverBudgetDialog(false);
                    setOverBudgetItems([]);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel &amp; Revise
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowOverBudgetDialog(false);
                    await submitPO(true);
                  }}
                  className="btn bg-[var(--warning)] hover:bg-[var(--warning)] text-white font-semibold px-6 py-2 rounded-md transition-colors"
                >
                  Save as Draft
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
