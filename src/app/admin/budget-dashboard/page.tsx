'use client';

import { useEffect, useState } from 'react';

interface BudgetSummary {
  totalBudget: number;
  totalEncumbered: number;
  totalActualSpent: number;
  totalRemaining: number;
  totalAvailable: number;
}

interface VarianceItem {
  code: string;
  description: string;
  budgetAmount: number;
  encumbered: number;
  actualSpent: number;
  remaining: number;
  variance: number;
  variancePercent: number;
}

interface DepartmentSummary {
  departmentId: string;
  departmentName: string;
  budgetAmount: number;
  encumbered: number;
  actualSpent: number;
  remaining: number;
  itemCount: number;
}

interface YoYComparison {
  year: number;
  totalBudget: number;
  totalSpent: number;
  utilizationPercent: number;
}

export default function BudgetDashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'variance' | 'department' | 'yoy'>('overview');
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [varianceData, setVarianceData] = useState<VarianceItem[]>([]);
  const [departmentData, setDepartmentData] = useState<DepartmentSummary[]>([]);
  const [yoyData, setYoyData] = useState<YoYComparison[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [fiscalYear]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/budget-dashboard?fiscalYear=${fiscalYear}`);
      if (!res.ok) throw new Error('Failed to load dashboard data');

      const data = await res.json();
      setSummary(data.summary);
      setVarianceData(data.variance || []);
      setDepartmentData(data.departments || []);
      setYoyData(data.yoy || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent.toFixed(1)}%`;
  };

  const handleExportCSV = () => {
    let csvContent = '';
    let filename = '';

    if (activeTab === 'variance') {
      csvContent = 'Code,Description,Budget,Encumbered,Actual Spent,Remaining,Variance,Variance %\n';
      varianceData.forEach(item => {
        csvContent += `"${item.code}","${item.description}",${item.budgetAmount},${item.encumbered},${item.actualSpent},${item.remaining},${item.variance},${item.variancePercent}\n`;
      });
      filename = `budget-variance-${fiscalYear}.csv`;
    } else if (activeTab === 'department') {
      csvContent = 'Department,Budget,Encumbered,Actual Spent,Remaining,Item Count\n';
      departmentData.forEach(dept => {
        csvContent += `"${dept.departmentName}",${dept.budgetAmount},${dept.encumbered},${dept.actualSpent},${dept.remaining},${dept.itemCount}\n`;
      });
      filename = `budget-by-department-${fiscalYear}.csv`;
    } else if (activeTab === 'yoy') {
      csvContent = 'Year,Total Budget,Total Spent,Utilization %\n';
      yoyData.forEach(year => {
        csvContent += `${year.year},${year.totalBudget},${year.totalSpent},${year.utilizationPercent}\n`;
      });
      filename = `budget-year-over-year.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-4 text-[var(--text-secondary)]">Loading dashboard...</div>;
  if (error) return <div className="p-4 text-[var(--error)]">Error: {error}</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title">Budget Dashboard</h1>
        <div className="flex gap-4 items-center">
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value))}
            className="form-input form-select"
          >
            <option value={new Date().getFullYear() - 2}>{new Date().getFullYear() - 2}</option>
            <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
            <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
          </select>
          {activeTab !== 'overview' && (
            <button
              onClick={handleExportCSV}
              className="btn btn-success"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border-default)] mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('variance')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'variance'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)]'
            }`}
          >
            Variance Analysis
          </button>
          <button
            onClick={() => setActiveTab('department')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'department'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)]'
            }`}
          >
            By Department
          </button>
          <button
            onClick={() => setActiveTab('yoy')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'yoy'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)]'
            }`}
          >
            Year-over-Year
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="stat-card stat-card-info border-l-4 border-l-[var(--info)]">
            <div className="stat-label">Total Budget</div>
            <div className="stat-value">{formatCurrency(summary.totalBudget)}</div>
          </div>
          <div className="stat-card stat-card-accent border-l-4 border-l-[var(--warning)]">
            <div className="stat-label">Encumbered</div>
            <div className="stat-value">{formatCurrency(summary.totalEncumbered)}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              {formatPercent((summary.totalEncumbered / summary.totalBudget) * 100)} of budget
            </div>
          </div>
          <div className="stat-card stat-card-error border-l-4 border-l-[var(--error)]">
            <div className="stat-label">Actual Spent</div>
            <div className="stat-value">{formatCurrency(summary.totalActualSpent)}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              {formatPercent((summary.totalActualSpent / summary.totalBudget) * 100)} of budget
            </div>
          </div>
          <div className="stat-card stat-card-success border-l-4 border-l-[var(--success)]">
            <div className="stat-label">Available</div>
            <div className="stat-value">{formatCurrency(summary.totalAvailable)}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              {formatPercent((summary.totalAvailable / summary.totalBudget) * 100)} of budget
            </div>
          </div>
        </div>
      )}

      {/* Variance Tab */}
      {activeTab === 'variance' && (
        <>
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {varianceData.map((item, idx) => (
              <div key={idx} className={`card ${item.variance < 0 ? 'border-l-4 border-l-[var(--error)]' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">{item.code}</h3>
                    <p className="text-sm text-[var(--text-secondary)]">{item.description}</p>
                  </div>
                  <span className={`text-sm font-semibold ${item.variance < 0 ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>
                    {formatPercent(item.variancePercent)}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Budget:</span>
                    <span className="text-[var(--text-primary)]">{formatCurrency(item.budgetAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Encumbered:</span>
                    <span className="text-[var(--text-primary)]">{formatCurrency(item.encumbered)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Actual Spent:</span>
                    <span className="text-[var(--text-primary)]">{formatCurrency(item.actualSpent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Remaining:</span>
                    <span className="text-[var(--text-primary)]">{formatCurrency(item.remaining)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[var(--border-default)] pt-2">
                    <span className="text-[var(--text-secondary)]">Variance:</span>
                    <span className={`font-semibold ${item.variance < 0 ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>
                      {formatCurrency(item.variance)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {varianceData.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-title">No variance data available</p>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block table-container">
            <table className="table" aria-label="Budget variance analysis">
              <thead>
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">Code</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">Description</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Budget</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Encumbered</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Actual</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Remaining</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Variance</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Variance %</th>
                </tr>
              </thead>
              <tbody>
                {varianceData.map((item, idx) => (
                  <tr key={idx} className={item.variance < 0 ? 'bg-[var(--error-subtle)]' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{item.code}</td>
                    <td className="px-6 py-4">{item.description}</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(item.budgetAmount)}</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(item.encumbered)}</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(item.actualSpent)}</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(item.remaining)}</td>
                    <td className={`px-6 py-4 text-right font-semibold ${item.variance < 0 ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>
                      {formatCurrency(item.variance)}
                    </td>
                    <td className={`px-6 py-4 text-right ${item.variancePercent < 0 ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>
                      {formatPercent(item.variancePercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {varianceData.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-title">No variance data available</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Department Tab */}
      {activeTab === 'department' && (
        <>
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {departmentData.map((dept) => {
              const utilization = ((dept.encumbered + dept.actualSpent) / dept.budgetAmount) * 100;
              return (
                <div key={dept.departmentId} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">{dept.departmentName}</h3>
                      <p className="text-sm text-[var(--text-secondary)]">{dept.itemCount} budget item{dept.itemCount !== 1 ? 's' : ''}</p>
                    </div>
                    <span className={`text-sm font-semibold ${utilization > 90 ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>
                      {formatPercent(utilization)} used
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Budget:</span>
                      <span className="text-[var(--text-primary)]">{formatCurrency(dept.budgetAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Encumbered:</span>
                      <span className="text-[var(--text-primary)]">{formatCurrency(dept.encumbered)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Actual Spent:</span>
                      <span className="text-[var(--text-primary)]">{formatCurrency(dept.actualSpent)}</span>
                    </div>
                    <div className="flex justify-between border-t border-[var(--border-default)] pt-2">
                      <span className="text-[var(--text-secondary)]">Remaining:</span>
                      <span className="text-[var(--text-primary)] font-semibold">{formatCurrency(dept.remaining)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {departmentData.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-title">No department data available</p>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block table-container">
            <table className="table" aria-label="Department budget breakdown">
              <thead>
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">Department</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Budget</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Encumbered</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Actual Spent</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Remaining</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Items</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {departmentData.map((dept) => {
                  const utilization = ((dept.encumbered + dept.actualSpent) / dept.budgetAmount) * 100;
                  return (
                    <tr key={dept.departmentId}>
                      <td className="px-6 py-4 font-medium">{dept.departmentName}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(dept.budgetAmount)}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(dept.encumbered)}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(dept.actualSpent)}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(dept.remaining)}</td>
                      <td className="px-6 py-4 text-right">{dept.itemCount}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={utilization > 90 ? 'text-[var(--error)] font-semibold' : ''}>
                          {formatPercent(utilization)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {departmentData.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-title">No department data available</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Year-over-Year Tab */}
      {activeTab === 'yoy' && (
        <>
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {yoyData.map((year, idx) => {
              const prevYear = idx > 0 ? yoyData[idx - 1] : null;
              const budgetChange = prevYear && prevYear.totalBudget > 0
                ? ((year.totalBudget - prevYear.totalBudget) / prevYear.totalBudget) * 100
                : null;
              return (
                <div key={year.year} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">FY {year.year}</h3>
                    {prevYear ? (
                      budgetChange !== null ? (
                        <span className={`text-sm font-semibold ${budgetChange > 0 ? 'text-[var(--success)]' : budgetChange < 0 ? 'text-[var(--error)]' : 'text-[var(--text-secondary)]'}`}>
                          {budgetChange > 0 ? '+' : ''}{formatPercent(budgetChange)} YoY
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">N/A</span>
                      )
                    ) : (
                      <span className="text-sm text-[var(--text-muted)]">Baseline</span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Total Budget:</span>
                      <span className="text-[var(--text-primary)]">{formatCurrency(year.totalBudget)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Total Spent:</span>
                      <span className="text-[var(--text-primary)]">{formatCurrency(year.totalSpent)}</span>
                    </div>
                    <div className="flex justify-between border-t border-[var(--border-default)] pt-2">
                      <span className="text-[var(--text-secondary)]">Utilization:</span>
                      <span className="text-[var(--text-primary)] font-semibold">{formatPercent(year.utilizationPercent)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {yoyData.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-title">No historical data available</p>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block table-container">
            <table className="table" aria-label="Year-over-year budget comparison">
              <thead>
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">Fiscal Year</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Total Budget</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Total Spent</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Utilization %</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">YoY Change</th>
                </tr>
              </thead>
              <tbody>
                {yoyData.map((year, idx) => {
                  const prevYear = idx > 0 ? yoyData[idx - 1] : null;
                  const budgetChange = prevYear && prevYear.totalBudget > 0
                    ? ((year.totalBudget - prevYear.totalBudget) / prevYear.totalBudget) * 100
                    : null;
                  return (
                    <tr key={year.year}>
                      <td className="px-6 py-4 font-medium">{year.year}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(year.totalBudget)}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(year.totalSpent)}</td>
                      <td className="px-6 py-4 text-right">{formatPercent(year.utilizationPercent)}</td>
                      <td className="px-6 py-4 text-right">
                        {prevYear ? (
                          budgetChange !== null ? (
                            <span className={budgetChange > 0 ? 'text-[var(--success)]' : budgetChange < 0 ? 'text-[var(--error)]' : ''}>
                              {budgetChange > 0 ? '+' : ''}{formatPercent(budgetChange)}
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)]">N/A</span>
                          )
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {yoyData.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-title">No historical data available</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
