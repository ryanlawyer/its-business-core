'use client';

import { useState, useEffect } from 'react';

export type POLineItem = {
  id?: string;
  description: string;
  amount: number;
  budgetItemId: string;
  budgetItem?: {
    id: string;
    code: string;
    name: string;
  };
};

type BudgetItem = {
  id: string;
  code: string;
  name: string;
  allocated?: number;
  encumbered?: number;
  actualSpent?: number;
  remaining?: number;
};

type POLineItemModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: POLineItem) => void;
  budgetItems: BudgetItem[];
  editingItem?: POLineItem | null;
};

export default function POLineItemModal({
  isOpen,
  onClose,
  onSave,
  budgetItems,
  editingItem,
}: POLineItemModalProps) {
  const [formData, setFormData] = useState<POLineItem>({
    description: '',
    amount: 0,
    budgetItemId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingItem) {
      setFormData({
        id: editingItem.id,
        description: editingItem.description,
        amount: editingItem.amount,
        budgetItemId: editingItem.budgetItemId,
      });
    } else {
      setFormData({
        description: '',
        amount: 0,
        budgetItemId: '',
      });
    }
    setErrors({});
  }, [editingItem, isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!formData.budgetItemId) {
      newErrors.budgetItemId = 'Budget item is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    onSave(formData);
    onClose();
  };

  const handleCancel = () => {
    setFormData({
      description: '',
      amount: 0,
      budgetItemId: '',
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <div className="border-b border-[var(--border-subtle)] px-6 py-4 -mx-6 -mt-6 mb-0">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">
            {editingItem ? 'Edit Line Item' : 'Add Line Item'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="pt-6 space-y-4">
          {/* Description */}
          <div>
            <label className="form-label">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className={`form-input ${
                errors.description ? 'border-[var(--error)]' : ''
              }`}
              placeholder="Enter item description"
            />
            {errors.description && (
              <p className="form-error">{errors.description}</p>
            )}
          </div>

          {/* Budget Item */}
          <div>
            <label className="form-label">
              Budget Item *
            </label>
            <select
              value={formData.budgetItemId}
              onChange={(e) =>
                setFormData({ ...formData, budgetItemId: e.target.value })
              }
              className={`form-input form-select ${
                errors.budgetItemId ? 'border-[var(--error)]' : ''
              }`}
            >
              <option value="">Select budget item</option>
              {budgetItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
            {errors.budgetItemId && (
              <p className="form-error">{errors.budgetItemId}</p>
            )}
            {/* Show available budget */}
            {formData.budgetItemId && (() => {
              const selectedBudget = budgetItems.find(b => b.id === formData.budgetItemId);
              if (selectedBudget && selectedBudget.remaining !== undefined) {
                const isOverBudget = formData.amount > selectedBudget.remaining;
                return (
                  <div className={`mt-2 p-2 rounded-[var(--radius-lg)] text-sm ${isOverBudget ? 'bg-[var(--error-subtle)] border border-[var(--error-muted)]' : 'bg-[var(--info-subtle)] border border-[var(--info-muted)]'}`}>
                    <div className="flex justify-between">
                      <span className="font-medium text-[var(--text-secondary)]">Available Budget:</span>
                      <span className={`font-bold ${isOverBudget ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>
                        ${selectedBudget.remaining.toFixed(2)}
                      </span>
                    </div>
                    {isOverBudget && formData.amount > 0 && (
                      <div className="mt-1 text-[var(--error)] font-medium">
                        ⚠️ Over budget by ${(formData.amount - selectedBudget.remaining).toFixed(2)}
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Amount */}
          <div>
            <label className="form-label">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-[var(--text-muted)]">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                className={`form-input pl-8 ${
                  errors.amount ? 'border-[var(--error)]' : ''
                }`}
                placeholder="0.00"
              />
            </div>
            {errors.amount && (
              <p className="form-error">{errors.amount}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              {editingItem ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
