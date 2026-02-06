'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';

type BudgetCategory = {
  id: string;
  name: string;
  code: string | null;
};

type Department = {
  id: string;
  name: string;
};

type ExpenseReport = {
  title: string;
  generatedAt: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalExpenses: number;
    receiptCount: number;
    averageExpense: number;
    topCategory: string | null;
    topVendor: string | null;
  };
  byCategory: Array<{
    categoryId: string | null;
    categoryName: string;
    categoryCode: string | null;
    totalAmount: number;
    receiptCount: number;
  }>;
  byVendor: Array<{
    vendorId: string | null;
    vendorName: string;
    totalAmount: number;
    receiptCount: number;
  }>;
  byMonth: Array<{
    month: string;
    totalAmount: number;
    receiptCount: number;
  }>;
};

export default function ReportsPage() {
  const { data: session } = useSession();

  // Filter state
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  // Data state
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Fetch categories and departments on mount
  useEffect(() => {
    async function fetchOptions() {
      try {
        const [catRes, deptRes] = await Promise.all([
          fetch('/api/budget-categories'),
          fetch('/api/departments'),
        ]);
        const catData = await catRes.json();
        const deptData = await deptRes.json();
        setCategories(catData.categories || []);
        setDepartments(deptData.departments || []);
      } catch (error) {
        console.error('Error fetching options:', error);
      }
    }
    fetchOptions();
  }, []);

  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      selectedCategories.forEach((id) => params.append('categoryId', id));
      selectedDepartments.forEach((id) => params.append('departmentId', id));

      const res = await fetch(`/api/reports/expense?${params}`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to generate report');
        return;
      }

      setReport(data);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedCategories, selectedDepartments]);

  const exportReport = async (format: 'csv' | 'excel') => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      selectedCategories.forEach((id) => params.append('categoryId', id));
      selectedDepartments.forEach((id) => params.append('departmentId', id));

      const url = format === 'excel'
        ? `/api/reports/expense/excel?${params}`
        : `/api/reports/expense?${params}&format=csv`;

      const res = await fetch(url);

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to export');
        return;
      }

      // Download the file
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = format === 'excel'
        ? `expense-report-${startDate}-${endDate}.xlsx`
        : `expense-report-${startDate}-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="page-title">Expense Reports</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Generate and export expense reports by date range, category, or department
          </p>
        </div>

        {/* Filters */}
        <div className="card mb-8">
          <h2 className="section-title mb-4">Report Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="form-label">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input text-sm"
              />
            </div>
            <div>
              <label className="form-label">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input text-sm"
              />
            </div>
            <div>
              <label className="form-label">
                Categories
              </label>
              <select
                multiple
                value={selectedCategories}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, (option) => option.value);
                  setSelectedCategories(values);
                }}
                className="form-input text-sm min-h-[80px]"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--text-muted)] mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>
            <div>
              <label className="form-label">
                Departments
              </label>
              <select
                multiple
                value={selectedDepartments}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, (option) => option.value);
                  setSelectedDepartments(values);
                }}
                className="form-input text-sm min-h-[80px]"
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--text-muted)] mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              onClick={generateReport}
              disabled={loading}
              className="btn btn-primary disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                'Generate Report'
              )}
            </button>
            {report && (
              <>
                <button
                  onClick={() => exportReport('csv')}
                  disabled={exporting}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
                <button
                  onClick={() => exportReport('excel')}
                  disabled={exporting}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Excel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Report Results */}
        {report && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="stat-card">
                <div className="stat-value">
                  {formatCurrency(report.summary.totalExpenses)}
                </div>
                <div className="stat-label">Total Expenses</div>
              </div>
              <div className="stat-card stat-card-info">
                <div className="stat-value text-[var(--info)]">
                  {report.summary.receiptCount}
                </div>
                <div className="stat-label">Total Receipts</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {formatCurrency(report.summary.averageExpense)}
                </div>
                <div className="stat-label">Average Expense</div>
              </div>
              <div className="stat-card">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {report.summary.topCategory || 'N/A'}
                </div>
                <div className="stat-label">Top Category</div>
              </div>
            </div>

            {/* Charts/Tables Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* By Category */}
              <div className="card">
                <h3 className="section-title mb-4">Expenses by Category</h3>
                {report.byCategory.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state-title">No data available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {report.byCategory.slice(0, 10).map((cat, idx) => {
                      const percentage = (cat.totalAmount / report.summary.totalExpenses) * 100;
                      return (
                        <div key={cat.categoryId || idx}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-[var(--text-secondary)]">{cat.categoryName}</span>
                            <span className="font-medium">{formatCurrency(cat.totalAmount)}</span>
                          </div>
                          <div className="w-full bg-[var(--bg-surface)] rounded-full h-2">
                            <div
                              className="bg-[var(--info)] h-2 rounded-full"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* By Vendor */}
              <div className="card">
                <h3 className="section-title mb-4">Top Vendors</h3>
                {report.byVendor.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state-title">No data available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {report.byVendor.slice(0, 10).map((vendor, idx) => {
                      const percentage = (vendor.totalAmount / report.summary.totalExpenses) * 100;
                      return (
                        <div key={vendor.vendorId || idx}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-[var(--text-secondary)] truncate mr-2">{vendor.vendorName}</span>
                            <span className="font-medium whitespace-nowrap">{formatCurrency(vendor.totalAmount)}</span>
                          </div>
                          <div className="w-full bg-[var(--bg-surface)] rounded-full h-2">
                            <div
                              className="bg-[var(--success)] h-2 rounded-full"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Monthly Trend */}
            <div className="card mb-8">
              <h3 className="section-title mb-4">Monthly Trend</h3>
              {report.byMonth.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-title">No data available</p>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="lg:hidden space-y-4">
                    {report.byMonth.map((month) => {
                      const maxAmount = Math.max(...report.byMonth.map((m) => m.totalAmount));
                      const percentage = (month.totalAmount / maxAmount) * 100;
                      return (
                        <div key={month.month} className="card">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="text-sm font-bold text-[var(--text-primary)]">{formatMonth(month.month)}</h3>
                            </div>
                            <span className="text-sm font-semibold text-[var(--text-primary)]">
                              {formatCurrency(month.totalAmount)}
                            </span>
                          </div>
                          <div className="space-y-2 text-sm mb-3">
                            <div className="flex justify-between">
                              <span className="text-[var(--text-secondary)]">Receipts:</span>
                              <span className="text-[var(--text-primary)]">{month.receiptCount}</span>
                            </div>
                          </div>
                          <div className="w-full bg-[var(--bg-surface)] rounded-full h-2">
                            <div
                              className="bg-[var(--accent-secondary)] h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                              Month
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                              Total Amount
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                              Receipts
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">

                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.byMonth.map((month) => {
                            const maxAmount = Math.max(...report.byMonth.map((m) => m.totalAmount));
                            const percentage = (month.totalAmount / maxAmount) * 100;
                            return (
                              <tr key={month.month}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  {formatMonth(month.month)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                  {formatCurrency(month.totalAmount)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--text-muted)]">
                                  {month.receiptCount}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="w-32 bg-[var(--bg-surface)] rounded-full h-2">
                                    <div
                                      className="bg-[var(--accent-secondary)] h-2 rounded-full"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Empty State */}
        {!report && !loading && (
          <div className="card empty-state">
            <svg className="mx-auto h-12 w-12 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="empty-state-title">No report generated</h3>
            <p className="empty-state-description">
              Select your filters and click &quot;Generate Report&quot; to view expense data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
