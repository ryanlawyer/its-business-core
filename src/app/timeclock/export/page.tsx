'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface PayPeriod {
  start: string;
  end: string;
  label: string;
}

interface Department {
  id: string;
  name: string;
}

interface ExportTemplate {
  id: string;
  name: string;
  isDefault: boolean;
}

interface PreviewRow {
  employeeId: string;
  employeeName: string;
  department: string;
  regularHours: string;
  dailyOvertimeHours: string;
  weeklyOvertimeHours: string;
  totalHours: string;
}

export default function ExportPage() {
  const { status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Options
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);

  // Selection state
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('csv');

  // Preview and warnings
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Generate pay periods (last 6 periods)
  const generatePayPeriods = useCallback(() => {
    const periods: PayPeriod[] = [];
    const today = new Date();

    // Simple biweekly periods for demo - in real app, fetch from config
    for (let i = 0; i < 6; i++) {
      const endDate = new Date(today);
      endDate.setDate(today.getDate() - (i * 14));
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 13);

      periods.push({
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        label: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      });
    }

    return periods;
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch departments
      const deptRes = await fetch('/api/departments');
      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData.departments || []);
      }

      // Fetch templates
      const templatesRes = await fetch('/api/timeclock/templates');
      if (templatesRes.status === 403) {
        router.push('/');
        return;
      }
      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setTemplates(templatesData.templates || []);
        // Set default template if available
        const defaultTemplate = templatesData.templates?.find((t: ExportTemplate) => t.isDefault);
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate.id);
        }
      }

      // Generate pay periods
      setPayPeriods(generatePayPeriods());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [router, generatePayPeriods]);

  const fetchPreview = useCallback(async () => {
    if (payPeriods.length === 0) return;

    const period = payPeriods[selectedPeriodIndex];
    if (!period) return;

    try {
      setLoadingPreview(true);

      // Fetch preview data (using JSON response)
      const params = new URLSearchParams({
        format: 'json',
        periodStart: period.start,
        periodEnd: period.end,
      });

      if (selectedDepartment !== 'all') {
        params.set('departmentId', selectedDepartment);
      }

      if (selectedTemplate) {
        params.set('templateId', selectedTemplate);
      }

      const res = await fetch(`/api/timeclock/export?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewRows((data.rows || []).slice(0, 5));
      }

      // Fetch pending count
      const pendingParams = new URLSearchParams({
        periodStart: period.start,
        periodEnd: period.end,
      });

      if (selectedDepartment !== 'all') {
        pendingParams.set('departmentId', selectedDepartment);
      }

      const pendingRes = await fetch(`/api/timeclock/pending?${pendingParams}`);
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingCount(pendingData.totalCount || 0);
      }
    } catch (err) {
      console.error('Error fetching preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  }, [payPeriods, selectedPeriodIndex, selectedDepartment, selectedTemplate]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchOptions();
    }
  }, [status, fetchOptions]);

  useEffect(() => {
    if (!loading && payPeriods.length > 0) {
      fetchPreview();
    }
  }, [loading, payPeriods, selectedPeriodIndex, selectedDepartment, selectedTemplate, fetchPreview]);

  const handleExport = async () => {
    const period = payPeriods[selectedPeriodIndex];
    if (!period) return;

    try {
      setExporting(true);
      setError(null);

      const params = new URLSearchParams({
        format: selectedFormat,
        periodStart: period.start,
        periodEnd: period.end,
      });

      if (selectedDepartment !== 'all') {
        params.set('departmentId', selectedDepartment);
      }

      if (selectedTemplate) {
        params.set('templateId', selectedTemplate);
      }

      const res = await fetch(`/api/timeclock/export?${params}`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Export failed');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = `export.${selectedFormat}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Download the file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
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

  const selectedPeriod = payPeriods[selectedPeriodIndex];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="page-title mb-6">Export Timeclock Data</h1>

      {error && (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--error-muted)] bg-[var(--error-subtle)] text-[var(--error)] px-4 py-3">
          {error}
        </div>
      )}

      {/* Warning banner for pending entries */}
      {pendingCount > 0 && (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--warning-muted)] bg-[var(--warning-subtle)] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[var(--warning)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">
                {pendingCount} pending {pendingCount === 1 ? 'entry' : 'entries'} in this period
              </span>
            </div>
            <Link
              href="/timeclock/approvals"
              className="text-sm text-[var(--warning)] hover:text-[var(--warning)] underline"
            >
              View pending entries
            </Link>
          </div>
          <p className="mt-1 text-sm text-[var(--warning)]">
            Only approved entries are included in exports. Approve pending entries before exporting for complete data.
          </p>
        </div>
      )}

      <div className="card p-6 space-y-6">
        {/* Period Selector */}
        <div>
          <label className="form-label">
            Pay Period
          </label>
          <select
            value={selectedPeriodIndex}
            onChange={(e) => setSelectedPeriodIndex(parseInt(e.target.value))}
            className="form-input form-select"
          >
            {payPeriods.map((period, index) => (
              <option key={period.start} value={index}>
                {period.label}
              </option>
            ))}
          </select>
        </div>

        {/* Department Filter */}
        <div>
          <label className="form-label">
            Department
          </label>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="form-input form-select"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        {/* Template Selector */}
        <div>
          <label className="form-label">
            Export Template
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="form-input form-select"
          >
            <option value="">Default Template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} {template.isDefault ? '(Default)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Format Selector */}
        <div>
          <label className="form-label">
            Export Format
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="format"
                value="csv"
                checked={selectedFormat === 'csv'}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="h-4 w-4 text-[var(--accent-primary)]"
              />
              <span className="text-sm">CSV</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="format"
                value="xlsx"
                checked={selectedFormat === 'xlsx'}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="h-4 w-4 text-[var(--accent-primary)]"
              />
              <span className="text-sm">Excel (.xlsx)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="format"
                value="pdf"
                checked={selectedFormat === 'pdf'}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="h-4 w-4 text-[var(--accent-primary)]"
              />
              <span className="text-sm">PDF Timesheets</span>
            </label>
          </div>
        </div>

        {/* Preview Table */}
        <div>
          <label className="form-label mb-2">
            Preview (First 5 Rows)
          </label>
          {loadingPreview ? (
            <div className="animate-pulse h-32 bg-[var(--bg-hover)] rounded"></div>
          ) : previewRows.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">No approved entries found for this period</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {previewRows.map((row, idx) => (
                  <div key={idx} className="card">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">{row.employeeName}</h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{row.department}</p>
                      </div>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{row.totalHours}h</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Regular:</span>
                        <span className="text-[var(--text-primary)]">{row.regularHours}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Daily OT:</span>
                        <span className="text-[var(--text-primary)]">{row.dailyOvertimeHours}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Weekly OT:</span>
                        <span className="text-[var(--text-primary)]">{row.weeklyOvertimeHours}h</span>
                      </div>
                      <div className="flex justify-between border-t border-[var(--border-default)] pt-2">
                        <span className="text-[var(--text-secondary)] font-medium">Total:</span>
                        <span className="text-[var(--text-primary)] font-medium">{row.totalHours}h</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block table-container">
                <table className="table" aria-label="Time clock export preview">
                  <thead>
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase">Name</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase">Dept</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium uppercase">Regular</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium uppercase">Daily OT</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium uppercase">Weekly OT</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm text-[var(--text-primary)]">{row.employeeName}</td>
                        <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{row.department}</td>
                        <td className="px-4 py-2 text-sm text-[var(--text-primary)] text-right">{row.regularHours}</td>
                        <td className="px-4 py-2 text-sm text-[var(--text-primary)] text-right">{row.dailyOvertimeHours}</td>
                        <td className="px-4 py-2 text-sm text-[var(--text-primary)] text-right">{row.weeklyOvertimeHours}</td>
                        <td className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] text-right">{row.totalHours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Export Button */}
        <div className="pt-4 border-t border-[var(--border-default)]">
          <button
            onClick={handleExport}
            disabled={exporting || previewRows.length === 0}
            className="btn btn-primary w-full py-3 font-medium"
          >
            {exporting ? 'Exporting...' : 'Export & Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
