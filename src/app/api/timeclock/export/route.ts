import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { calculateOvertime, TimeclockEntryForCalculation } from '@/lib/overtime';
import { getSystemConfig } from '@/lib/setup-status';
import { TemplateColumn } from '../templates/shared';
import { escapeCSV } from '@/lib/csv-sanitize';
import * as XLSX from 'xlsx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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

    // Check if user can view all entries; if not, restrict to managed departments
    const canViewAll = hasPermission(
      userWithPerms.permissions,
      'timeclock',
      'canViewAllEntries'
    );

    let allowedDepartmentIds: string[] | null = null;
    if (!canViewAll) {
      // Restrict to departments the user manages via ManagerAssignment
      const managerAssignments = await prisma.managerAssignment.findMany({
        where: { userId: session.user.id },
        select: { departmentId: true },
      });

      if (managerAssignments.length > 0) {
        allowedDepartmentIds = managerAssignments.map((a) => a.departmentId);
      } else {
        // Fall back to user's own department
        const currentUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { departmentId: true },
        });
        if (currentUser?.departmentId) {
          allowedDepartmentIds = [currentUser.departmentId];
        } else {
          allowedDepartmentIds = [];
        }
      }
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
      user?: { departmentId: string | { in: string[] } };
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
    } else if (allowedDepartmentIds !== null) {
      // User cannot view all entries - restrict to allowed departments
      whereClause.user = { departmentId: { in: allowedDepartmentIds } };
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

    const timezone = await getSystemConfig('timezone') || 'UTC';
    const overtimeResult = calculateOvertime(entriesForCalc, overtimeConfig, timezone);

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

      const csv = '\uFEFF' + [headerRow, ...dataRows].join('\n');

      // Generate filename
      const filename = `timeclock-export-${periodStart}-to-${periodEnd}.csv`;

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // Generate Excel (xlsx)
    if (format === 'xlsx') {
      // Build worksheet data
      const wsData: (string | number)[][] = [];

      // Header row
      wsData.push(columns.map((col) => col.headerName));

      // Data rows
      for (const row of rows) {
        const rowData: (string | number)[] = columns.map((col) => {
          const value = row[col.sourceField as keyof ExportRow] || '';
          // Convert hour values to numbers for proper formatting
          if (['regularHours', 'dailyOvertimeHours', 'weeklyOvertimeHours', 'totalHours'].includes(col.sourceField)) {
            return parseFloat(value) || 0;
          }
          return value;
        });
        wsData.push(rowData);
      }

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Apply formatting
      // Bold header row
      const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) continue;
        ws[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'E0E0E0' } },
        };
      }

      // Auto-width columns
      const colWidths: number[] = [];
      for (let col = 0; col < columns.length; col++) {
        let maxWidth = columns[col].headerName.length;
        for (const row of rows) {
          const value = String(row[columns[col].sourceField as keyof ExportRow] || '');
          maxWidth = Math.max(maxWidth, value.length);
        }
        colWidths.push(Math.min(maxWidth + 2, 50)); // Cap at 50 chars
      }
      ws['!cols'] = colWidths.map((w) => ({ wch: w }));

      // Number formatting for hour columns
      const hourColumns = columns
        .map((col, idx) => ({ col, idx }))
        .filter(({ col }) =>
          ['regularHours', 'dailyOvertimeHours', 'weeklyOvertimeHours', 'totalHours'].includes(col.sourceField)
        );

      for (let rowIdx = 1; rowIdx <= rows.length; rowIdx++) {
        for (const { idx } of hourColumns) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowIdx, c: idx });
          if (ws[cellAddress]) {
            ws[cellAddress].z = '0.00'; // 2 decimal places
          }
        }
      }

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Timeclock Export');

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Generate filename
      const filename = `timeclock-export-${periodStart}-to-${periodEnd}.xlsx`;

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // Generate PDF (one page per employee with entry details)
    if (format === 'pdf') {
      // For PDF, we need individual entries per employee, not aggregated
      // Re-query with detailed entry data
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Group entries by employee
      const entriesByEmployee = new Map<string, typeof entries>();
      for (const entry of entries) {
        if (!entriesByEmployee.has(entry.userId)) {
          entriesByEmployee.set(entry.userId, []);
        }
        entriesByEmployee.get(entry.userId)!.push(entry);
      }

      // Generate one page per employee
      for (const [userId, empEntries] of entriesByEmployee) {
        const employee = empEntries[0].user;
        const otData = overtimeResult.employees[userId] || {
          regularMinutes: 0,
          dailyOvertimeMinutes: 0,
          weeklyOvertimeMinutes: 0,
          totalMinutes: 0,
        };

        // Create page (Letter size: 612 x 792 points)
        const page = pdfDoc.addPage([612, 792]);
        const { width, height } = page.getSize();
        let y = height - 50;

        // Header
        page.drawText('TIMESHEET', {
          x: 50,
          y,
          size: 18,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        y -= 30;

        // Employee info
        page.drawText(`Employee: ${employee.name}`, {
          x: 50,
          y,
          size: 12,
          font: boldFont,
        });
        y -= 18;

        page.drawText(`Department: ${employee.department?.name || 'N/A'}`, {
          x: 50,
          y,
          size: 10,
          font,
        });
        y -= 15;

        page.drawText(`Period: ${periodStart} to ${periodEnd}`, {
          x: 50,
          y,
          size: 10,
          font,
        });
        y -= 30;

        // Table header
        const tableX = 50;
        const colWidthsPdf = [80, 100, 100, 80, 80]; // Date, In, Out, Duration, Status
        let tableHeaderY = y;

        page.drawRectangle({
          x: tableX,
          y: tableHeaderY - 15,
          width: 440,
          height: 18,
          color: rgb(0.9, 0.9, 0.9),
        });

        const headers = ['Date', 'Clock In', 'Clock Out', 'Duration', 'Status'];
        let xPos = tableX + 5;
        for (let i = 0; i < headers.length; i++) {
          page.drawText(headers[i], {
            x: xPos,
            y: tableHeaderY - 12,
            size: 9,
            font: boldFont,
          });
          xPos += colWidthsPdf[i];
        }
        y = tableHeaderY - 20;

        // Table rows
        for (const entry of empEntries) {
          if (y < 120) {
            // Add new page if running out of space
            break; // Simplified - just truncate for now
          }

          y -= 15;
          xPos = tableX + 5;

          // Date
          const dateStr = entry.clockIn.toLocaleDateString();
          page.drawText(dateStr, { x: xPos, y, size: 9, font });
          xPos += colWidthsPdf[0];

          // Clock In
          const clockInStr = entry.clockIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          page.drawText(clockInStr, { x: xPos, y, size: 9, font });
          xPos += colWidthsPdf[1];

          // Clock Out
          const clockOutStr = entry.clockOut
            ? entry.clockOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '-';
          page.drawText(clockOutStr, { x: xPos, y, size: 9, font });
          xPos += colWidthsPdf[2];

          // Duration
          const durationMins = entry.duration ? Math.floor(entry.duration / 60) : 0;
          const durationHrs = (durationMins / 60).toFixed(2);
          page.drawText(`${durationHrs} hrs`, { x: xPos, y, size: 9, font });
          xPos += colWidthsPdf[3];

          // Status
          page.drawText(entry.status, { x: xPos, y, size: 9, font });
        }

        y -= 25;

        // Totals section
        page.drawLine({
          start: { x: tableX, y: y + 10 },
          end: { x: tableX + 440, y: y + 10 },
          thickness: 1,
          color: rgb(0, 0, 0),
        });

        y -= 5;
        page.drawText('TOTALS', { x: tableX, y, size: 10, font: boldFont });
        y -= 18;

        page.drawText(`Regular Hours: ${formatHours(otData.regularMinutes)}`, {
          x: tableX,
          y,
          size: 10,
          font,
        });
        y -= 15;

        page.drawText(`Daily Overtime: ${formatHours(otData.dailyOvertimeMinutes)}`, {
          x: tableX,
          y,
          size: 10,
          font,
        });
        y -= 15;

        page.drawText(`Weekly Overtime: ${formatHours(otData.weeklyOvertimeMinutes)}`, {
          x: tableX,
          y,
          size: 10,
          font,
        });
        y -= 15;

        page.drawText(`Total Hours: ${formatHours(otData.totalMinutes)}`, {
          x: tableX,
          y,
          size: 10,
          font: boldFont,
        });

        // Signature section at bottom
        const sigY = 80;
        page.drawLine({
          start: { x: 50, y: sigY },
          end: { x: 250, y: sigY },
          thickness: 1,
          color: rgb(0, 0, 0),
        });
        page.drawText('Employee Signature', { x: 50, y: sigY - 12, size: 8, font });

        page.drawLine({
          start: { x: 300, y: sigY },
          end: { x: 500, y: sigY },
          thickness: 1,
          color: rgb(0, 0, 0),
        });
        page.drawText('Manager Signature', { x: 300, y: sigY - 12, size: 8, font });

        page.drawText('Date: _______________', { x: 50, y: sigY - 30, size: 8, font });
        page.drawText('Date: _______________', { x: 300, y: sigY - 30, size: 8, font });
      }

      // Generate PDF bytes
      const pdfBytes = await pdfDoc.save();

      // Generate filename
      const filename = `timesheets-${periodStart}-to-${periodEnd}.pdf`;

      return new NextResponse(pdfBytes as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // For other formats, return error
    return NextResponse.json({
      error: `Unsupported format: ${format}. Supported formats: csv, xlsx, pdf`,
    }, { status: 400 });
  } catch (error) {
    console.error('Error exporting timeclock data:', error);
    return NextResponse.json(
      { error: 'Failed to export timeclock data' },
      { status: 500 }
    );
  }
}
