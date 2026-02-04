/**
 * Overtime Calculation Service
 *
 * Calculates regular and overtime hours for timeclock entries
 * based on configured daily and weekly thresholds.
 */

import { OvertimeConfig } from '@prisma/client';

// Type for timeclock entry used in calculations
export interface TimeclockEntryForCalculation {
  id: string;
  userId: string;
  clockIn: Date;
  clockOut: Date | null;
  duration: number | null; // Duration in seconds
  status: string;
}

// Result for a single employee
export interface EmployeeOvertimeResult {
  userId: string;
  regularMinutes: number;
  dailyOvertimeMinutes: number;
  weeklyOvertimeMinutes: number;
  totalMinutes: number;
  entriesProcessed: number;
}

// Result for the entire calculation
export interface OvertimeCalculationResult {
  employees: Record<string, EmployeeOvertimeResult>;
  totalRegularMinutes: number;
  totalDailyOvertimeMinutes: number;
  totalWeeklyOvertimeMinutes: number;
}

/**
 * Get the start of the day for a given date (midnight local time)
 */
function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get the start of the week (Sunday) for a given date
 */
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

/**
 * Calculate overtime for a set of entries
 *
 * Daily OT: hours exceeding daily threshold per day
 * Weekly OT: hours exceeding weekly threshold (after daily OT is subtracted)
 *
 * @param entries - Array of timeclock entries with completed clock out
 * @param config - Overtime configuration (thresholds in minutes)
 * @returns Calculation results with regular and OT breakdown
 */
export function calculateOvertime(
  entries: TimeclockEntryForCalculation[],
  config: OvertimeConfig | null
): OvertimeCalculationResult {
  // Group entries by employee
  const employeeEntries: Record<string, TimeclockEntryForCalculation[]> = {};

  for (const entry of entries) {
    // Skip entries without clockOut or duration
    if (!entry.clockOut || entry.duration === null) continue;

    if (!employeeEntries[entry.userId]) {
      employeeEntries[entry.userId] = [];
    }
    employeeEntries[entry.userId].push(entry);
  }

  const result: OvertimeCalculationResult = {
    employees: {},
    totalRegularMinutes: 0,
    totalDailyOvertimeMinutes: 0,
    totalWeeklyOvertimeMinutes: 0,
  };

  // Process each employee
  for (const userId of Object.keys(employeeEntries)) {
    const employeeResult = calculateEmployeeOvertime(
      employeeEntries[userId],
      config
    );
    result.employees[userId] = employeeResult;
    result.totalRegularMinutes += employeeResult.regularMinutes;
    result.totalDailyOvertimeMinutes += employeeResult.dailyOvertimeMinutes;
    result.totalWeeklyOvertimeMinutes += employeeResult.weeklyOvertimeMinutes;
  }

  return result;
}

/**
 * Calculate overtime for a single employee
 */
function calculateEmployeeOvertime(
  entries: TimeclockEntryForCalculation[],
  config: OvertimeConfig | null
): EmployeeOvertimeResult {
  const userId = entries[0]?.userId || '';

  // If no config or no thresholds, all time is regular
  if (!config || (config.dailyThreshold === null && config.weeklyThreshold === null)) {
    const totalMinutes = entries.reduce((sum, entry) => {
      return sum + Math.floor((entry.duration || 0) / 60);
    }, 0);

    return {
      userId,
      regularMinutes: totalMinutes,
      dailyOvertimeMinutes: 0,
      weeklyOvertimeMinutes: 0,
      totalMinutes,
      entriesProcessed: entries.length,
    };
  }

  const dailyThreshold = config.dailyThreshold; // minutes or null
  const weeklyThreshold = config.weeklyThreshold; // minutes or null

  // Group entries by day
  const dailyMinutes: Record<string, number> = {};

  for (const entry of entries) {
    const dateKey = getDateKey(entry.clockIn);
    const minutes = Math.floor((entry.duration || 0) / 60);
    dailyMinutes[dateKey] = (dailyMinutes[dateKey] || 0) + minutes;
  }

  // Calculate daily regular and daily OT
  let totalDailyRegular = 0;
  let totalDailyOT = 0;
  const dailyRegularByDay: Record<string, number> = {};

  for (const dateKey of Object.keys(dailyMinutes)) {
    const dayTotal = dailyMinutes[dateKey];

    if (dailyThreshold !== null && dayTotal > dailyThreshold) {
      // Some OT on this day
      totalDailyRegular += dailyThreshold;
      totalDailyOT += dayTotal - dailyThreshold;
      dailyRegularByDay[dateKey] = dailyThreshold;
    } else {
      // All regular on this day
      totalDailyRegular += dayTotal;
      dailyRegularByDay[dateKey] = dayTotal;
    }
  }

  // Calculate weekly OT (from the regular minutes, after daily OT removed)
  let weeklyOT = 0;

  if (weeklyThreshold !== null) {
    // Group daily regular by week
    const weeklyRegular: Record<string, number> = {};

    for (const dateKey of Object.keys(dailyRegularByDay)) {
      const date = new Date(dateKey);
      const weekKey = getWeekStart(date);
      weeklyRegular[weekKey] = (weeklyRegular[weekKey] || 0) + dailyRegularByDay[dateKey];
    }

    // Check each week for weekly OT
    for (const weekKey of Object.keys(weeklyRegular)) {
      const weekTotal = weeklyRegular[weekKey];
      if (weekTotal > weeklyThreshold) {
        weeklyOT += weekTotal - weeklyThreshold;
      }
    }
  }

  // Regular = total daily regular - weekly OT
  const regularMinutes = totalDailyRegular - weeklyOT;
  const totalMinutes = regularMinutes + totalDailyOT + weeklyOT;

  return {
    userId,
    regularMinutes,
    dailyOvertimeMinutes: totalDailyOT,
    weeklyOvertimeMinutes: weeklyOT,
    totalMinutes,
    entriesProcessed: entries.length,
  };
}

/**
 * Calculate overtime for a single employee on a specific day
 * (Useful for real-time display)
 */
export function calculateDailyMinutes(
  entries: TimeclockEntryForCalculation[],
  targetDate: Date
): number {
  const dateKey = getDateKey(targetDate);

  return entries.reduce((sum, entry) => {
    if (getDateKey(entry.clockIn) === dateKey && entry.duration !== null) {
      return sum + Math.floor(entry.duration / 60);
    }
    return sum;
  }, 0);
}

/**
 * Calculate total minutes for a week
 * (Useful for weekly threshold checking)
 */
export function calculateWeeklyMinutes(
  entries: TimeclockEntryForCalculation[],
  referenceDate: Date
): number {
  const weekStart = getWeekStart(referenceDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return entries.reduce((sum, entry) => {
    const entryDate = entry.clockIn;
    if (
      entryDate >= new Date(weekStart) &&
      entryDate < weekEnd &&
      entry.duration !== null
    ) {
      return sum + Math.floor(entry.duration / 60);
    }
    return sum;
  }, 0);
}

// Alert status result
export interface AlertStatus {
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

/**
 * Check alert status for overtime thresholds
 *
 * Returns alert flags for both daily and weekly thresholds.
 * "approaching" = within alertBefore minutes of threshold
 * "exceeded" = at or over threshold
 *
 * @param entries - Employee's entries (completed or in progress)
 * @param config - Overtime configuration with thresholds and alert settings
 * @param referenceDate - Date to check against (usually now)
 * @param activeMinutes - Minutes from currently active clock-in (optional)
 * @returns AlertStatus object or null if both thresholds disabled
 */
export function checkAlertStatus(
  entries: TimeclockEntryForCalculation[],
  config: OvertimeConfig | null,
  referenceDate: Date = new Date(),
  activeMinutes: number = 0
): AlertStatus | null {
  // Return null if no config or both thresholds disabled
  if (!config) return null;
  if (config.dailyThreshold === null && config.weeklyThreshold === null) {
    return null;
  }

  // Calculate current day total
  const dailyMinutesCompleted = calculateDailyMinutes(entries, referenceDate);
  const dailyTotal = dailyMinutesCompleted + activeMinutes;

  // Calculate current week total
  const weeklyMinutesCompleted = calculateWeeklyMinutes(entries, referenceDate);
  const weeklyTotal = weeklyMinutesCompleted + activeMinutes;

  // Check daily threshold
  const dailyStatus = {
    currentMinutes: dailyTotal,
    thresholdMinutes: config.dailyThreshold,
    approaching: false,
    exceeded: false,
  };

  if (config.dailyThreshold !== null) {
    dailyStatus.exceeded = dailyTotal >= config.dailyThreshold;

    if (!dailyStatus.exceeded && config.alertBeforeDaily !== null) {
      const alertThreshold = config.dailyThreshold - config.alertBeforeDaily;
      dailyStatus.approaching = dailyTotal >= alertThreshold;
    }
  }

  // Check weekly threshold
  const weeklyStatus = {
    currentMinutes: weeklyTotal,
    thresholdMinutes: config.weeklyThreshold,
    approaching: false,
    exceeded: false,
  };

  if (config.weeklyThreshold !== null) {
    weeklyStatus.exceeded = weeklyTotal >= config.weeklyThreshold;

    if (!weeklyStatus.exceeded && config.alertBeforeWeekly !== null) {
      const alertThreshold = config.weeklyThreshold - config.alertBeforeWeekly;
      weeklyStatus.approaching = weeklyTotal >= alertThreshold;
    }
  }

  return {
    daily: dailyStatus,
    weekly: weeklyStatus,
  };
}
