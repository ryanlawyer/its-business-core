import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

/**
 * POST /api/timeclock/bulk-approve
 * Approve multiple timeclock entries at once
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canApprove = hasPermission(userWithPerms.permissions, 'timeclock', 'canApproveEntries');
    const canViewAll = hasPermission(userWithPerms.permissions, 'timeclock', 'canViewAllEntries');

    if (!canApprove) {
      return NextResponse.json(
        { error: 'You do not have permission to approve entries' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { entryIds } = body;

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json(
        { error: 'entryIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Get manager's assigned departments (if not admin)
    let assignedDeptIds: string[] = [];
    if (!canViewAll) {
      const assignments = await prisma.managerAssignment.findMany({
        where: { userId: session.user.id },
        select: { departmentId: true },
      });
      assignedDeptIds = assignments.map((a) => a.departmentId);

      if (assignedDeptIds.length === 0) {
        return NextResponse.json(
          { error: 'You have no department assignments' },
          { status: 403 }
        );
      }
    }

    // Fetch all entries with their user info
    const entries = await prisma.timeclockEntry.findMany({
      where: { id: { in: entryIds } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Track results
    const results = {
      approved: 0,
      skipped: 0,
      failed: 0,
      details: [] as { id: string; status: 'approved' | 'skipped' | 'failed'; reason?: string }[],
    };

    const { ipAddress, userAgent } = getRequestContext(req);
    const now = new Date();

    // Process each entry in a transaction
    await prisma.$transaction(async (tx) => {
      for (const entryId of entryIds) {
        const entry = entries.find((e) => e.id === entryId);

        // Entry not found
        if (!entry) {
          results.failed++;
          results.details.push({ id: entryId, status: 'failed', reason: 'Entry not found' });
          continue;
        }

        // Already approved
        if (entry.status === 'approved') {
          results.skipped++;
          results.details.push({ id: entryId, status: 'skipped', reason: 'Already approved' });
          continue;
        }

        // Entry is locked
        if (entry.isLocked) {
          results.skipped++;
          results.details.push({ id: entryId, status: 'skipped', reason: 'Entry is locked' });
          continue;
        }

        // Active entry (no clockOut)
        if (!entry.clockOut) {
          results.skipped++;
          results.details.push({ id: entryId, status: 'skipped', reason: 'Active entry (no clock out)' });
          continue;
        }

        // Department check for managers
        if (!canViewAll) {
          if (!entry.user.department || !assignedDeptIds.includes(entry.user.department.id)) {
            results.failed++;
            results.details.push({ id: entryId, status: 'failed', reason: 'Not in assigned department' });
            continue;
          }
        }

        // Approve the entry
        await tx.timeclockEntry.update({
          where: { id: entryId },
          data: {
            status: 'approved',
            approvedBy: session.user.id,
            approvedAt: now,
            isLocked: true,
            rejectedNote: null,
          },
        });

        // Audit log
        await createAuditLog({
          userId: session.user.id,
          action: 'TIMECLOCK_ENTRY_APPROVED',
          entityType: 'TimeclockEntry',
          entityId: entryId,
          changes: {
            before: {
              status: entry.status,
              isLocked: entry.isLocked,
            },
            after: {
              status: 'approved',
              isLocked: true,
              approvedBy: session.user.id,
              approvedAt: now.toISOString(),
            },
            employeeName: entry.user.name,
            bulkOperation: true,
          },
          ipAddress,
          userAgent,
        });

        results.approved++;
        results.details.push({ id: entryId, status: 'approved' });
      }
    });

    return NextResponse.json({
      message: `Bulk approval complete: ${results.approved} approved, ${results.skipped} skipped, ${results.failed} failed`,
      approved: results.approved,
      skipped: results.skipped,
      failed: results.failed,
      details: results.details,
    });
  } catch (error) {
    console.error('Error in bulk approval:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk approval' },
      { status: 500 }
    );
  }
}
