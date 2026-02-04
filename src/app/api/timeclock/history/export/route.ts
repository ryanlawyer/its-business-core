import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';

/**
 * GET /api/timeclock/history/export
 * Export user's timeclock history as CSV
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permission
    const canViewOwn = hasPermission(
      userWithPerms.permissions,
      'timeclock',
      'canViewOwnEntries'
    );

    if (!canViewOwn) {
      return NextResponse.json(
        { error: 'You do not have permission to export your time entries' },
        { status: 403 }
      );
    }

    const userId = session.user.id;
    const searchParams = req.nextUrl.searchParams;

    // Parse query params (same as history endpoint)
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const preset = searchParams.get('preset');

    // Build date range from preset if provided
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (preset) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (preset) {
        case 'this_week': {
          const dayOfWeek = today.getDay();
          startDate = new Date(today);
          startDate.setDate(today.getDate() - dayOfWeek);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
          break;
        }
        case 'last_week': {
          const dayOfWeek = today.getDay();
          startDate = new Date(today);
          startDate.setDate(today.getDate() - dayOfWeek - 7);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
          break;
        }
        case 'this_month': {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        }
        case 'last_month': {
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;
        }
        case 'this_year': {
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          break;
        }
      }
    } else if (dateFrom || dateTo) {
      if (dateFrom) {
        startDate = new Date(dateFrom);
      }
      if (dateTo) {
        endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    // Build where clause
    type WhereClause = {
      userId: string;
      status?: string;
      clockIn?: {
        gte?: Date;
        lte?: Date;
      };
    };

    const whereClause: WhereClause = { userId };

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (startDate || endDate) {
      whereClause.clockIn = {};
      if (startDate) {
        whereClause.clockIn.gte = startDate;
      }
      if (endDate) {
        whereClause.clockIn.lte = endDate;
      }
    }

    // Get all filtered entries for export
    const entries = await prisma.timeclockEntry.findMany({
      where: whereClause,
      orderBy: { clockIn: 'desc' },
    });

    // Build CSV
    const escapeCSV = (value: string | null | undefined) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatDuration = (seconds: number | null) => {
      if (!seconds) return '0:00';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    };

    const formatDate = (date: Date | null) => {
      if (!date) return '';
      return new Date(date).toLocaleString();
    };

    // CSV headers
    const headers = ['Date', 'Clock In', 'Clock Out', 'Duration (h:mm)', 'Status', 'Rejection Note'];

    // CSV rows
    const rows = entries.map((entry) => {
      return [
        escapeCSV(new Date(entry.clockIn).toLocaleDateString()),
        escapeCSV(formatDate(entry.clockIn)),
        escapeCSV(entry.clockOut ? formatDate(entry.clockOut) : ''),
        escapeCSV(formatDuration(entry.duration)),
        escapeCSV(entry.status),
        escapeCSV(entry.rejectedNote),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    // Return CSV file
    const filename = `timeclock-export-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting timeclock history:', error);
    return NextResponse.json(
      { error: 'Failed to export timeclock history' },
      { status: 500 }
    );
  }
}
