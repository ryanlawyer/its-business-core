'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

interface TemplateColumn {
  sourceField: string;
  headerName: string;
  order: number;
}

interface AvailableField {
  field: string;
  label: string;
}

interface ExportTemplate {
  id: string;
  name: string;
  columns: TemplateColumn[];
  isDefault: boolean;
  createdById: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function TemplateEditorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editor state
  const [editingTemplate, setEditingTemplate] = useState<ExportTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formColumns, setFormColumns] = useState<TemplateColumn[]>([]);
  const [formIsDefault, setFormIsDefault] = useState(false);

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/timeclock/templates');
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          router.push('/');
          return;
        }
        throw new Error(data.error || 'Failed to fetch templates');
      }

      setTemplates(data.templates);
      setAvailableFields(data.availableFields);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchTemplates();
    }
  }, [status, fetchTemplates]);

  const resetForm = () => {
    setFormName('');
    setFormColumns([]);
    setFormIsDefault(false);
    setEditingTemplate(null);
    setIsCreating(false);
  };

  const handleCreate = () => {
    resetForm();
    setIsCreating(true);
    // Start with a default column
    setFormColumns([
      { sourceField: 'employeeName', headerName: 'Employee Name', order: 0 },
    ]);
  };

  const handleEdit = (template: ExportTemplate) => {
    setEditingTemplate(template);
    setIsCreating(false);
    setFormName(template.name);
    setFormColumns([...template.columns].sort((a, b) => a.order - b.order));
    setFormIsDefault(template.isDefault);
  };

  const handleDelete = async (template: ExportTemplate) => {
    if (!confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      return;
    }

    try {
      setError(null);
      const res = await fetch(`/api/timeclock/templates/${template.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete template');
      }

      setSuccess('Template deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      fetchTemplates();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setError('Template name is required');
      return;
    }

    if (formColumns.length === 0) {
      setError('At least one column is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const columnsWithOrder = formColumns.map((col, index) => ({
        ...col,
        order: index,
      }));

      const body = {
        name: formName.trim(),
        columns: columnsWithOrder,
        isDefault: formIsDefault,
      };

      let res: Response;
      if (editingTemplate) {
        res = await fetch(`/api/timeclock/templates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/timeclock/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save template');
      }

      setSuccess(editingTemplate ? 'Template updated successfully' : 'Template created successfully');
      setTimeout(() => setSuccess(null), 3000);
      resetForm();
      fetchTemplates();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addColumn = () => {
    // Find first field not already used
    const usedFields = new Set(formColumns.map((c) => c.sourceField));
    const availableField = availableFields.find((f) => !usedFields.has(f.field));

    if (!availableField) {
      setError('All available fields are already added');
      return;
    }

    setFormColumns([
      ...formColumns,
      {
        sourceField: availableField.field,
        headerName: availableField.label,
        order: formColumns.length,
      },
    ]);
  };

  const removeColumn = (index: number) => {
    setFormColumns(formColumns.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, field: keyof TemplateColumn, value: string) => {
    const updated = [...formColumns];
    if (field === 'sourceField') {
      updated[index].sourceField = value;
      // Auto-update header name to match field label
      const fieldDef = availableFields.find((f) => f.field === value);
      if (fieldDef) {
        updated[index].headerName = fieldDef.label;
      }
    } else if (field === 'headerName') {
      updated[index].headerName = value;
    }
    setFormColumns(updated);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updated = [...formColumns];
    const [removed] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, removed);
    setFormColumns(updated);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const isEditing = isCreating || editingTemplate !== null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Export Templates</h1>
        {!isEditing && (
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Create Template
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
          {success}
        </div>
      )}

      {isEditing ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingTemplate ? 'Edit Template' : 'Create New Template'}
          </h2>

          <div className="space-y-4">
            {/* Template Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Payroll Export, ADP Format"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Set as Default */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
              />
              <label htmlFor="isDefault" className="text-sm text-gray-700">
                Set as default template
              </label>
            </div>

            {/* Column Mapper */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Columns
                </label>
                <button
                  onClick={addColumn}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Column
                </button>
              </div>

              <div className="space-y-2">
                {formColumns.map((col, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 p-2 border rounded-md bg-gray-50 cursor-move ${
                      draggedIndex === index ? 'opacity-50 border-blue-400' : 'border-gray-200'
                    }`}
                  >
                    {/* Drag Handle */}
                    <div className="text-gray-400 cursor-grab">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>

                    {/* Source Field Dropdown */}
                    <select
                      value={col.sourceField}
                      onChange={(e) => updateColumn(index, 'sourceField', e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      {availableFields.map((field) => (
                        <option key={field.field} value={field.field}>
                          {field.label}
                        </option>
                      ))}
                    </select>

                    {/* Arrow */}
                    <span className="text-gray-400">→</span>

                    {/* Header Name Input */}
                    <input
                      type="text"
                      value={col.headerName}
                      onChange={(e) => updateColumn(index, 'headerName', e.target.value)}
                      placeholder="Column Header"
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    />

                    {/* Remove Button */}
                    <button
                      onClick={() => removeColumn(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Remove column"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                {formColumns.length === 0 && (
                  <div className="text-center py-4 text-gray-500 border border-dashed border-gray-300 rounded-md">
                    No columns added. Click &quot;+ Add Column&quot; to begin.
                  </div>
                )}
              </div>
            </div>

            {/* Preview */}
            {formColumns.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Column Preview
                </label>
                <div className="overflow-x-auto border border-gray-200 rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        {formColumns.map((col, index) => (
                          <th
                            key={index}
                            className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                          >
                            {col.headerName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      <tr>
                        {formColumns.map((col, index) => (
                          <td key={index} className="px-4 py-2 text-sm text-gray-400 italic">
                            {col.sourceField}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          {templates.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-4">No export templates found.</p>
              <button
                onClick={handleCreate}
                className="text-blue-600 hover:text-blue-800"
              >
                Create your first template
              </button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Columns
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Default
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{template.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.columns.length} column{template.columns.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {template.isDefault ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Default
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.createdBy.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(template)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(template)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
