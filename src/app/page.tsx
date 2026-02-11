'use client';

import { useSession } from 'next-auth/react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { OvertimeAlertBanner } from '@/components/OvertimeAlertBanner';

type PayPeriod = {
  startDate: string;
  endDate: string;
  label: string;
  type: string;
};

type TimeclockEntry = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  duration: number | null;
  rawDuration: number | null;
  breakDeducted: number | null;
  autoApproved: boolean;
  flagReason: string | null;
  status: string;
  isLocked: boolean;
  rejectedNote: string | null;
};

type RulesConfig = {
  attestationEnabled: boolean;
  breakDeductionEnabled: boolean;
  roundingMode: string;
} | null;

type PeriodStats = {
  totalMinutes: number;
  regularMinutes: number;
  dailyOvertimeMinutes: number;
  weeklyOvertimeMinutes: number;
  sessionsCompleted: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};

type TodayStats = {
  totalSeconds: number;
  sessionsCompleted: number;
};

export default function TimeclockPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [activeEntry, setActiveEntry] = useState<TimeclockEntry | null>(null);
  const [entries, setEntries] = useState<TimeclockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [isClocking, setIsClocking] = useState(false);
  const [alertRefreshKey, setAlertRefreshKey] = useState(0);

  // Period state
  const [currentPeriod, setCurrentPeriod] = useState<PayPeriod | null>(null);
  const [availablePeriods, setAvailablePeriods] = useState<PayPeriod[]>([]);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);
  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null);
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [dismissedRejections, setDismissedRejections] = useState<Set<string>>(new Set());
  const [rulesConfig, setRulesConfig] = useState<RulesConfig>(null);
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());
  const [submittingAll, setSubmittingAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const entriesRef = useRef<HTMLDivElement>(null);

  // Callback to trigger alert banner refresh
  const refreshAlerts = useCallback(() => {
    setAlertRefreshKey((prev) => prev + 1);
  }, []);

  // Close period dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(e.target as Node)) {
        setPeriodDropdownOpen(false);
      }
    };
    if (periodDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [periodDropdownOpen]);

  useEffect(() => {
    setMounted(true);
    if (user) {
      fetchEntries();
      fetchRulesConfig();
    }
  }, [user]);

  const fetchRulesConfig = async () => {
    try {
      const res = await fetch('/api/timeclock/config');
      const data = await res.json();
      if (res.ok && data.rulesConfig) {
        setRulesConfig(data.rulesConfig);
      }
    } catch {
      // Non-critical, ignore errors
    }
  };

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchEntries = async (periodStart?: string, periodEnd?: string) => {
    try {
      setLoading(true);
      let url = '/api/timeclock';
      if (periodStart && periodEnd) {
        url += `?periodStart=${periodStart}&periodEnd=${periodEnd}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      setEntries(data.entries || []);
      setActiveEntry(data.activeEntry || null);
      setCurrentPeriod(data.currentPeriod || null);
      setAvailablePeriods(data.availablePeriods || []);
      setPeriodStats(data.periodStats || null);
      setTodayStats(data.todayStats || null);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (index: number) => {
    setSelectedPeriodIndex(index);
    const period = availablePeriods[index];
    if (period) {
      fetchEntries(period.startDate, period.endDate);
    }
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter((prev) => (prev === status ? null : status));
    entriesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDismissRejection = (entryId: string) => {
    setDismissedRejections((prev) => new Set([...prev, entryId]));
  };

  const handleClockIn = async () => {
    setIsClocking(true);
    try {
      const res = await fetch('/api/timeclock/clock-in', {
        method: 'POST',
      });
      if (res.ok) {
        await fetchEntries();
        refreshAlerts();
      }
    } catch (error) {
      console.error('Error clocking in:', error);
    } finally {
      setIsClocking(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    setIsClocking(true);
    try {
      const res = await fetch('/api/timeclock/clock-out', {
        method: 'POST',
      });
      if (res.ok) {
        await fetchEntries();
        refreshAlerts();
      }
    } catch (error) {
      console.error('Error clocking out:', error);
    } finally {
      setIsClocking(false);
    }
  };

  const handleSubmitEntry = async (entryId: string) => {
    setSubmittingIds((prev) => new Set([...prev, entryId]));
    try {
      const res = await fetch(`/api/timeclock/${entryId}/submit`, { method: 'POST' });
      if (res.ok) {
        await fetchEntries();
      }
    } catch (error) {
      console.error('Error submitting entry:', error);
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    }
  };

  const handleSubmitAll = async () => {
    const pendingCompleted = entries.filter(
      (e) => e.status === 'pending' && e.clockOut !== null
    );
    if (pendingCompleted.length === 0) return;

    setSubmittingAll(true);
    try {
      for (const entry of pendingCompleted) {
        await fetch(`/api/timeclock/${entry.id}/submit`, { method: 'POST' });
      }
      await fetchEntries();
    } catch (error) {
      console.error('Error submitting entries:', error);
    } finally {
      setSubmittingAll(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const getCurrentDuration = () => {
    if (!activeEntry) return 0;
    const start = new Date(activeEntry.clockIn);
    const diff = Math.floor((currentTime.getTime() - start.getTime()) / 1000);
    return diff;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (entry: TimeclockEntry) => {
    if (!entry.clockOut) {
      return <span className="badge badge-accent badge-dot">Active</span>;
    }

    const statusConfig: Record<string, { class: string; icon?: React.ReactElement }> = {
      pending: { class: 'badge badge-warning badge-dot' },
      submitted: { class: 'badge badge-accent badge-dot' },
      approved: {
        class: 'badge badge-success',
        icon: entry.isLocked ? (
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        ) : undefined,
      },
      rejected: { class: 'badge badge-error badge-dot' },
    };

    const config = statusConfig[entry.status] || { class: 'badge' };

    return (
      <span className={config.class}>
        {config.icon}
        {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
      </span>
    );
  };

  const filteredEntries = statusFilter
    ? entries.filter((e) => e.status === statusFilter)
    : entries;

  // Loading state
  if (!mounted || loading) {
    return (
      <div className="page-container">
        <div className="page-header animate-fade-in">
          <h1 className="page-title">Timeclock</h1>
          <p className="page-subtitle">Loading your time entries...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="stat-card">
              <div className="skeleton h-6 w-6 rounded-full mb-3"></div>
              <div className="skeleton h-8 w-24 mb-2"></div>
              <div className="skeleton h-4 w-32"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card">
            <div className="skeleton h-6 w-48 mb-4"></div>
            <div className="skeleton h-16 w-32 mb-4"></div>
            <div className="skeleton h-12 w-full"></div>
          </div>
          <div className="lg:col-span-2 card">
            <div className="skeleton h-6 w-48 mb-4"></div>
            <div className="skeleton h-48 w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="page-header animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Timeclock</h1>
            <p className="page-subtitle">
              {currentTime.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: 'var(--accent-primary)' }}>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>
      </header>

      {/* Period Selector */}
      {availablePeriods.length > 0 && (
        <div className="card-highlight mb-6 animate-fade-in-up" style={{ animationDelay: '25ms' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="stat-icon stat-icon-info flex-shrink-0" style={{ width: '2.5rem', height: '2.5rem' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Pay Period</h3>
                <p className="text-lg font-medium" style={{ color: 'var(--accent-primary)' }}>
                  {currentPeriod?.label || 'Current Period'}
                </p>
              </div>
            </div>
            <div className="relative" ref={periodDropdownRef}>
              <button
                onClick={() => setPeriodDropdownOpen(!periodDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium w-full sm:w-auto"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                  maxWidth: '280px',
                }}
              >
                <span className="truncate">
                  {availablePeriods[selectedPeriodIndex]?.label}
                  {selectedPeriodIndex === 0 ? ' (Current)' : ''}
                </span>
                <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${periodDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {periodDropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-64 rounded-lg border shadow-lg z-20 animate-fade-in py-1"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-default)',
                  }}
                >
                  {availablePeriods.map((period, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        handlePeriodChange(index);
                        setPeriodDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-[var(--bg-surface)] transition-colors"
                      style={{ color: index === selectedPeriodIndex ? 'var(--accent-primary)' : 'var(--text-primary)' }}
                    >
                      {index === selectedPeriodIndex && (
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      <span className={index !== selectedPeriodIndex ? 'ml-6' : ''}>
                        {period.label} {index === 0 ? '(Current)' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Department Assignment Widget */}
      {user?.departmentName && (
        <div className="card-highlight mb-6 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-start gap-4">
            <div className="stat-icon stat-icon-accent flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <circle cx="12" cy="11" r="3" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Your Organizational Assignment</h3>
              <p className="text-lg font-medium mt-1" style={{ color: 'var(--accent-primary)' }}>{user.departmentName}</p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                This is your default organizational context for filters and budget creation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overtime Alert Banner */}
      <OvertimeAlertBanner key={alertRefreshKey} />

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Clock Status Card */}
        <button
          onClick={activeEntry ? handleClockOut : handleClockIn}
          disabled={isClocking}
          className={`stat-card ${activeEntry ? 'stat-card-success' : 'stat-card-accent'} animate-fade-in-up cursor-pointer hover:ring-2 hover:ring-[var(--accent-primary)] transition-shadow text-left`}
          style={{ animationDelay: '75ms' }}
        >
          <div className={`stat-icon ${activeEntry ? 'stat-icon-success' : 'stat-icon-accent'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="stat-value">{activeEntry ? 'Active' : 'Ready'}</div>
          <div className="stat-label">{activeEntry ? 'Click to Clock Out' : 'Click to Clock In'}</div>
        </button>

        {/* Today's Total Card */}
        <Link href="/timeclock/history" className="stat-card stat-card-info animate-fade-in-up hover:ring-2 hover:ring-[var(--accent-primary)] transition-shadow" style={{ animationDelay: '100ms' }}>
          <div className="stat-icon stat-icon-info">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className="stat-value font-mono">
            {formatDuration((todayStats?.totalSeconds || 0) + (activeEntry ? getCurrentDuration() : 0))}
          </div>
          <div className="stat-label">Today&apos;s Total</div>
        </Link>

        {/* Period Regular Hours */}
        <div className="stat-card stat-card-success animate-fade-in-up" style={{ animationDelay: '125ms' }}>
          <div className="stat-icon stat-icon-success">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div className="stat-value font-mono">
            {formatMinutes(periodStats?.regularMinutes || 0)}
          </div>
          <div className="stat-label">Period Regular Hours</div>
        </div>

        {/* Period OT Hours */}
        <div className="stat-card animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <div
            className="stat-icon"
            style={{
              background:
                (periodStats?.dailyOvertimeMinutes || 0) + (periodStats?.weeklyOvertimeMinutes || 0) > 0
                  ? 'var(--warning-bg, rgba(234, 179, 8, 0.1))'
                  : 'var(--bg-surface)',
              color:
                (periodStats?.dailyOvertimeMinutes || 0) + (periodStats?.weeklyOvertimeMinutes || 0) > 0
                  ? 'var(--warning)'
                  : 'var(--text-secondary)',
            }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.999L13.732 4.001c-.77-1.333-2.694-1.333-3.464 0L3.34 16.001c-.77 1.332.192 2.999 1.732 2.999z" />
            </svg>
          </div>
          <div className="stat-value font-mono">
            {formatMinutes((periodStats?.dailyOvertimeMinutes || 0) + (periodStats?.weeklyOvertimeMinutes || 0))}
          </div>
          <div className="stat-label">Period Overtime</div>
        </div>
      </div>

      {/* Period Summary Row */}
      {periodStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <Link href="/timeclock/history" className="stat-card hover:ring-2 hover:ring-[var(--accent-primary)] transition-shadow">
            <div className="stat-value" style={{ color: 'var(--text-primary)' }}>
              {periodStats.sessionsCompleted}
            </div>
            <div className="stat-label">Sessions</div>
          </Link>
          <button onClick={() => handleStatusFilter('pending')} className={`stat-card hover:ring-2 hover:ring-[var(--accent-primary)] transition-shadow text-left ${statusFilter === 'pending' ? 'ring-2 ring-[var(--warning)]' : ''}`}>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>
              {periodStats.pendingCount}
            </div>
            <div className="stat-label">Pending</div>
          </button>
          <button onClick={() => handleStatusFilter('approved')} className={`stat-card hover:ring-2 hover:ring-[var(--accent-primary)] transition-shadow text-left ${statusFilter === 'approved' ? 'ring-2 ring-[var(--success)]' : ''}`}>
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {periodStats.approvedCount}
            </div>
            <div className="stat-label">Approved</div>
          </button>
          <button onClick={() => handleStatusFilter('rejected')} className={`stat-card hover:ring-2 hover:ring-[var(--accent-primary)] transition-shadow text-left ${statusFilter === 'rejected' ? 'ring-2 ring-[var(--error)]' : ''}`}>
            <div className="stat-value" style={{ color: 'var(--error)' }}>
              {periodStats.rejectedCount}
            </div>
            <div className="stat-label">Rejected</div>
          </button>
        </div>
      )}

      {/* Rejected Entries Banner */}
      {periodStats && periodStats.rejectedCount > 0 && (
        <div
          className="mb-8 p-4 rounded-lg border animate-fade-in-up"
          style={{
            animationDelay: '160ms',
            background: 'var(--error-bg, rgba(239, 68, 68, 0.1))',
            borderColor: 'var(--error)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 p-2 rounded-full"
              style={{ background: 'var(--error)', color: 'white' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.999L13.732 4.001c-.77-1.333-2.694-1.333-3.464 0L3.34 16.001c-.77 1.332.192 2.999 1.732 2.999z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold" style={{ color: 'var(--error)' }}>
                {periodStats.rejectedCount} Time {periodStats.rejectedCount === 1 ? 'Entry' : 'Entries'} Rejected
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Your manager has rejected one or more time entries this period.
                Please contact your manager for correction.
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Rejected entries are highlighted in red below with the rejection reason.
                You cannot edit rejected entries directly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Attestation Submit All Banner */}
      {rulesConfig?.attestationEnabled && entries.filter((e) => e.status === 'pending' && e.clockOut).length > 0 && (
        <div
          className="mb-8 p-4 rounded-lg border animate-fade-in-up"
          style={{
            animationDelay: '170ms',
            background: 'var(--info-subtle, rgba(59, 130, 246, 0.1))',
            borderColor: 'var(--info, #3b82f6)',
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ color: 'var(--info)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--info)' }}>Attestation Required</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  You have {entries.filter((e) => e.status === 'pending' && e.clockOut).length} completed entries awaiting your attestation.
                  Submit them to confirm your hours are accurate.
                </p>
              </div>
            </div>
            <button
              onClick={handleSubmitAll}
              disabled={submittingAll}
              className="btn btn-primary btn-sm flex-shrink-0"
            >
              {submittingAll ? 'Submitting...' : 'Submit All'}
            </button>
          </div>
        </div>
      )}

      {/* Clock In/Out Action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1">
          <div className="card animate-fade-in-up" style={{ animationDelay: '175ms' }}>
            <h2 className="section-title mb-4">
              {activeEntry ? 'End Your Session' : 'Start Your Day'}
            </h2>

            {activeEntry && (
              <div className="mb-6 p-4 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Clocked in at</p>
                <p className="text-xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                  {formatTime(activeEntry.clockIn)}
                </p>
                <p className="text-2xl font-mono font-bold mt-2" style={{ color: 'var(--success)' }}>
                  {formatDuration(getCurrentDuration())}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--success)' }}></span>
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--success)' }}></span>
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--success)' }}>Session active</span>
                </div>
              </div>
            )}

            <button
              onClick={activeEntry ? handleClockOut : handleClockIn}
              disabled={isClocking}
              className={`btn btn-lg w-full ${activeEntry ? 'btn-secondary' : 'btn-primary'}`}
            >
              {isClocking ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : activeEntry ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                  Clock Out
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Clock In
                </>
              )}
            </button>
          </div>
        </div>

        {/* Time Entries Table */}
        <div ref={entriesRef} className="lg:col-span-2 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="table-container">
            <div className="p-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="section-title">
                Period Time Entries
              </h2>
              {statusFilter && (
                <button
                  onClick={() => setStatusFilter(null)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
                  style={{
                    background: 'var(--bg-surface)',
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Showing: {statusFilter}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {entries.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="empty-state-title">No time entries yet</div>
                <div className="empty-state-description">
                  Clock in to start tracking your time for this period.
                </div>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No {statusFilter} entries</div>
                <div className="empty-state-description">
                  No entries match the selected filter.
                </div>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4 p-4">
                  {filteredEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`card animate-fade-in`}
                      style={{
                        animationDelay: `${250 + index * 30}ms`,
                        background: entry.status === 'rejected' ? 'var(--error-bg, rgba(239, 68, 68, 0.1))' : undefined,
                      }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-sm font-bold text-[var(--text-primary)] font-mono">{formatDateTime(entry.clockIn)}</h3>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Clock In</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(entry)}
                          {entry.isLocked && entry.status === 'approved' && (
                            <span title="Locked - cannot be modified">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Clock Out:</span>
                          <span className="text-[var(--text-primary)] font-mono">
                            {entry.clockOut ? formatDateTime(entry.clockOut) : <span style={{ color: 'var(--text-muted)' }}>--</span>}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Duration:</span>
                          <span className="text-[var(--text-primary)] font-mono font-medium">
                            {entry.clockOut ? formatDuration(entry.duration) : <span style={{ color: 'var(--text-muted)' }}>--</span>}
                          </span>
                        </div>
                        {entry.breakDeducted && entry.breakDeducted > 0 && (
                          <div className="text-xs" style={{ color: 'var(--info)' }}>
                            {Math.round(entry.breakDeducted / 60)}m break deducted
                          </div>
                        )}
                        {entry.rawDuration !== null && entry.duration !== null && entry.rawDuration !== entry.duration && !entry.breakDeducted && (
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Rounded from {formatDuration(entry.rawDuration)}
                          </div>
                        )}
                        {entry.autoApproved && (
                          <div className="text-xs font-medium" style={{ color: 'var(--success)' }}>Auto-approved</div>
                        )}
                      </div>
                      {rulesConfig?.attestationEnabled && entry.status === 'pending' && entry.clockOut && (
                        <div className="mt-3 pt-3 border-t border-[var(--border-default)]">
                          <button
                            onClick={() => handleSubmitEntry(entry.id)}
                            disabled={submittingIds.has(entry.id)}
                            className="btn btn-primary btn-sm w-full"
                          >
                            {submittingIds.has(entry.id) ? 'Submitting...' : 'Submit for Review'}
                          </button>
                        </div>
                      )}
                      {entry.status === 'rejected' && entry.rejectedNote && !dismissedRejections.has(entry.id) && (
                        <div
                          className="mt-3 p-2 rounded text-xs flex items-start gap-2"
                          style={{
                            background: 'var(--error-bg, rgba(239, 68, 68, 0.15))',
                            border: '1px solid var(--error)',
                          }}
                        >
                          <div className="flex-1">
                            <div className="font-medium" style={{ color: 'var(--error)' }}>Rejection Note:</div>
                            <div style={{ color: 'var(--text-primary)' }}>{entry.rejectedNote}</div>
                            <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
                              Contact your manager for correction
                            </div>
                          </div>
                          <button
                            onClick={() => handleDismissRejection(entry.id)}
                            className="flex-shrink-0 p-1 rounded hover:bg-opacity-20"
                            style={{ color: 'var(--text-muted)' }}
                            title="Dismiss this notice"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block">
                  <table className="table" aria-label="Recent time clock entries">
                    <thead>
                      <tr>
                        <th scope="col">Clock In</th>
                        <th scope="col">Clock Out</th>
                        <th scope="col">Duration</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry, index) => (
                        <tr
                          key={entry.id}
                          className={`animate-fade-in ${entry.status === 'rejected' ? 'row-rejected' : ''}`}
                          style={{
                            animationDelay: `${250 + index * 30}ms`,
                            background: entry.status === 'rejected' ? 'var(--error-bg, rgba(239, 68, 68, 0.1))' : undefined,
                          }}
                        >
                          <td className="font-mono">{formatDateTime(entry.clockIn)}</td>
                          <td className="font-mono">
                            {entry.clockOut ? formatDateTime(entry.clockOut) : '—'}
                          </td>
                          <td className="font-mono font-medium">
                            <div className="flex items-center gap-2">
                              <span>{entry.clockOut ? formatDuration(entry.duration) : '—'}</span>
                              {entry.breakDeducted && entry.breakDeducted > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--info-subtle, rgba(59, 130, 246, 0.1))', color: 'var(--info)' }}>
                                  -{Math.round(entry.breakDeducted / 60)}m break
                                </span>
                              )}
                              {entry.rawDuration !== null && entry.duration !== null && entry.rawDuration !== entry.duration && !entry.breakDeducted && (
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                                  rounded
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(entry)}
                              {entry.autoApproved && (
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--success-subtle, rgba(34, 197, 94, 0.1))', color: 'var(--success)' }}>
                                  Auto
                                </span>
                              )}
                              {rulesConfig?.attestationEnabled && entry.status === 'pending' && entry.clockOut && (
                                <button
                                  onClick={() => handleSubmitEntry(entry.id)}
                                  disabled={submittingIds.has(entry.id)}
                                  className="text-xs px-2 py-1 rounded font-medium"
                                  style={{ background: 'var(--accent-primary)', color: 'white' }}
                                >
                                  {submittingIds.has(entry.id) ? '...' : 'Submit'}
                                </button>
                              )}
                              {entry.isLocked && entry.status === 'approved' && (
                                <span title="Locked - cannot be modified">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0110 0v4" />
                                  </svg>
                                </span>
                              )}
                            </div>
                            {entry.status === 'rejected' && entry.rejectedNote && !dismissedRejections.has(entry.id) && (
                              <div
                                className="mt-2 p-2 rounded text-xs flex items-start gap-2"
                                style={{
                                  background: 'var(--error-bg, rgba(239, 68, 68, 0.15))',
                                  border: '1px solid var(--error)',
                                }}
                              >
                                <div className="flex-1">
                                  <div className="font-medium" style={{ color: 'var(--error)' }}>Rejection Note:</div>
                                  <div style={{ color: 'var(--text-primary)' }}>{entry.rejectedNote}</div>
                                  <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
                                    Contact your manager for correction
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDismissRejection(entry.id)}
                                  className="flex-shrink-0 p-1 rounded hover:bg-opacity-20"
                                  style={{ color: 'var(--text-muted)' }}
                                  title="Dismiss this notice"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
