'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface ActiveEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  duration: number | null;
  status: string;
}

interface TodayStats {
  totalSeconds: number;
  sessionsCompleted: number;
}

interface PeriodStats {
  totalMinutes: number;
  regularMinutes: number;
  dailyOvertimeMinutes: number;
  weeklyOvertimeMinutes: number;
  sessionsCompleted: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function formatTimeOfDay(date: Date): { h: string; m: string; s: string; ampm: string } {
  let hours = date.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return {
    h: String(hours),
    m: String(date.getMinutes()).padStart(2, '0'),
    s: String(date.getSeconds()).padStart(2, '0'),
    ampm,
  };
}

function formatElapsed(seconds: number): { h: string; m: string; s: string } {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return {
    h: String(h),
    m: String(m).padStart(2, '0'),
    s: String(s).padStart(2, '0'),
  };
}

function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatSecondsToHM(totalSeconds: number): string {
  return formatHoursMinutes(totalSeconds / 60);
}

function formatShortTime(dateStr: string): string {
  const d = new Date(dateStr);
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PunchClockPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [now, setNow] = useState(new Date());
  const [activeEntry, setActiveEntry] = useState<ActiveEntry | null>(null);
  const [todayStats, setTodayStats] = useState<TodayStats>({ totalSeconds: 0, sessionsCompleted: 0 });
  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [punchFlash, setPunchFlash] = useState<'in' | 'out' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isClockedIn = !!activeEntry;

  // ── Tick every second ──
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Register service worker for PWA ──
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // ── Redirect if not authenticated ──
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [authStatus, router]);

  // ── Fetch status ──
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/timeclock');
      if (!res.ok) return;
      const data = await res.json();
      setActiveEntry(data.activeEntry || null);
      setTodayStats(data.todayStats || { totalSeconds: 0, sessionsCompleted: 0 });
      setPeriodStats(data.periodStats || null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchStatus();
  }, [authStatus, fetchStatus]);

  // ── Punch handler ──
  const handlePunch = async () => {
    if (punching) return;
    setPunching(true);
    setError(null);

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(30);

    try {
      const endpoint = isClockedIn ? '/api/timeclock/clock-out' : '/api/timeclock/clock-in';
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        return;
      }

      // Success flash
      setPunchFlash(isClockedIn ? 'out' : 'in');
      if (navigator.vibrate) navigator.vibrate([15, 40, 15]);
      setTimeout(() => setPunchFlash(null), 2200);

      await fetchStatus();
    } catch {
      setError('Network error — check your connection');
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    } finally {
      setPunching(false);
    }
  };

  // ── Derived values ──
  const time = formatTimeOfDay(now);
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const userName = session?.user?.name?.split(' ')[0] || 'there';

  let elapsedSeconds = 0;
  if (activeEntry) {
    elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(activeEntry.clockIn).getTime()) / 1000));
  }
  const elapsed = formatElapsed(elapsedSeconds);

  // ── Loading state ──
  if (authStatus === 'loading' || loading) {
    return (
      <div className="punch-scene">
        <style>{punchStyles}</style>
        <div className="punch-body">
          <div className="punch-center">
            <div className="punch-loader" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="punch-scene">
      <style>{punchStyles}</style>

      {/* ── Ambient glow ── */}
      <div
        className="punch-ambient"
        style={{
          background: isClockedIn
            ? 'radial-gradient(ellipse at 50% 40%, rgba(245,158,11,0.08) 0%, transparent 70%)'
            : 'radial-gradient(ellipse at 50% 40%, rgba(45,212,191,0.05) 0%, transparent 70%)',
        }}
      />

      <div className="punch-body">
        {/* ── Header ── */}
        <header className="punch-header animate-fade-in">
          <div>
            <p className="punch-greeting">Hi, {userName}</p>
            <p className="punch-date">{dateStr}</p>
          </div>
          <a href="/" className="punch-nav-link" aria-label="Open full app">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </a>
        </header>

        {/* ── Center: Time + Button ── */}
        <main className="punch-center">
          {/* Wall clock — shrinks when clocked in to make room for shift timer */}
          <div className={`punch-clock-display ${isClockedIn ? 'punch-clock-display--small' : ''}`}>
            <span className="punch-clock-h">{time.h}</span>
            <span className="punch-clock-sep">:</span>
            <span className="punch-clock-m">{time.m}</span>
            {!isClockedIn && (
              <>
                <span className="punch-clock-sep punch-clock-sep--dim">:</span>
                <span className="punch-clock-s">{time.s}</span>
              </>
            )}
            <span className="punch-clock-ampm">{time.ampm}</span>
          </div>

          {/* Shift timer — only when clocked in */}
          {isClockedIn && (
            <div className="punch-shift-timer animate-fade-in">
              <span className="punch-shift-h">{elapsed.h}</span>
              <span className="punch-shift-sep">:</span>
              <span className="punch-shift-m">{elapsed.m}</span>
              <span className="punch-shift-sep punch-shift-sep--dim">:</span>
              <span className="punch-shift-s">{elapsed.s}</span>
            </div>
          )}

          {/* ── THE BUTTON ── */}
          <div className="punch-btn-wrap">
            {/* Pulse ring when clocked in */}
            {isClockedIn && <div className="punch-btn-pulse" />}

            <button
              ref={buttonRef}
              onClick={handlePunch}
              disabled={punching}
              className={`punch-btn ${isClockedIn ? 'punch-btn--out' : 'punch-btn--in'} ${punching ? 'punch-btn--busy' : ''}`}
              aria-label={isClockedIn ? 'Clock out' : 'Clock in'}
            >
              {punching ? (
                <div className="punch-btn-spinner" />
              ) : (
                <>
                  <span className="punch-btn-label">
                    {isClockedIn ? 'CLOCK OUT' : 'CLOCK IN'}
                  </span>
                  <svg className="punch-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {isClockedIn ? (
                      <>
                        <rect x="6" y="6" width="12" height="12" rx="1" />
                      </>
                    ) : (
                      <>
                        <polygon points="6,4 20,12 6,20" />
                      </>
                    )}
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Status text */}
          <p className="punch-status">
            {isClockedIn
              ? `Since ${formatShortTime(activeEntry!.clockIn)}`
              : 'Ready'}
          </p>

          {/* Error / Success toast */}
          {error && (
            <div className="punch-toast punch-toast--error animate-fade-in-up">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {error}
            </div>
          )}
          {punchFlash && (
            <div className={`punch-toast punch-toast--${punchFlash} animate-fade-in-up`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              {punchFlash === 'in' ? 'Clocked in' : 'Clocked out'}
            </div>
          )}
        </main>

        {/* ── Stats ── */}
        <footer className="punch-stats animate-fade-in">
          <div className="punch-stat">
            <span className="punch-stat-value">
              {formatSecondsToHM(todayStats.totalSeconds + (isClockedIn ? elapsedSeconds : 0))}
            </span>
            <span className="punch-stat-label">Today</span>
          </div>
          <div className="punch-stat-divider" />
          <div className="punch-stat">
            <span className="punch-stat-value">
              {todayStats.sessionsCompleted + (isClockedIn ? 1 : 0)}
            </span>
            <span className="punch-stat-label">Entries</span>
          </div>
          <div className="punch-stat-divider" />
          <div className="punch-stat">
            <span className="punch-stat-value">
              {periodStats ? formatHoursMinutes(periodStats.totalMinutes + (isClockedIn ? elapsedSeconds / 60 : 0)) : '--'}
            </span>
            <span className="punch-stat-label">Period</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Styles — scoped to this page
   ═══════════════════════════════════════════════════════════════════════════ */

const punchStyles = `
/* ── Scene — sits above navbar (z-100) and bottom-nav (z-50) ── */
.punch-scene {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--bg-void, #08090b);
  overflow: hidden;
}

.punch-ambient {
  position: absolute;
  inset: 0;
  transition: background 1.2s ease;
  pointer-events: none;
}

.punch-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: env(safe-area-inset-top, 1rem) 1.5rem calc(env(safe-area-inset-bottom, 0.5rem) + 0.5rem);
  max-width: 480px;
  margin: 0 auto;
}

/* ── Header ── */
.punch-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-top: 1rem;
}

.punch-greeting {
  font-family: var(--font-body), system-ui, sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #f4f4f5);
  letter-spacing: -0.01em;
}

.punch-date {
  font-size: 0.8125rem;
  color: var(--text-muted, #71717a);
  margin-top: 0.125rem;
}

.punch-nav-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: var(--text-muted, #71717a);
  transition: all 0.15s ease;
}
.punch-nav-link:hover {
  background: var(--bg-surface, #1a1d26);
  color: var(--text-secondary, #a1a1aa);
}

/* ── Center ── */
.punch-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
  justify-content: center;
  /* Shift visual center slightly upward */
  margin-top: -2rem;
}

/* ── Wall clock ── */
.punch-clock-display {
  display: flex;
  align-items: baseline;
  font-family: var(--font-mono), monospace;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary, #f4f4f5);
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  margin-bottom: 0.5rem;
}

.punch-clock-display:not(.punch-clock-display--small) {
  font-size: clamp(3.5rem, 12vw, 5rem);
  font-weight: 300;
  letter-spacing: -0.04em;
}

.punch-clock-display--small {
  font-size: 1.125rem;
  font-weight: 400;
  color: var(--text-muted, #71717a);
  letter-spacing: 0;
  margin-bottom: 0.25rem;
}

.punch-clock-sep {
  opacity: 0.4;
  margin: 0 0.05em;
}
.punch-clock-sep--dim { opacity: 0.25; }

.punch-clock-s {
  font-size: 0.6em;
  opacity: 0.35;
  min-width: 1.4em;
}

.punch-clock-ampm {
  font-size: 0.3em;
  font-weight: 500;
  opacity: 0.4;
  margin-left: 0.4em;
  letter-spacing: 0.05em;
}

.punch-clock-display--small .punch-clock-ampm {
  font-size: 0.85em;
}

/* ── Shift timer ── */
.punch-shift-timer {
  display: flex;
  align-items: baseline;
  font-family: var(--font-mono), monospace;
  font-variant-numeric: tabular-nums;
  font-size: clamp(2.75rem, 10vw, 4rem);
  font-weight: 300;
  letter-spacing: -0.03em;
  color: #f59e0b;
  margin-bottom: 1.5rem;
  text-shadow: 0 0 40px rgba(245, 158, 11, 0.2);
}

.punch-shift-sep {
  opacity: 0.4;
  margin: 0 0.04em;
}
.punch-shift-sep--dim { opacity: 0.2; }

.punch-shift-s {
  font-size: 0.55em;
  opacity: 0.5;
  min-width: 1.5em;
}

/* ── Button ── */
.punch-btn-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 1rem 0 1rem;
}

.punch-btn-pulse {
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  border: 2px solid rgba(245, 158, 11, 0.15);
  animation: punchPulse 2.5s ease-in-out infinite;
  pointer-events: none;
}

@keyframes punchPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.15);
    opacity: 0;
  }
}

.punch-btn {
  position: relative;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition:
    transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.3s ease,
    background 0.5s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
}

@media (min-width: 400px) {
  .punch-btn {
    width: 180px;
    height: 180px;
  }
  .punch-btn-pulse {
    width: 200px;
    height: 200px;
  }
}

/* Clock In state — teal/emerald */
.punch-btn--in {
  background: linear-gradient(145deg, #10b981 0%, #059669 100%);
  box-shadow:
    0 0 40px rgba(16, 185, 129, 0.2),
    0 8px 24px rgba(0, 0, 0, 0.4),
    inset 0 1px 2px rgba(255, 255, 255, 0.12),
    inset 0 -2px 4px rgba(0, 0, 0, 0.15);
}
.punch-btn--in:hover:not(:disabled) {
  box-shadow:
    0 0 56px rgba(16, 185, 129, 0.3),
    0 8px 24px rgba(0, 0, 0, 0.4),
    inset 0 1px 2px rgba(255, 255, 255, 0.15),
    inset 0 -2px 4px rgba(0, 0, 0, 0.15);
  transform: scale(1.03);
}

/* Clock Out state — amber */
.punch-btn--out {
  background: linear-gradient(145deg, #f59e0b 0%, #d97706 100%);
  box-shadow:
    0 0 40px rgba(245, 158, 11, 0.2),
    0 8px 24px rgba(0, 0, 0, 0.4),
    inset 0 1px 2px rgba(255, 255, 255, 0.12),
    inset 0 -2px 4px rgba(0, 0, 0, 0.15);
}
.punch-btn--out:hover:not(:disabled) {
  box-shadow:
    0 0 56px rgba(245, 158, 11, 0.3),
    0 8px 24px rgba(0, 0, 0, 0.4),
    inset 0 1px 2px rgba(255, 255, 255, 0.15),
    inset 0 -2px 4px rgba(0, 0, 0, 0.15);
  transform: scale(1.03);
}

.punch-btn:active:not(:disabled) {
  transform: scale(0.94) !important;
  transition-duration: 0.08s;
}

.punch-btn:disabled {
  opacity: 0.8;
  cursor: default;
}

.punch-btn--busy {
  animation: punchBusy 1s ease-in-out infinite alternate;
}
@keyframes punchBusy {
  from { opacity: 0.7; }
  to { opacity: 1; }
}

.punch-btn-label {
  font-family: var(--font-body), system-ui, sans-serif;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(0, 0, 0, 0.85);
}

.punch-btn-icon {
  width: 20px;
  height: 20px;
  stroke: rgba(0, 0, 0, 0.5);
}

.punch-btn-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(0, 0, 0, 0.2);
  border-top-color: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Status ── */
.punch-status {
  font-size: 0.8125rem;
  color: var(--text-muted, #71717a);
  letter-spacing: 0.02em;
  margin-top: 0.25rem;
}

/* ── Toast ── */
.punch-toast {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: 99px;
  font-size: 0.8125rem;
  font-weight: 600;
  margin-top: 0.75rem;
  animation: toastIn 0.3s ease-out forwards, toastOut 0.3s ease-in 1.8s forwards;
}

.punch-toast--in {
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.punch-toast--out {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.punch-toast--error {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.2);
  animation: toastIn 0.3s ease-out forwards, toastOut 0.3s ease-in 3.5s forwards;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes toastOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-4px) scale(0.95);
  }
}

/* ── Footer stats ── */
.punch-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 1rem 0;
  border-top: 1px solid var(--border-subtle, #1f2129);
}

.punch-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.punch-stat-value {
  font-family: var(--font-mono), monospace;
  font-variant-numeric: tabular-nums;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #f4f4f5);
  letter-spacing: -0.02em;
}

.punch-stat-label {
  font-size: 0.6875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted, #71717a);
}

.punch-stat-divider {
  width: 1px;
  height: 28px;
  background: var(--border-subtle, #1f2129);
}

/* ── Loader ── */
.punch-loader {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-subtle, #1f2129);
  border-top-color: var(--text-muted, #71717a);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
`;
