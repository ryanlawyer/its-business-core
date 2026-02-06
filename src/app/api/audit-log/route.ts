import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/audit-log - Get audit logs with filtering
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with role permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true, department: true },
    });

    if (!user?.role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const permissions = JSON.parse(user.role.permissions);

    // Check if user can view audit logs
    if (!permissions.auditLog?.canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const action = searchParams.get('action') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const entityId = searchParams.get('entityId') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    // Build where clause
    const where: any = {};

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // If user can't view all logs, filter by department
    if (!permissions.auditLog?.canViewAll && user.departmentId) {
      // Get all users in the same department
      const departmentUsers = await prisma.user.findMany({
        where: { departmentId: user.departmentId },
        select: { id: true },
      });
      const departmentUserIds = departmentUsers.map((u) => u.id);

      // Add user filter
      if (where.userId) {
        // If specific user requested, check if they're in the department
        if (!departmentUserIds.includes(where.userId)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } else {
        // Otherwise, filter to department users
        where.userId = { in: departmentUserIds };
      }
    }

    // Get total count
    const total = await prisma.auditLog.count({ where });

    // Get logs with pagination
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Parse changes JSON safely
    const logsWithParsedChanges = logs.map((log) => {
      let parsedChanges = {};
      try {
        parsedChanges = JSON.parse(log.changes);
      } catch {
        parsedChanges = { raw: log.changes };
      }
      return {
        ...log,
        changes: parsedChanges,
      };
    });

    return NextResponse.json({
      logs: logsWithParsedChanges,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
