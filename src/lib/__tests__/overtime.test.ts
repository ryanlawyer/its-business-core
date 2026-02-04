import { describe, it, expect } from 'vitest';
import {
  calculateOvertime,
  calculateDailyMinutes,
  calculateWeeklyMinutes,
  TimeclockEntryForCalculation,
} from '../overtime';
import { OvertimeConfig } from '@prisma/client';

// Helper to create mock entries
function createEntry(
  userId: string,
  clockIn: string,
  durationMinutes: number
): TimeclockEntryForCalculation {
  const clockInDate = new Date(clockIn);
  const clockOutDate = new Date(clockInDate.getTime() + durationMinutes * 60 * 1000);
  return {
    id: `entry-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    clockIn: clockInDate,
    clockOut: clockOutDate,
    duration: durationMinutes * 60, // seconds
    status: 'pending',
  };
}

// Helper to create mock config
function createConfig(
  dailyThreshold: number | null,
  weeklyThreshold: number | null
): OvertimeConfig {
  return {
    id: 'config-1',
    dailyThreshold,
    weeklyThreshold,
    alertBeforeDaily: null,
    alertBeforeWeekly: null,
    notifyEmployee: true,
    notifyManager: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('calculateOvertime', () => {
  describe('when config is null', () => {
    it('returns all time as regular', () => {
      const entries = [
        createEntry('user1', '2024-01-15T08:00:00', 600), // 10 hours
      ];

      const result = calculateOvertime(entries, null);

      expect(result.employees['user1'].regularMinutes).toBe(600);
      expect(result.employees['user1'].dailyOvertimeMinutes).toBe(0);
      expect(result.employees['user1'].weeklyOvertimeMinutes).toBe(0);
    });
  });

  describe('when both thresholds are null', () => {
    it('returns all time as regular', () => {
      const config = createConfig(null, null);
      const entries = [
        createEntry('user1', '2024-01-15T08:00:00', 600), // 10 hours
      ];

      const result = calculateOvertime(entries, config);

      expect(result.employees['user1'].regularMinutes).toBe(600);
      expect(result.employees['user1'].dailyOvertimeMinutes).toBe(0);
      expect(result.employees['user1'].weeklyOvertimeMinutes).toBe(0);
    });
  });

  describe('daily overtime', () => {
    it('calculates daily OT when exceeding daily threshold', () => {
      const config = createConfig(480, null); // 8 hours = 480 minutes
      const entries = [
        createEntry('user1', '2024-01-15T08:00:00', 600), // 10 hours on one day
      ];

      const result = calculateOvertime(entries, config);

      expect(result.employees['user1'].regularMinutes).toBe(480);
      expect(result.employees['user1'].dailyOvertimeMinutes).toBe(120); // 2 hours OT
      expect(result.employees['user1'].weeklyOvertimeMinutes).toBe(0);
      expect(result.employees['user1'].totalMinutes).toBe(600);
    });

    it('handles multiple entries on same day', () => {
      const config = createConfig(480, null); // 8 hours
      const entries = [
        createEntry('user1', '2024-01-15T08:00:00', 300), // 5 hours morning
        createEntry('user1', '2024-01-15T14:00:00', 300), // 5 hours afternoon
      ];

      const result = calculateOvertime(entries, config);

      expect(result.employees['user1'].regularMinutes).toBe(480);
      expect(result.employees['user1'].dailyOvertimeMinutes).toBe(120); // 2 hours OT
    });

    it('handles entries under threshold', () => {
      const config = createConfig(480, null); // 8 hours
      const entries = [
        createEntry('user1', '2024-01-15T08:00:00', 420), // 7 hours
      ];

      const result = calculateOvertime(entries, config);

      expect(result.employees['user1'].regularMinutes).toBe(420);
      expect(result.employees['user1'].dailyOvertimeMinutes).toBe(0);
    });

    it('calculates daily OT across multiple days correctly', () => {
      const config = createConfig(480, null); // 8 hours daily
      const entries = [
        createEntry('user1', '2024-01-15T08:00:00', 600), // 10 hours Mon
        createEntry('user1', '2024-01-16T08:00:00', 540), // 9 hours Tue
        createEntry('user1', '2024-01-17T08:00:00', 480), // 8 hours Wed
      ];

      const result = calculateOvertime(entries, config);

      // Day 1: 8 regular + 2 OT
      // Day 2: 8 regular + 1 OT
      // Day 3: 8 regular + 0 OT
      expect(result.employees['user1'].regularMinutes).toBe(480 + 480 + 480);
      expect(result.employees['user1'].dailyOvertimeMinutes).toBe(120 + 60);
      expect(result.employees['user1'].totalMinutes).toBe(600 + 540 + 480);
    });
  });

  describe('weekly overtime', () => {
    it('calculates weekly OT when exceeding weekly threshold', () => {
      const config = createConfig(null, 2400); // 40 hours weekly = 2400 minutes
      const entries = [
        createEntry('user1', '2024-01-15T08:00:00', 480), // Mon
        createEntry('user1', '2024-01-16T08:00:00', 480), // Tue
        createEntry('user1', '2024-01-17T08:00:00', 480), // Wed
        createEntry('user1', '2024-01-18T08:00:00', 480), // Thu
        createEntry('user1', '2024-01-19T08:00:00', 480), // Fri
        createEntry('user1', '2024-01-20T08:00:00', 240), // Sat - 4 hours
      ];

      const result = calculateOvertime(entries, config);

      // 5 days * 8 hours + 4 hours = 44 hours = 2640 minutes
      // Weekly threshold is 40 hours = 2400 minutes
      // Weekly OT = 240 minutes = 4 hours
      expect(result.employees['user1'].regularMinutes).toBe(2400);
      expect(result.employees['user1'].dailyOvertimeMinutes).toBe(0);
      expect(result.employees['user1'].weeklyOvertimeMinutes).toBe(240);
      expect(result.employees['user1'].totalMinutes).toBe(2640);
    });

    it('handles weekly under threshold', () => {
      const config = createConfig(null, 2400); // 40 hours weekly
      const entries = [
        createEntry('user1', '2024-01-15T08:00:00', 480), // 8 hours
        createEntry('user1', '2024-01-16T08:00:00', 480), // 8 hours
      ];

      const result = calculateOvertime(entries, config);

      expect(result.employees['user1'].regularMinutes).toBe(960);
      expect(result.employees['user1'].weeklyOvertimeMinutes).toBe(0);
    });
  });

  describe('combined daily and weekly overtime', () => {
    it('calculates both daily and weekly OT correctly', () => {
      // Daily: 8 hours = 480 min, Weekly: 40 hours = 2400 min
      const config = createConfig(480, 2400);
      const entries = [
        createEntry('user1', '2024-01-15T08:00:00', 600), // Mon: 10 hours (2h daily OT)
        createEntry('user1', '2024-01-16T08:00:00', 600), // Tue: 10 hours (2h daily OT)
        createEntry('user1', '2024-01-17T08:00:00', 600), // Wed: 10 hours (2h daily OT)
        createEntry('user1', '2024-01-18T08:00:00', 600), // Thu: 10 hours (2h daily OT)
        createEntry('user1', '2024-01-19T08:00:00', 600), // Fri: 10 hours (2h daily OT)
      ];

      const result = calculateOvertime(entries, config);

      // Total: 50 hours = 3000 minutes
      // Daily regular per day: 8h = 480m * 5 days = 2400m
      // Daily OT per day: 2h = 120m * 5 days = 600m
      // Weekly threshold: 40h = 2400m - matches regular exactly
      // So no additional weekly OT since regular = 2400 = threshold
      expect(result.employees['user1'].dailyOvertimeMinutes).toBe(600);
      expect(result.employees['user1'].weeklyOvertimeMinutes).toBe(0);
      expect(result.employees['user1'].regularMinutes).toBe(2400);
    });

    it('adds weekly OT on top of daily OT', () => {
      const config = createConfig(480, 2400);
      const entries = [
        createEntry('user1', '2024-01-15T08:00:00', 600), // Mon: 10h (2h daily OT)
        createEntry('user1', '2024-01-16T08:00:00', 600), // Tue: 10h (2h daily OT)
        createEntry('user1', '2024-01-17T08:00:00', 600), // Wed: 10h (2h daily OT)
        createEntry('user1', '2024-01-18T08:00:00', 600), // Thu: 10h (2h daily OT)
        createEntry('user1', '2024-01-19T08:00:00', 600), // Fri: 10h (2h daily OT)
        createEntry('user1', '2024-01-20T08:00:00', 480), // Sat: 8h (no daily OT, but adds to weekly)
      ];

      const result = calculateOvertime(entries, config);

      // Total: 58 hours = 3480 minutes
      // Daily regular: 8h * 6 days = 2880m
      // Daily OT: 2h * 5 days = 600m
      // Weekly: 2880 - 2400 = 480m weekly OT
      // Regular: 2880 - 480 = 2400
      expect(result.employees['user1'].dailyOvertimeMinutes).toBe(600);
      expect(result.employees['user1'].weeklyOvertimeMinutes).toBe(480);
      expect(result.employees['user1'].regularMinutes).toBe(2400);
    });
  });

  describe('multiple employees', () => {
    it('calculates overtime separately for each employee', () => {
      const config = createConfig(480, null); // 8 hours daily
      const entries = [
        createEntry('user1', '2024-01-15T08:00:00', 600), // 10 hours
        createEntry('user2', '2024-01-15T08:00:00', 420), // 7 hours
      ];

      const result = calculateOvertime(entries, config);

      expect(result.employees['user1'].regularMinutes).toBe(480);
      expect(result.employees['user1'].dailyOvertimeMinutes).toBe(120);

      expect(result.employees['user2'].regularMinutes).toBe(420);
      expect(result.employees['user2'].dailyOvertimeMinutes).toBe(0);

      expect(result.totalRegularMinutes).toBe(480 + 420);
      expect(result.totalDailyOvertimeMinutes).toBe(120);
    });
  });

  describe('edge cases', () => {
    it('handles empty entries array', () => {
      const config = createConfig(480, 2400);
      const result = calculateOvertime([], config);

      expect(Object.keys(result.employees)).toHaveLength(0);
      expect(result.totalRegularMinutes).toBe(0);
    });

    it('skips entries without clockOut', () => {
      const config = createConfig(480, null);
      const activeEntry: TimeclockEntryForCalculation = {
        id: 'entry-1',
        userId: 'user1',
        clockIn: new Date('2024-01-15T08:00:00'),
        clockOut: null,
        duration: null,
        status: 'pending',
      };

      const result = calculateOvertime([activeEntry], config);

      expect(Object.keys(result.employees)).toHaveLength(0);
    });

    it('skips entries without duration', () => {
      const config = createConfig(480, null);
      const entry: TimeclockEntryForCalculation = {
        id: 'entry-1',
        userId: 'user1',
        clockIn: new Date('2024-01-15T08:00:00'),
        clockOut: new Date('2024-01-15T16:00:00'),
        duration: null,
        status: 'pending',
      };

      const result = calculateOvertime([entry], config);

      expect(Object.keys(result.employees)).toHaveLength(0);
    });
  });
});

describe('calculateDailyMinutes', () => {
  it('calculates minutes for a specific day', () => {
    const entries = [
      createEntry('user1', '2024-01-15T08:00:00', 480),
      createEntry('user1', '2024-01-16T08:00:00', 420),
    ];

    const minutes = calculateDailyMinutes(entries, new Date('2024-01-15'));

    expect(minutes).toBe(480);
  });

  it('returns 0 for day with no entries', () => {
    const entries = [
      createEntry('user1', '2024-01-15T08:00:00', 480),
    ];

    const minutes = calculateDailyMinutes(entries, new Date('2024-01-16'));

    expect(minutes).toBe(0);
  });
});

describe('calculateWeeklyMinutes', () => {
  it('calculates minutes for the week containing the date', () => {
    // Week of Jan 14-20, 2024 (Sun-Sat)
    const entries = [
      createEntry('user1', '2024-01-15T08:00:00', 480), // Mon
      createEntry('user1', '2024-01-16T08:00:00', 480), // Tue
      createEntry('user1', '2024-01-17T08:00:00', 480), // Wed
    ];

    const minutes = calculateWeeklyMinutes(entries, new Date('2024-01-15'));

    expect(minutes).toBe(480 * 3);
  });

  it('excludes entries from other weeks', () => {
    const entries = [
      createEntry('user1', '2024-01-15T08:00:00', 480), // Week 1
      createEntry('user1', '2024-01-22T08:00:00', 480), // Week 2
    ];

    const minutes = calculateWeeklyMinutes(entries, new Date('2024-01-15'));

    expect(minutes).toBe(480);
  });
});
