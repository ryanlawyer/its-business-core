/**
 * Pay Period Utility
 *
 * Calculates pay period boundaries based on configuration.
 * Supports: weekly, biweekly, semimonthly, monthly
 */

import { PayPeriodConfig } from '@prisma/client';

export interface PayPeriod {
  startDate: Date;
  endDate: Date;
  label: string;
  type: string;
}

/**
 * Get the start of the week (based on startDayOfWeek) for a given date
 */
function getWeekStart(date: Date, startDayOfWeek: number = 0): Date {
  const d = new Date(date);
  const currentDay = d.getDay();
  const diff = (currentDay - startDayOfWeek + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the current pay period based on configuration
 */
export function getCurrentPayPeriod(config: PayPeriodConfig | null): PayPeriod {
  const now = new Date();
  return getPayPeriodForDate(now, config);
}

/**
 * Get the pay period for a specific date based on configuration
 */
export function getPayPeriodForDate(
  date: Date,
  config: PayPeriodConfig | null
): PayPeriod {
  if (!config) {
    // Default to weekly starting Sunday
    return getWeeklyPeriod(date, 0);
  }

  switch (config.type) {
    case 'weekly':
      return getWeeklyPeriod(date, config.startDayOfWeek ?? 0);
    case 'biweekly':
      return getBiweeklyPeriod(date, config.startDayOfWeek ?? 0, config.startDate);
    case 'semimonthly':
      return getSemimonthlyPeriod(date);
    case 'monthly':
      return getMonthlyPeriod(date);
    default:
      return getWeeklyPeriod(date, 0);
  }
}

/**
 * Get weekly pay period
 */
function getWeeklyPeriod(date: Date, startDayOfWeek: number): PayPeriod {
  const start = getWeekStart(date, startDayOfWeek);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    startDate: start,
    endDate: end,
    label: formatPeriodLabel(start, end),
    type: 'weekly',
  };
}

/**
 * Get biweekly pay period
 * Uses a reference start date to determine which week we're in
 */
function getBiweeklyPeriod(
  date: Date,
  startDayOfWeek: number,
  referenceDate: Date | null
): PayPeriod {
  // Get the week start for the current date
  const currentWeekStart = getWeekStart(date, startDayOfWeek);

  // Get the reference date's week start, or use a default
  const ref = referenceDate ? new Date(referenceDate) : new Date('2025-01-05'); // A known Sunday
  const referenceWeekStart = getWeekStart(ref, startDayOfWeek);

  // Calculate weeks since reference
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceRef = Math.floor(
    (currentWeekStart.getTime() - referenceWeekStart.getTime()) / msPerWeek
  );

  // Determine if we're in the first or second week of the biweekly period
  const periodOffset = ((weeksSinceRef % 2) + 2) % 2; // Handle negative modulo

  // Calculate start of the biweekly period
  const start = new Date(currentWeekStart);
  start.setDate(start.getDate() - periodOffset * 7);

  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  end.setHours(23, 59, 59, 999);

  return {
    startDate: start,
    endDate: end,
    label: formatPeriodLabel(start, end),
    type: 'biweekly',
  };
}

/**
 * Get semimonthly pay period (1st-15th, 16th-end)
 */
function getSemimonthlyPeriod(date: Date): PayPeriod {
  const year = date.getFullYear();
  const month = date.getMonth();
  const dayOfMonth = date.getDate();

  let start: Date;
  let end: Date;

  if (dayOfMonth <= 15) {
    // First half: 1st to 15th
    start = new Date(year, month, 1);
    end = new Date(year, month, 15, 23, 59, 59, 999);
  } else {
    // Second half: 16th to end of month
    start = new Date(year, month, 16);
    end = new Date(year, month + 1, 0, 23, 59, 59, 999); // Last day of month
  }

  return {
    startDate: start,
    endDate: end,
    label: formatPeriodLabel(start, end),
    type: 'semimonthly',
  };
}

/**
 * Get monthly pay period
 */
function getMonthlyPeriod(date: Date): PayPeriod {
  const year = date.getFullYear();
  const month = date.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999); // Last day of month

  return {
    startDate: start,
    endDate: end,
    label: formatPeriodLabel(start, end),
    type: 'monthly',
  };
}

/**
 * Format a period label like "Jan 1 - Jan 15, 2025"
 */
function formatPeriodLabel(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

/**
 * Get previous pay period
 */
export function getPreviousPeriod(
  currentPeriod: PayPeriod,
  config: PayPeriodConfig | null
): PayPeriod {
  const prevDate = new Date(currentPeriod.startDate);
  prevDate.setDate(prevDate.getDate() - 1);
  return getPayPeriodForDate(prevDate, config);
}

/**
 * Get next pay period
 */
export function getNextPeriod(
  currentPeriod: PayPeriod,
  config: PayPeriodConfig | null
): PayPeriod {
  const nextDate = new Date(currentPeriod.endDate);
  nextDate.setDate(nextDate.getDate() + 1);
  return getPayPeriodForDate(nextDate, config);
}

/**
 * Get a list of recent pay periods (for period selector)
 */
export function getRecentPeriods(
  config: PayPeriodConfig | null,
  count: number = 5
): PayPeriod[] {
  const periods: PayPeriod[] = [];
  let current = getCurrentPayPeriod(config);

  periods.push(current);

  for (let i = 1; i < count; i++) {
    current = getPreviousPeriod(current, config);
    periods.push(current);
  }

  return periods;
}
