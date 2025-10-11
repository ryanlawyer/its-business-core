import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/audit-log/export - Export audit logs to CSV
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

    // Check if user can export audit logs
    if (!permissions.auditLog?.canExport) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters (same as main route)
    const searchParams = req.nextUrl.searchParams;
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
      const departmentUsers = await prisma.user.findMany({
        where: { departmentId: user.departmentId },
        select: { id: true },
      });
      const departmentUserIds = departmentUsers.map((u) => u.id);

      if (where.userId) {
        if (!departmentUserIds.includes(where.userId)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } else {
        where.userId = { in: departmentUserIds };
      }
    }

    // Get all logs (no pagination for export)
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Generate CSV
    const csvHeader =
      'Timestamp,Action,Entity Type,Entity ID,User Name,User Email,IP Address,User Agent,Changes\n';

    const csvRows = logs.map((log) => {
      const timestamp = log.createdAt.toISOString();
      const action = log.action;
      const entityType = log.entityType;
      const entityId = log.entityId || '';
      const userName = log.user?.name || 'System';
      const userEmail = log.user?.email || '';
      const ipAddress = log.ipAddress || '';
      const userAgent = log.userAgent || '';
      const changes = log.changes.replace(/"/g, '""'); // Escape quotes for CSV

      return `"${timestamp}","${action}","${entityType}","${entityId}","${userName}","${userEmail}","${ipAddress}","${userAgent}","${changes}"`;
    });

    const csv = csvHeader + csvRows.join('\n');

    // Generate filename with timestamp
    const filename = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;

    // Return CSV with appropriate headers
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to export audit logs' },
      { status: 500 }
    );
  }
}
