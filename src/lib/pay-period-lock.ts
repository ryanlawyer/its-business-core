import { prisma } from './prisma';

/**
 * Get the lock status for a pay period
 */
export async function getPayPeriodLockStatus(
  periodStart: Date,
  periodEnd: Date,
): Promise<{ isLocked: boolean; lock: { id: string; lockedAt: Date; lockedBy: string } | null }> {
  const lock = await prisma.payPeriodLock.findUnique({
    where: {
      periodStart_periodEnd: {
        periodStart,
        periodEnd,
      },
    },
  });

  if (!lock || !lock.isActive) {
    return { isLocked: false, lock: null };
  }

  return {
    isLocked: true,
    lock: {
      id: lock.id,
      lockedAt: lock.lockedAt,
      lockedBy: lock.lockedBy,
    },
  };
}

/**
 * Lock a pay period
 */
export async function lockPayPeriod(
  periodStart: Date,
  periodEnd: Date,
  lockedBy: string,
) {
  return prisma.payPeriodLock.upsert({
    where: {
      periodStart_periodEnd: {
        periodStart,
        periodEnd,
      },
    },
    update: {
      isActive: true,
      lockedAt: new Date(),
      lockedBy,
    },
    create: {
      periodStart,
      periodEnd,
      lockedBy,
      isActive: true,
    },
  });
}

/**
 * Unlock a pay period (soft-delete by setting isActive=false)
 */
export async function unlockPayPeriod(
  periodStart: Date,
  periodEnd: Date,
) {
  return prisma.payPeriodLock.update({
    where: {
      periodStart_periodEnd: {
        periodStart,
        periodEnd,
      },
    },
    data: {
      isActive: false,
    },
  });
}
