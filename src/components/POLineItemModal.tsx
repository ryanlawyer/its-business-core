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
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="border-b px-6 py-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {editingItem ? 'Edit Line Item' : 'Add Line Item'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter item description"
            />
            {errors.description && (
              <p className="text-red-500 text-xs mt-1">{errors.description}</p>
            )}
          </div>

          {/* Budget Item */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Budget Item *
            </label>
            <select
              value={formData.budgetItemId}
              onChange={(e) =>
                setFormData({ ...formData, budgetItemId: e.target.value })
              }
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                errors.budgetItemId ? 'border-red-500' : 'border-gray-300'
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
              <p className="text-red-500 text-xs mt-1">{errors.budgetItemId}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
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
                className={`w-full pl-8 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0.00"
              />
            </div>
            {errors.amount && (
              <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-semibold transition-colors"
            >
              {editingItem ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
