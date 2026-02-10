import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getPermissionsFromSession, hasPermission } from '@/lib/check-permissions';

/**
 * GET /api/admin/ai-usage
 * Get AI usage statistics for the dashboard
 * Query params: ?period=month&year=2026&month=2
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perms = getPermissionsFromSession(session);
    if (!perms || !hasPermission(perms.permissions, 'settings', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const year = parseInt(req.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(req.nextUrl.searchParams.get('month') || String(new Date().getMonth() + 1));

    // Monthly date range
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Overall monthly stats
    const monthlyStats = await prisma.aIUsageLog.aggregate({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        durationMs: true,
      },
    });

    const successCount = await prisma.aIUsageLog.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        success: true,
      },
    });

    const totalRequests = monthlyStats._count.id;
    const totalTokens = (monthlyStats._sum.inputTokens || 0) + (monthlyStats._sum.outputTokens || 0);
    const totalDurationMs = monthlyStats._sum.durationMs || 0;
    const avgDurationMs = totalRequests > 0 ? Math.round(totalDurationMs / totalRequests) : 0;

    // By task type
    const byTask = await prisma.aIUsageLog.groupBy({
      by: ['taskType'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: {
        inputTokens: true,
        outputTokens: true,
      },
    });

    // By provider
    const byProvider = await prisma.aIUsageLog.groupBy({
      by: ['provider'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
    });

    // Daily breakdown
    const dailyLogs = await prisma.aIUsageLog.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        createdAt: true,
        inputTokens: true,
        outputTokens: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const byDay: Record<string, { requests: number; tokens: number }> = {};
    for (const log of dailyLogs) {
      const day = log.createdAt.toISOString().split('T')[0];
      if (!byDay[day]) {
        byDay[day] = { requests: 0, tokens: 0 };
      }
      byDay[day].requests++;
      byDay[day].tokens += log.inputTokens + log.outputTokens;
    }

    // Recent history
    const recentLogs = await prisma.aIUsageLog.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        taskType: true,
        provider: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        durationMs: true,
        success: true,
        errorCode: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      period: { year, month },
      overview: {
        totalRequests,
        successCount,
        failureCount: totalRequests - successCount,
        totalTokens,
        avgDurationMs,
      },
      byTask: byTask.map((t) => ({
        taskType: t.taskType,
        count: t._count.id,
        tokens: (t._sum.inputTokens || 0) + (t._sum.outputTokens || 0),
      })),
      byProvider: byProvider.map((p) => ({
        provider: p.provider,
        count: p._count.id,
      })),
      byDay: Object.entries(byDay).map(([date, stats]) => ({
        date,
        ...stats,
      })),
      recentLogs,
    });
  } catch (error) {
    console.error('Error fetching AI usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
