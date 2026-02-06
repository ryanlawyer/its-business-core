import { prisma } from './prisma';
import type { TimeclockRulesConfig, OvertimeConfig } from '@prisma/client';

// In-memory cache for singleton config
let cachedConfig: TimeclockRulesConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Get the timeclock rules config singleton (with caching)
 */
export async function getTimeclockRulesConfig(): Promise<TimeclockRulesConfig> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  let config = await prisma.timeclockRulesConfig.findFirst();
  if (!config) {
    config = await prisma.timeclockRulesConfig.create({ data: {} });
  }

  cachedConfig = config;
  cacheTimestamp = now;
  return config;
}

/**
 * Invalidate the cached config (call after config update)
 */
export function invalidateRulesConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

/**
 * Apply rounding to a duration in seconds
 */
export function applyRounding(durationSeconds: number, mode: string): number {
  if (mode === 'none') return durationSeconds;

  const intervals: Record<string, number> = {
    '5min': 300,
    '6min': 360,
    '7min': 420,  // 7-minute rounding (7/8 rule)
    '15min': 900,
  };

  const interval = intervals[mode];
  if (!interval) return durationSeconds;

  return Math.round(durationSeconds / interval) * interval;
}

/**
 * Apply break deduction to a duration
 */
export function applyBreakDeduction(
  durationSeconds: number,
  config: TimeclockRulesConfig
): { deductedSeconds: number; adjustedDuration: number } {
  if (!config.breakDeductionEnabled) {
    return { deductedSeconds: 0, adjustedDuration: durationSeconds };
  }

  const thresholdSeconds = config.breakDeductionAfterHours * 3600;
  if (durationSeconds <= thresholdSeconds) {
    return { deductedSeconds: 0, adjustedDuration: durationSeconds };
  }

  const deductedSeconds = config.breakDeductionMinutes * 60;
  const adjustedDuration = Math.max(0, durationSeconds - deductedSeconds);
  return { deductedSeconds, adjustedDuration };
}

/**
 * Check if duration meets minimum requirement
 */
export function checkMinDuration(
  durationSeconds: number,
  config: TimeclockRulesConfig
): { passed: boolean; action: 'flag' | 'reject' | 'pass' } {
  if (!config.minDurationEnabled) {
    return { passed: true, action: 'pass' };
  }

  if (durationSeconds >= config.minDurationSeconds) {
    return { passed: true, action: 'pass' };
  }

  return {
    passed: false,
    action: config.minDurationAction as 'flag' | 'reject',
  };
}

/**
 * Check if an entry qualifies for auto-approval
 */
export async function checkAutoApprove(
  durationSeconds: number,
  userId: string,
  config: TimeclockRulesConfig,
): Promise<{ shouldAutoApprove: boolean; reason?: string }> {
  if (!config.autoApproveEnabled) {
    return { shouldAutoApprove: false, reason: 'auto-approve disabled' };
  }

  const durationHours = durationSeconds / 3600;

  if (durationHours < config.autoApproveMinHours) {
    return { shouldAutoApprove: false, reason: 'below minimum hours' };
  }

  if (durationHours > config.autoApproveMaxHours) {
    return { shouldAutoApprove: false, reason: 'exceeds maximum hours' };
  }

  // Check OT blocking
  if (config.autoApproveBlockOnOT) {
    const otConfig = await prisma.overtimeConfig.findFirst();
    if (otConfig) {
      if (otConfig.dailyThreshold !== null) {
        const dailyThresholdSeconds = otConfig.dailyThreshold * 60;
        if (durationSeconds > dailyThresholdSeconds) {
          return { shouldAutoApprove: false, reason: 'triggers daily overtime' };
        }
      }
    }
  }

  return { shouldAutoApprove: true };
}

/**
 * Query entries with potential missed punches
 */
export async function getMissedPunchEntries(departmentIds?: string[]) {
  const config = await getTimeclockRulesConfig();
  if (!config.missedPunchEnabled) return [];

  const thresholdMs = config.missedPunchThresholdHours * 3600 * 1000;
  const cutoffDate = new Date(Date.now() - thresholdMs);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    clockOut: null,
    clockIn: { lt: cutoffDate },
  };

  if (departmentIds && departmentIds.length > 0) {
    where.user = {
      departmentId: { in: departmentIds },
    };
  }

  return prisma.timeclockEntry.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { clockIn: 'asc' },
  });
}

/**
 * Composite function called from clock-out route.
 * Pipeline: break deduction -> rounding -> min duration check -> auto-approve check
 */
export async function processClockOut(
  rawDurationSeconds: number,
  userId: string,
): Promise<{
  rawDuration: number;
  finalDuration: number;
  breakDeducted: number;
  flagReason: string | null;
  autoApproved: boolean;
  status: string;
  rejectedNote: string | null;
}> {
  const config = await getTimeclockRulesConfig();

  // 1. Break deduction (on raw time)
  const { deductedSeconds, adjustedDuration } = applyBreakDeduction(rawDurationSeconds, config);

  // 2. Rounding (on post-break time)
  const finalDuration = applyRounding(adjustedDuration, config.roundingMode);

  // 3. Min duration check
  let flagReason: string | null = null;
  let status = 'pending';
  let rejectedNote: string | null = null;

  const minCheck = checkMinDuration(finalDuration, config);
  if (!minCheck.passed) {
    if (minCheck.action === 'reject') {
      status = 'rejected';
      rejectedNote = `Auto-rejected: duration (${Math.round(finalDuration / 60)}m) below minimum threshold (${Math.round(config.minDurationSeconds / 60)}m)`;
      return {
        rawDuration: rawDurationSeconds,
        finalDuration,
        breakDeducted: deductedSeconds,
        flagReason: 'min_duration',
        autoApproved: false,
        status,
        rejectedNote,
      };
    } else {
      flagReason = 'min_duration';
    }
  }

  // 4. Auto-approve check (skip if already flagged/rejected)
  let autoApproved = false;
  if (status === 'pending' && !flagReason) {
    const autoResult = await checkAutoApprove(finalDuration, userId, config);
    if (autoResult.shouldAutoApprove) {
      autoApproved = true;
      status = 'approved';
    }
  }

  return {
    rawDuration: rawDurationSeconds,
    finalDuration,
    breakDeducted: deductedSeconds,
    flagReason,
    autoApproved,
    status,
    rejectedNote,
  };
}
