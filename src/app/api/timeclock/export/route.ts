import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { calculateOvertime, TimeclockEntryForCalculation } from '@/lib/overtime';
import { AVAILABLE_EXPORT_FIELDS, TemplateColumn } from '../templates/route';

// Default columns if no template specified
const DEFAULT_COLUMNS: TemplateColumn[] = [
  { sourceField: 'employeeId', headerName: 'Employee ID', order: 0 },
  { sourceField: 'employeeName', headerName: 'Employee Name', order: 1 },
  { sourceField: 'department', headerName: 'Department', order: 2 },
  { sourceField: 'regularHours', headerName: 'Regular Hours', order: 3 },
  { sourceField: 'dailyOvertimeHours', headerName: 'Daily OT Hours', order: 4 },
  { sourceField: 'weeklyOvertimeHours', headerName: 'Weekly OT Hours', order: 5 },
  { sourceField: 'totalHours', headerName: 'Total Hours', order: 6 },
];

interface ExportRow {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  clockIn: string;
  clockOut: string;
  date: string;
  regularHours: string;
  dailyOvertimeHours: string;
  weeklyOvertimeHours: string;
  totalHours: string;
  status: string;
  approvedBy: string;
  approvedAt: string;
}

/**
 * Escape a value for CSV (handle commas and quotes)
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format minutes as hours with 2 decimal places
 */
function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

/**
 * GET /api/timeclock/export
 * Export timeclock data in various formats
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

    const canExport = hasPermission(
      userWithPerms.permissions,
      'timeclock',
      'canExportPayroll'
    );

    if (!canExport) {
      return NextResponse.json(
        { error: 'You do not have permission to export payroll data' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');
    const departmentId = searchParams.get('departmentId');
    const templateId = searchParams.get('templateId');

    // Validate date params
    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'periodStart and periodEnd are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    endDate.setHours(23, 59, 59, 999); // End of day

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Get template columns
    let columns: TemplateColumn[] = DEFAULT_COLUMNS;

    if (templateId) {
      const template = await prisma.exportTemplate.findUnique({
        where: { id: templateId },
      });

      if (template) {
        columns = JSON.parse(template.columns) as TemplateColumn[];
      }
    } else {
      // Try to use default template
      const defaultTemplate = await prisma.exportTemplate.findFirst({
        where: { isDefault: true },
      });

      if (defaultTemplate) {
        columns = JSON.parse(defaultTemplate.columns) as TemplateColumn[];
      }
    }

    // Sort columns by order
    columns = columns.sort((a, b) => a.order - b.order);

    // Build where clause for entries
    const whereClause: {
      status: string;
      clockIn: { gte: Date; lte: Date };
      clockOut: { not: null };
      user?: { departmentId: string };
    } = {
      status: 'approved',
      clockIn: {
        gte: startDate,
        lte: endDate,
      },
      clockOut: {
        not: null,
      },
    };

    if (departmentId && departmentId !== 'all') {
      whereClause.user = { departmentId };
    }

    // Fetch approved entries with user data
    const entries = await prisma.timeclockEntry.findMany({
      where: whereClause,
      include: {
        user: {
          include: {
            department: true,
          },
        },
      },
      orderBy: [
        { userId: 'asc' },
        { clockIn: 'asc' },
      ],
    });

    // Get overtime config for calculations
    const overtimeConfig = await prisma.overtimeConfig.findFirst();

    // Calculate overtime per employee
    const entriesForCalc: TimeclockEntryForCalculation[] = entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      clockIn: e.clockIn,
      clockOut: e.clockOut,
      duration: e.duration,
      status: e.status,
    }));

    const overtimeResult = calculateOvertime(entriesForCalc, overtimeConfig);

    // Get approver names
    const approverIds = [...new Set(entries.filter(e => e.approvedBy).map(e => e.approvedBy!))];
    const approvers = await prisma.user.findMany({
      where: { id: { in: approverIds } },
      select: { id: true, name: true },
    });
    const approverMap = new Map(approvers.map(a => [a.id, a.name]));

    // Build export rows - one row per employee with aggregated data
    const employeeMap = new Map<string, ExportRow>();

    for (const entry of entries) {
      const userId = entry.userId;

      if (!employeeMap.has(userId)) {
        const otData = overtimeResult.employees[userId] || {
          regularMinutes: 0,
          dailyOvertimeMinutes: 0,
          weeklyOvertimeMinutes: 0,
          totalMinutes: 0,
        };

        employeeMap.set(userId, {
          employeeId: userId,
          employeeName: entry.user.name,
          employeeEmail: entry.user.email,
          department: entry.user.department?.name || '',
          clockIn: '', // Not applicable for summary
          clockOut: '', // Not applicable for summary
          date: '', // Not applicable for summary
          regularHours: formatHours(otData.regularMinutes),
          dailyOvertimeHours: formatHours(otData.dailyOvertimeMinutes),
          weeklyOvertimeHours: formatHours(otData.weeklyOvertimeMinutes),
          totalHours: formatHours(otData.totalMinutes),
          status: 'approved',
          approvedBy: '', // Multiple approvers possible
          approvedAt: '', // Multiple dates possible
        });
      }
    }

    const rows = Array.from(employeeMap.values());

    // Generate CSV
    if (format === 'csv') {
      // Build header row
      const headerRow = columns.map((col) => escapeCSV(col.headerName)).join(',');

      // Build data rows
      const dataRows = rows.map((row) => {
        return columns
          .map((col) => {
            const value = row[col.sourceField as keyof ExportRow] || '';
            return escapeCSV(value);
          })
          .join(',');
      });

      const csv = [headerRow, ...dataRows].join('\n');

      // Generate filename
      const filename = `timeclock-export-${periodStart}-to-${periodEnd}.csv`;

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // For other formats, return JSON for now (Excel/PDF handled in TC-025/TC-026)
    return NextResponse.json({
      format,
      periodStart,
      periodEnd,
      columns,
      rows,
      message: `Format '${format}' not yet implemented`,
    });
  } catch (error) {
    console.error('Error exporting timeclock data:', error);
    return NextResponse.json(
      { error: 'Failed to export timeclock data' },
      { status: 500 }
    );
  }
}
