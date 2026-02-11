'use client';

import { useSession } from 'next-auth/react';
import { useState, useRef } from 'react';

type ImportRow = {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
};

type ValidationResult = {
  entityType: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: ImportRow[];
};

type EntityType = 'users' | 'vendors' | 'budgetItems';

const entityLabels: Record<EntityType, string> = {
  users: 'Users',
  vendors: 'Vendors',
  budgetItems: 'Budget Items',
};

export default function ImportPage() {
  useSession();
  const [entityType, setEntityType] = useState<EntityType>('users');
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [executeResult, setExecuteResult] = useState<{
    created: number;
    errors: { rowNumber: number; error: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setValidation(null);
    setExecuteResult(null);
    setError(null);
  };

  const handleValidate = async () => {
    if (!file) return;

    setValidating(true);
    setError(null);
    setValidation(null);
    setExecuteResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);

      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Validation failed');
        return;
      }

      setValidation(data.result);
    } catch {
      setError('Failed to validate file');
    } finally {
      setValidating(false);
    }
  };

  const handleExecute = async () => {
    if (!file || !validation || validation.validRows === 0) return;

    setExecuting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);

      const res = await fetch('/api/import/execute', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Import failed');
        return;
      }

      setExecuteResult(data.result);
      setValidation(null);
    } catch {
      setError('Import failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.location.href = `/api/import?entityType=${entityType}`;
  };

  const handleReset = () => {
    setFile(null);
    setValidation(null);
    setExecuteResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Import Data</h1>

      {/* Error Banner */}
      {error && (
        <div
          className="mb-6 p-4 rounded-lg border bg-[var(--error)]/10 border-[var(--error)]/30 text-[var(--error)]"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Success Banner */}
      {executeResult && (
        <div
          className="mb-6 p-4 rounded-lg border bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]"
          role="alert"
        >
          <p className="font-medium">
            Import completed: {executeResult.created} {entityLabels[entityType].toLowerCase()} created
            {executeResult.errors.length > 0 && `, ${executeResult.errors.length} errors`}
          </p>
          {executeResult.errors.length > 0 && (
            <ul className="mt-2 text-sm space-y-1">
              {executeResult.errors.map((err, i) => (
                <li key={i}>
                  Row {err.rowNumber}: {err.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Step 1: Select Entity Type */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          1. Select Import Type
        </h2>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(entityLabels) as EntityType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                setEntityType(type);
                handleReset();
              }}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                entityType === type
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--accent-primary)]'
              }`}
            >
              {entityLabels[type]}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <button
            onClick={handleDownloadTemplate}
            className="btn btn-secondary text-sm"
          >
            <svg
              className="w-4 h-4 mr-1 inline"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Download {entityLabels[entityType]} Template
          </button>
        </div>
      </div>

      {/* Step 2: Upload File */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          2. Upload File
        </h2>
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="form-input"
          />
          <p className="text-sm text-[var(--text-muted)]">
            Supported formats: CSV, XLSX, XLS. Maximum 1000 rows, 5MB.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleValidate}
              disabled={!file || validating}
              className="btn btn-primary"
            >
              {validating ? 'Validating...' : 'Validate'}
            </button>
            {(validation || executeResult) && (
              <button onClick={handleReset} className="btn btn-secondary">
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Step 3: Preview & Confirm */}
      {validation && (
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            3. Review & Import
          </h2>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="stat-card">
              <div className="stat-label">Total Rows</div>
              <div className="stat-value">{validation.totalRows}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Valid</div>
              <div className="stat-value text-[var(--success)]">{validation.validRows}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Errors</div>
              <div className="stat-value text-[var(--error)]">{validation.errorRows}</div>
            </div>
          </div>

          {/* Preview Table */}
          <div className="table-container mb-6 max-h-96 overflow-auto">
            <table className="table" aria-label="Import preview">
              <thead>
                <tr>
                  <th scope="col" className="text-left py-2 px-3 text-sm">Row</th>
                  <th scope="col" className="text-left py-2 px-3 text-sm">Status</th>
                  <th scope="col" className="text-left py-2 px-3 text-sm">Data</th>
                  <th scope="col" className="text-left py-2 px-3 text-sm">Errors</th>
                </tr>
              </thead>
              <tbody>
                {validation.rows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={row.valid ? '' : 'bg-[var(--error)]/5'}
                  >
                    <td className="py-2 px-3 text-sm text-[var(--text-secondary)]">
                      {row.rowNumber}
                    </td>
                    <td className="py-2 px-3 text-sm">
                      {row.valid ? (
                        <span className="badge badge-success">Valid</span>
                      ) : (
                        <span className="badge badge-error">Error</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-sm text-[var(--text-primary)]">
                      <div className="max-w-md truncate font-mono text-xs">
                        {Object.entries(row.data)
                          .filter(([, v]) => v)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ')}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-sm text-[var(--error)]">
                      {row.errors.join('; ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Execute Button */}
          {validation.validRows > 0 && (
            <button
              onClick={handleExecute}
              disabled={executing}
              className="btn btn-primary"
            >
              {executing
                ? 'Importing...'
                : `Import ${validation.validRows} ${entityLabels[entityType]}`}
            </button>
          )}
          {validation.validRows === 0 && (
            <p className="text-[var(--error)] text-sm">
              No valid rows to import. Please fix the errors and try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
