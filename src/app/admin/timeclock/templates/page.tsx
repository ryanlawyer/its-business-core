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
          <div className="h-8 bg-[var(--bg-hover)] rounded w-1/4"></div>
          <div className="h-64 bg-[var(--bg-hover)] rounded"></div>
        </div>
      </div>
    );
  }

  const isEditing = isCreating || editingTemplate !== null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Export Templates</h1>
        {!isEditing && (
          <button
            onClick={handleCreate}
            className="btn btn-primary"
          >
            Create Template
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--error-muted)] bg-[var(--error-subtle)] text-[var(--error)] px-4 py-3">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--success-muted)] bg-[var(--success-subtle)] text-[var(--success)] px-4 py-3">
          {success}
        </div>
      )}

      {isEditing ? (
        <div className="card p-6">
          <h2 className="section-title mb-4">
            {editingTemplate ? 'Edit Template' : 'Create New Template'}
          </h2>

          <div className="space-y-4">
            {/* Template Name */}
            <div>
              <label className="form-label">
                Template Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Payroll Export, ADP Format"
                className="form-input"
              />
            </div>

            {/* Set as Default */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
                className="h-4 w-4 text-[var(--accent-primary)] rounded border-[var(--border-default)]"
              />
              <label htmlFor="isDefault" className="text-sm text-[var(--text-secondary)]">
                Set as default template
              </label>
            </div>

            {/* Column Mapper */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="form-label">
                  Columns
                </label>
                <button
                  onClick={addColumn}
                  className="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
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
                    className={`flex items-center gap-2 p-2 border rounded-md cursor-move ${
                      draggedIndex === index ? 'opacity-50 border-[var(--accent-primary)]' : 'border-[var(--border-default)]'
                    }`}
                  >
                    {/* Drag Handle */}
                    <div className="text-[var(--text-muted)] cursor-grab">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>

                    {/* Source Field Dropdown */}
                    <select
                      value={col.sourceField}
                      onChange={(e) => updateColumn(index, 'sourceField', e.target.value)}
                      className="flex-1 px-2 py-1 border border-[var(--border-default)] rounded text-sm bg-transparent"
                    >
                      {availableFields.map((field) => (
                        <option key={field.field} value={field.field}>
                          {field.label}
                        </option>
                      ))}
                    </select>

                    {/* Arrow */}
                    <span className="text-[var(--text-muted)]">&rarr;</span>

                    {/* Header Name Input */}
                    <input
                      type="text"
                      value={col.headerName}
                      onChange={(e) => updateColumn(index, 'headerName', e.target.value)}
                      placeholder="Column Header"
                      className="flex-1 px-2 py-1 border border-[var(--border-default)] rounded text-sm bg-transparent"
                    />

                    {/* Remove Button */}
                    <button
                      onClick={() => removeColumn(index)}
                      className="text-[var(--error)] hover:text-[var(--error)] p-1"
                      title="Remove column"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                {formColumns.length === 0 && (
                  <div className="text-center py-4 text-[var(--text-muted)] border border-dashed border-[var(--border-default)] rounded-md">
                    No columns added. Click &quot;+ Add Column&quot; to begin.
                  </div>
                )}
              </div>
            </div>

            {/* Preview */}
            {formColumns.length > 0 && (
              <div>
                <label className="form-label mb-2">
                  Column Preview
                </label>
                <div className="table-container">
                  <table className="table" aria-label="Export template column preview">
                    <thead>
                      <tr>
                        {formColumns.map((col, index) => (
                          <th
                            key={index}
                            scope="col"
                            className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider"
                          >
                            {col.headerName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {formColumns.map((col, index) => (
                          <td key={index} className="px-4 py-2 text-sm text-[var(--text-muted)] italic">
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
            <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-default)]">
              <button
                onClick={resetForm}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          {templates.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">No export templates found</p>
              <p className="empty-state-description">
                <button
                  onClick={handleCreate}
                  className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                >
                  Create your first template
                </button>
              </p>
            </div>
          ) : (
            <>
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4 p-4">
              {templates.map((template) => (
                <div key={template.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">{template.name}</h3>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {template.columns.length} column{template.columns.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {template.isDefault && (
                      <span className="badge badge-success">Default</span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Created By:</span>
                      <span className="text-[var(--text-primary)]">{template.createdBy.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Columns:</span>
                      <span className="text-[var(--text-primary)]">
                        {template.columns.map((c) => c.headerName).join(', ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-[var(--border-default)]">
                    <button
                      onClick={() => handleEdit(template)}
                      className="btn btn-secondary flex-1"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(template)}
                      className="btn btn-danger flex-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block table-container">
              <table className="table" aria-label="Export templates">
                <thead>
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Columns
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Default
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Created By
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-[var(--text-primary)]">{template.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-muted)]">
                        {template.columns.length} column{template.columns.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {template.isDefault ? (
                          <span className="badge badge-success">
                            Default
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-muted)]">
                        {template.createdBy.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(template)}
                          className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(template)}
                          className="text-[var(--error)] hover:text-[var(--error)]"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
