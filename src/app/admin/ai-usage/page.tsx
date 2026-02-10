'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';

interface UsageOverview {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  totalTokens: number;
  totalCostCents: number;
  avgDurationMs: number;
}

interface TaskBreakdown {
  taskType: string;
  count: number;
  tokens: number;
  costCents: number;
}

interface ProviderBreakdown {
  provider: string;
  count: number;
  costCents: number;
}

interface DayBreakdown {
  date: string;
  requests: number;
  tokens: number;
  costCents: number;
}

interface RecentLog {
  id: string;
  taskType: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
  durationMs: number;
  success: boolean;
  errorCode: string | null;
  createdAt: string;
}

interface UsageData {
  period: { year: number; month: number };
  overview: UsageOverview;
  byTask: TaskBreakdown[];
  byProvider: ProviderBreakdown[];
  byDay: DayBreakdown[];
  recentLogs: RecentLog[];
}

type TabKey = 'overview' | 'byTask' | 'byDay' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'byTask', label: 'By Task' },
  { key: 'byDay', label: 'By Day' },
  { key: 'history', label: 'History' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatCostCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function taskTypeLabel(type: string): string {
  switch (type) {
    case 'ocr': return 'OCR';
    case 'categorize': return 'Categorization';
    case 'summarize': return 'Summary';
    default: return type;
  }
}

export default function AIUsagePage() {
  useSession(); // ensure auth
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-usage?year=${year}&month=${month}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error('Error fetching AI usage:', error);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportCsv = () => {
    if (!data) return;

    const rows = data.recentLogs.map((log) => [
      new Date(log.createdAt).toLocaleString(),
      log.taskType,
      log.provider,
      log.model,
      log.inputTokens,
      log.outputTokens,
      (log.estimatedCostCents / 100).toFixed(4),
      log.durationMs,
      log.success ? 'Yes' : 'No',
      log.errorCode || '',
    ]);

    const header = ['Date', 'Task', 'Provider', 'Model', 'Input Tokens', 'Output Tokens', 'Cost ($)', 'Duration (ms)', 'Success', 'Error'];
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-usage-${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !data) {
    return (
      <main className="min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-[var(--bg-hover)] rounded w-48"></div>
            <div className="h-4 bg-[var(--bg-hover)] rounded w-80"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-[var(--bg-hover)] rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  const { overview } = data;

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title mb-1">AI Usage</h1>
            <p className="text-[var(--text-secondary)] text-sm">Monitor AI provider usage, costs, and performance</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="form-input form-select"
            >
              {MONTHS.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="form-input form-select w-24"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={exportCsv} className="btn btn-secondary btn-sm whitespace-nowrap">
              Export CSV
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-sm text-[var(--text-muted)] mb-1">Requests</div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">{overview.totalRequests}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              {overview.successCount} ok / {overview.failureCount} failed
            </div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-[var(--text-muted)] mb-1">Tokens Used</div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">{formatTokens(overview.totalTokens)}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-[var(--text-muted)] mb-1">Estimated Cost</div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">{formatCostCents(overview.totalCostCents)}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-[var(--text-muted)] mb-1">Avg Response Time</div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">{formatDuration(overview.avgDurationMs)}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--border-default)] overflow-x-auto scrollbar-hide">
            <nav className="flex min-w-max px-2 sm:px-4">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-3 sm:px-4 py-3 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === key
                      ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-default)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 sm:p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* By Provider */}
                <div>
                  <h3 className="section-title mb-3">By Provider</h3>
                  {data.byProvider.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">No usage data for this period.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table w-full">
                        <thead>
                          <tr>
                            <th className="data-table-header">Provider</th>
                            <th className="data-table-header text-right">Requests</th>
                            <th className="data-table-header text-right">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.byProvider.map((p) => (
                            <tr key={p.provider} className="data-table-row">
                              <td className="data-table-cell font-medium capitalize">{p.provider}</td>
                              <td className="data-table-cell text-right">{p.count}</td>
                              <td className="data-table-cell text-right">{formatCostCents(p.costCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* By Task */}
                <div>
                  <h3 className="section-title mb-3">By Task Type</h3>
                  {data.byTask.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">No usage data for this period.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table w-full">
                        <thead>
                          <tr>
                            <th className="data-table-header">Task</th>
                            <th className="data-table-header text-right">Requests</th>
                            <th className="data-table-header text-right">Tokens</th>
                            <th className="data-table-header text-right">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.byTask.map((t) => (
                            <tr key={t.taskType} className="data-table-row">
                              <td className="data-table-cell font-medium">{taskTypeLabel(t.taskType)}</td>
                              <td className="data-table-cell text-right">{t.count}</td>
                              <td className="data-table-cell text-right">{formatTokens(t.tokens)}</td>
                              <td className="data-table-cell text-right">{formatCostCents(t.costCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* By Task Tab */}
            {activeTab === 'byTask' && (
              <div>
                {data.byTask.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No usage data for this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table w-full">
                      <thead>
                        <tr>
                          <th className="data-table-header">Task Type</th>
                          <th className="data-table-header text-right">Requests</th>
                          <th className="data-table-header text-right">Tokens</th>
                          <th className="data-table-header text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byTask.map((t) => (
                          <tr key={t.taskType} className="data-table-row">
                            <td className="data-table-cell font-medium">{taskTypeLabel(t.taskType)}</td>
                            <td className="data-table-cell text-right">{t.count}</td>
                            <td className="data-table-cell text-right">{formatTokens(t.tokens)}</td>
                            <td className="data-table-cell text-right">{formatCostCents(t.costCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* By Day Tab */}
            {activeTab === 'byDay' && (
              <div>
                {data.byDay.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No usage data for this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table w-full">
                      <thead>
                        <tr>
                          <th className="data-table-header">Date</th>
                          <th className="data-table-header text-right">Requests</th>
                          <th className="data-table-header text-right">Tokens</th>
                          <th className="data-table-header text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byDay.map((d) => (
                          <tr key={d.date} className="data-table-row">
                            <td className="data-table-cell font-medium">{d.date}</td>
                            <td className="data-table-cell text-right">{d.requests}</td>
                            <td className="data-table-cell text-right">{formatTokens(d.tokens)}</td>
                            <td className="data-table-cell text-right">{formatCostCents(d.costCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                {data.recentLogs.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No usage data for this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table w-full">
                      <thead>
                        <tr>
                          <th className="data-table-header">Time</th>
                          <th className="data-table-header">Task</th>
                          <th className="data-table-header">Provider</th>
                          <th className="data-table-header">Model</th>
                          <th className="data-table-header text-right">Tokens</th>
                          <th className="data-table-header text-right">Cost</th>
                          <th className="data-table-header text-right">Duration</th>
                          <th className="data-table-header">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentLogs.map((log) => (
                          <tr key={log.id} className="data-table-row">
                            <td className="data-table-cell text-sm whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="data-table-cell">{taskTypeLabel(log.taskType)}</td>
                            <td className="data-table-cell capitalize">{log.provider}</td>
                            <td className="data-table-cell text-sm font-mono">{log.model}</td>
                            <td className="data-table-cell text-right">
                              {formatTokens(log.inputTokens + log.outputTokens)}
                            </td>
                            <td className="data-table-cell text-right">{formatCostCents(log.estimatedCostCents)}</td>
                            <td className="data-table-cell text-right">{formatDuration(log.durationMs)}</td>
                            <td className="data-table-cell">
                              {log.success ? (
                                <span className="badge badge-success">OK</span>
                              ) : (
                                <span className="badge badge-error" title={log.errorCode || undefined}>Failed</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
