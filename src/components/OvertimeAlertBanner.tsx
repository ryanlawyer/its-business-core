'use client';

import { useState, useEffect, useCallback } from 'react';

interface AlertStatus {
  daily: {
    currentMinutes: number;
    thresholdMinutes: number | null;
    approaching: boolean;
    exceeded: boolean;
  };
  weekly: {
    currentMinutes: number;
    thresholdMinutes: number | null;
    approaching: boolean;
    exceeded: boolean;
  };
}

interface AlertConfig {
  dailyThreshold: number | null;
  weeklyThreshold: number | null;
  notifyEmployee: boolean;
}

interface OvertimeAlertBannerProps {
  onUpdate?: () => void;
}

export function OvertimeAlertBanner({ onUpdate }: OvertimeAlertBannerProps) {
  const [alertStatus, setAlertStatus] = useState<AlertStatus | null>(null);
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [dismissed, setDismissed] = useState<{ daily: boolean; weekly: boolean }>({
    daily: false,
    weekly: false,
  });
  const [loading, setLoading] = useState(true);

  const fetchAlertStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/timeclock/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlertStatus(data.alertStatus);
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Error fetching alert status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlertStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAlertStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchAlertStatus]);

  // Call onUpdate when parent wants to refresh
  useEffect(() => {
    if (onUpdate) {
      fetchAlertStatus();
    }
  }, [onUpdate, fetchAlertStatus]);

  const formatMinutesToHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (loading || !alertStatus || !config) {
    return null;
  }

  const showDailyAlert =
    !dismissed.daily &&
    alertStatus.daily.thresholdMinutes !== null &&
    (alertStatus.daily.approaching || alertStatus.daily.exceeded);

  const showWeeklyAlert =
    !dismissed.weekly &&
    alertStatus.weekly.thresholdMinutes !== null &&
    (alertStatus.weekly.approaching || alertStatus.weekly.exceeded);

  if (!showDailyAlert && !showWeeklyAlert) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6 animate-fade-in">
      {/* Daily Alert */}
      {showDailyAlert && (
        <div
          className="rounded-lg p-4 flex items-start justify-between"
          style={{
            background: alertStatus.daily.exceeded
              ? 'var(--error-bg, rgba(239, 68, 68, 0.1))'
              : 'var(--warning-bg, rgba(234, 179, 8, 0.1))',
            border: `1px solid ${
              alertStatus.daily.exceeded
                ? 'var(--error, #ef4444)'
                : 'var(--warning, #eab308)'
            }`,
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 mt-0.5"
              style={{
                color: alertStatus.daily.exceeded
                  ? 'var(--error, #ef4444)'
                  : 'var(--warning, #eab308)',
              }}
            >
              {alertStatus.daily.exceeded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.999L13.732 4.001c-.77-1.333-2.694-1.333-3.464 0L3.34 16.001c-.77 1.332.192 2.999 1.732 2.999z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              <p
                className="font-medium text-sm"
                style={{
                  color: alertStatus.daily.exceeded
                    ? 'var(--error, #ef4444)'
                    : 'var(--warning, #eab308)',
                }}
              >
                {alertStatus.daily.exceeded
                  ? 'Daily Overtime Exceeded'
                  : 'Approaching Daily Overtime'}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Today: {formatMinutesToHours(alertStatus.daily.currentMinutes)} of{' '}
                {formatMinutesToHours(alertStatus.daily.thresholdMinutes!)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed((prev) => ({ ...prev, daily: true }))}
            className="flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Dismiss daily alert"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Weekly Alert */}
      {showWeeklyAlert && (
        <div
          className="rounded-lg p-4 flex items-start justify-between"
          style={{
            background: alertStatus.weekly.exceeded
              ? 'var(--error-bg, rgba(239, 68, 68, 0.1))'
              : 'var(--warning-bg, rgba(234, 179, 8, 0.1))',
            border: `1px solid ${
              alertStatus.weekly.exceeded
                ? 'var(--error, #ef4444)'
                : 'var(--warning, #eab308)'
            }`,
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 mt-0.5"
              style={{
                color: alertStatus.weekly.exceeded
                  ? 'var(--error, #ef4444)'
                  : 'var(--warning, #eab308)',
              }}
            >
              {alertStatus.weekly.exceeded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.999L13.732 4.001c-.77-1.333-2.694-1.333-3.464 0L3.34 16.001c-.77 1.332.192 2.999 1.732 2.999z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              <p
                className="font-medium text-sm"
                style={{
                  color: alertStatus.weekly.exceeded
                    ? 'var(--error, #ef4444)'
                    : 'var(--warning, #eab308)',
                }}
              >
                {alertStatus.weekly.exceeded
                  ? 'Weekly Overtime Exceeded'
                  : 'Approaching Weekly Overtime'}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                This week: {formatMinutesToHours(alertStatus.weekly.currentMinutes)} of{' '}
                {formatMinutesToHours(alertStatus.weekly.thresholdMinutes!)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed((prev) => ({ ...prev, weekly: true }))}
            className="flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Dismiss weekly alert"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
