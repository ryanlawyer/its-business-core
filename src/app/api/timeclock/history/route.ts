import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { parsePagination } from '@/lib/validation';

/**
 * GET /api/timeclock/history
 * Get paginated timeclock history for the current user
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
        { error: 'You do not have permission to view your time entries' },
        { status: 403 }
      );
    }

    const userId = session.user.id;
    const searchParams = req.nextUrl.searchParams;

    // Parse query params
    const { page, limit } = parsePagination(searchParams, 20);
    const status = searchParams.get('status'); // all, pending, approved, rejected
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const preset = searchParams.get('preset'); // this_week, last_week, this_month, last_month, this_year

    // Calculate offset
    const offset = (page - 1) * limit;

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
      // Use explicit date range
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

    // Get total count
    const totalCount = await prisma.timeclockEntry.count({
      where: whereClause,
    });

    // Get paginated entries
    const entries = await prisma.timeclockEntry.findMany({
      where: whereClause,
      orderBy: { clockIn: 'desc' },
      skip: offset,
      take: limit,
    });

    // Calculate summary stats for the filtered period
    const allFilteredEntries = await prisma.timeclockEntry.findMany({
      where: whereClause,
      select: {
        duration: true,
        status: true,
      },
    });

    const totalMinutes = allFilteredEntries.reduce((sum, e) => {
      return sum + Math.floor((e.duration || 0) / 60);
    }, 0);

    const statusCounts = {
      pending: allFilteredEntries.filter((e) => e.status === 'pending').length,
      approved: allFilteredEntries.filter((e) => e.status === 'approved').length,
      rejected: allFilteredEntries.filter((e) => e.status === 'rejected').length,
    };

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
      summary: {
        totalMinutes,
        statusCounts,
      },
      filters: {
        status: status || 'all',
        dateFrom: startDate?.toISOString() || null,
        dateTo: endDate?.toISOString() || null,
        preset: preset || null,
      },
    });
  } catch (error) {
    console.error('Error fetching timeclock history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeclock history' },
      { status: 500 }
    );
  }
}
