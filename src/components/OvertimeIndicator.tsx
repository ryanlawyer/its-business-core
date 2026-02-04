'use client';

import { useState } from 'react';

interface OvertimeIndicatorProps {
  dailyOvertimeMinutes?: number;
  weeklyOvertimeMinutes?: number;
  exceedsDailyThreshold?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

/**
 * OT indicator icon for manager views
 * Shows warning icon with tooltip when overtime exists
 */
export function OvertimeIndicator({
  dailyOvertimeMinutes = 0,
  weeklyOvertimeMinutes = 0,
  exceedsDailyThreshold = false,
  size = 'md',
  showTooltip = true,
}: OvertimeIndicatorProps) {
  const [isHovered, setIsHovered] = useState(false);

  const hasAnyOvertime = dailyOvertimeMinutes > 0 || weeklyOvertimeMinutes > 0;

  if (!hasAnyOvertime && !exceedsDailyThreshold) {
    return null;
  }

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  // Determine color based on type of overtime
  const getColor = () => {
    if (weeklyOvertimeMinutes > 0) {
      return 'var(--error, #ef4444)'; // Red for weekly
    }
    return 'var(--warning, #eab308)'; // Yellow for daily
  };

  const tooltipContent = () => {
    const parts: string[] = [];
    if (dailyOvertimeMinutes > 0) {
      parts.push(`Daily OT: ${formatMinutes(dailyOvertimeMinutes)}`);
    }
    if (weeklyOvertimeMinutes > 0) {
      parts.push(`Weekly OT: ${formatMinutes(weeklyOvertimeMinutes)}`);
    }
    if (exceedsDailyThreshold && dailyOvertimeMinutes === 0) {
      parts.push('Entry exceeds daily threshold');
    }
    return parts.join(' | ');
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className={`inline-flex items-center justify-center ${sizeClasses[size]}`}
        style={{ color: getColor() }}
        title={!showTooltip ? tooltipContent() : undefined}
      >
        <svg
          className="w-full h-full"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.999L13.732 4.001c-.77-1.333-2.694-1.333-3.464 0L3.34 16.001c-.77 1.332.192 2.999 1.732 2.999z"
          />
        </svg>
      </span>

      {/* Tooltip */}
      {showTooltip && isHovered && (
        <div
          className="absolute z-50 px-2 py-1 text-xs rounded shadow-lg whitespace-nowrap"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: '100%',
            marginBottom: '4px',
          }}
        >
          {tooltipContent()}
          <div
            className="absolute left-1/2 transform -translate-x-1/2"
            style={{
              top: '100%',
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '4px solid var(--border-subtle)',
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * OT badge for employee lists
 * Shows "OT" badge with overtime amount
 */
export function OvertimeBadge({
  overtimeMinutes,
  variant = 'default',
}: {
  overtimeMinutes: number;
  variant?: 'default' | 'daily' | 'weekly';
}) {
  if (overtimeMinutes === 0) {
    return null;
  }

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const getColors = () => {
    switch (variant) {
      case 'weekly':
        return {
          bg: 'var(--error-bg, rgba(239, 68, 68, 0.1))',
          text: 'var(--error, #ef4444)',
          border: 'var(--error, #ef4444)',
        };
      case 'daily':
      default:
        return {
          bg: 'var(--warning-bg, rgba(234, 179, 8, 0.1))',
          text: 'var(--warning, #eab308)',
          border: 'var(--warning, #eab308)',
        };
    }
  };

  const colors = getColors();
  const label = variant === 'weekly' ? 'Weekly OT' : variant === 'daily' ? 'Daily OT' : 'OT';

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded"
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {label}: {formatMinutes(overtimeMinutes)}
    </span>
  );
}
