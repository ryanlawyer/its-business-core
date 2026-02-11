'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';

type BudgetVarianceItem = {
  id: string;
  code: string;
  description: string;
  categoryName: string | null;
  categoryCode: string | null;
  departmentName: string | null;
  budgetAmount: number;
  encumbered: number;
  actualSpent: number;
  available: number;
  variance: number;
  variancePercent: number;
};

type GroupSubtotal = {
  budget: number;
  spent: number;
  encumbered: number;
  available: number;
};

type BudgetVarianceReport = {
  fiscalYear: number;
  summary: {
    totalBudget: number;
    totalSpent: number;
    totalEncumbered: number;
    totalAvailable: number;
  };
  items: BudgetVarianceItem[];
  byCategory: Record<string, GroupSubtotal>;
  byDepartment: Record<string, GroupSubtotal>;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function getVarianceColor(variancePercent: number): string {
  if (variancePercent < 0) return 'text-[var(--error)]';
  if (variancePercent <= 10) return 'text-[var(--warning)]';
  return 'text-[var(--success)]';
}

function getVarianceBadge(variancePercent: number): string {
  if (variancePercent < 0) return 'badge badge-error';
  if (variancePercent <= 10) return 'badge badge-warning';
  return 'badge badge-success';
}

export default function BudgetVariancePage() {
  const { data: session } = useSession();
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [report, setReport] = useState<BudgetVarianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports/budget-variance?fiscalYear=${fiscalYear}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      } else {
        setReport(null);
      }
    } catch (error) {
      console.error('Error fetching budget variance report:', error);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res = await fetch(`/api/reports/budget-variance?fiscalYear=${fiscalYear}&format=csv`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget-variance-${fiscalYear}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
    } finally {
      setExporting(false);
    }
  };

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading report...</div>
      </div>
    );
  }

  // Generate fiscal year options
  const fiscalYears = [];
  for (let y = 2023; y <= 2026; y++) {
    fiscalYears.push(y);
  }

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="page-title">Budget Variance Report</h1>
        <div className="flex items-center gap-3">
          <div>
            <label htmlFor="fiscalYear" className="form-label sr-only">
              Fiscal Year
            </label>
            <select
              id="fiscalYear"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))}
              className="form-input form-select"
            >
              {fiscalYears.map((y) => (
                <option key={y} value={y}>
                  FY {y}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={exporting || !report?.items.length}
            className="btn btn-secondary"
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {!report || report.items.length === 0 ? (
        <div className="card p-12 text-center text-[var(--text-muted)]">
          No budget items found for FY {fiscalYear}.
        </div>
      ) : (
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="stat-card">
              <div className="stat-label">Total Budget</div>
              <div className="stat-value">
                {formatCurrency(report.summary.totalBudget)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Actual Spent</div>
              <div className="stat-value">
                {formatCurrency(report.summary.totalSpent)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Encumbered</div>
              <div className="stat-value text-[var(--warning)]">
                {formatCurrency(report.summary.totalEncumbered)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Available</div>
              <div className={`stat-value ${report.summary.totalAvailable >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                {formatCurrency(report.summary.totalAvailable)}
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-[var(--border-default)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Budget Line Items ({report.items.length})
              </h2>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4 p-4">
              {report.items.map((item) => (
                <div key={item.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--accent-primary)]">
                        {item.code}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {item.description}
                      </p>
                    </div>
                    <span className={getVarianceBadge(item.variancePercent)}>
                      {item.variancePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    {item.categoryName && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Category:</span>
                        <span className="text-[var(--text-primary)]">{item.categoryName}</span>
                      </div>
                    )}
                    {item.departmentName && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Department:</span>
                        <span className="text-[var(--text-primary)]">{item.departmentName}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Budget:</span>
                      <span className="text-[var(--text-primary)] font-medium">
                        {formatCurrency(item.budgetAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Encumbered:</span>
                      <span className="text-[var(--warning)]">
                        {formatCurrency(item.encumbered)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Spent:</span>
                      <span className="text-[var(--text-primary)]">
                        {formatCurrency(item.actualSpent)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-[var(--border-default)] pt-2">
                      <span className="text-[var(--text-secondary)] font-medium">Available:</span>
                      <span className={`font-medium ${item.available >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                        {formatCurrency(item.available)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block table-container">
              <table className="table" aria-label="Budget variance report">
                <thead>
                  <tr>
                    <th scope="col" className="text-left py-3 px-4">Code</th>
                    <th scope="col" className="text-left py-3 px-4">Description</th>
                    <th scope="col" className="text-left py-3 px-4">Category</th>
                    <th scope="col" className="text-left py-3 px-4">Department</th>
                    <th scope="col" className="text-right py-3 px-4">Budget</th>
                    <th scope="col" className="text-right py-3 px-4">Encumbered</th>
                    <th scope="col" className="text-right py-3 px-4">Spent</th>
                    <th scope="col" className="text-right py-3 px-4">Available</th>
                    <th scope="col" className="text-right py-3 px-4">Variance %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 px-4 text-sm font-medium text-[var(--accent-primary)]">
                        {item.code}
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--text-primary)]">
                        {item.description}
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">
                        {item.categoryName || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">
                        {item.departmentName || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--text-primary)] text-right">
                        {formatCurrency(item.budgetAmount)}
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--warning)] text-right">
                        {formatCurrency(item.encumbered)}
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--text-primary)] text-right">
                        {formatCurrency(item.actualSpent)}
                      </td>
                      <td className={`py-3 px-4 text-sm text-right font-medium ${item.available >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                        {formatCurrency(item.available)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        <span className={getVarianceColor(item.variancePercent)}>
                          {item.variancePercent.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
