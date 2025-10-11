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

  if (loading) return <div className="p-4">Loading dashboard...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Budget Dashboard</h1>
        <div className="flex gap-4 items-center">
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value))}
            className="px-3 py-2 border rounded"
          >
            <option value={new Date().getFullYear() - 2}>{new Date().getFullYear() - 2}</option>
            <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
            <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
          </select>
          {activeTab !== 'overview' && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('variance')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'variance'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:border-gray-300'
            }`}
          >
            Variance Analysis
          </button>
          <button
            onClick={() => setActiveTab('department')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'department'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:border-gray-300'
            }`}
          >
            By Department
          </button>
          <button
            onClick={() => setActiveTab('yoy')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'yoy'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:border-gray-300'
            }`}
          >
            Year-over-Year
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
            <div className="text-sm text-gray-600 mb-1">Total Budget</div>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalBudget)}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
            <div className="text-sm text-gray-600 mb-1">Encumbered</div>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalEncumbered)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatPercent((summary.totalEncumbered / summary.totalBudget) * 100)} of budget
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
            <div className="text-sm text-gray-600 mb-1">Actual Spent</div>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalActualSpent)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatPercent((summary.totalActualSpent / summary.totalBudget) * 100)} of budget
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
            <div className="text-sm text-gray-600 mb-1">Available</div>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalAvailable)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatPercent((summary.totalAvailable / summary.totalBudget) * 100)} of budget
            </div>
          </div>
        </div>
      )}

      {/* Variance Tab */}
      {activeTab === 'variance' && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Budget</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Encumbered</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actual</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remaining</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance %</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {varianceData.map((item, idx) => (
                <tr key={idx} className={item.variance < 0 ? 'bg-red-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{item.code}</td>
                  <td className="px-6 py-4">{item.description}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(item.budgetAmount)}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(item.encumbered)}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(item.actualSpent)}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(item.remaining)}</td>
                  <td className={`px-6 py-4 text-right font-semibold ${item.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(item.variance)}
                  </td>
                  <td className={`px-6 py-4 text-right ${item.variancePercent < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatPercent(item.variancePercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {varianceData.length === 0 && (
            <div className="p-6 text-center text-gray-500">No variance data available</div>
          )}
        </div>
      )}

      {/* Department Tab */}
      {activeTab === 'department' && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Budget</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Encumbered</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actual Spent</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remaining</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Utilization</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
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
                      <span className={utilization > 90 ? 'text-red-600 font-semibold' : ''}>
                        {formatPercent(utilization)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {departmentData.length === 0 && (
            <div className="p-6 text-center text-gray-500">No department data available</div>
          )}
        </div>
      )}

      {/* Year-over-Year Tab */}
      {activeTab === 'yoy' && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fiscal Year</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Budget</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Spent</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Utilization %</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">YoY Change</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
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
                          <span className={budgetChange > 0 ? 'text-green-600' : budgetChange < 0 ? 'text-red-600' : ''}>
                            {budgetChange > 0 ? '+' : ''}{formatPercent(budgetChange)}
                          </span>
                        ) : (
                          <span className="text-gray-400">N/A</span>
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
            <div className="p-6 text-center text-gray-500">No historical data available</div>
          )}
        </div>
      )}
    </div>
  );
}
