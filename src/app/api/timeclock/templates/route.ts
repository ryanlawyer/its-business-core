import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

// Column configuration type
export interface TemplateColumn {
  sourceField: string;
  headerName: string;
  order: number;
}

// Available fields for export templates
export const AVAILABLE_EXPORT_FIELDS = [
  { field: 'employeeId', label: 'Employee ID' },
  { field: 'employeeName', label: 'Employee Name' },
  { field: 'employeeEmail', label: 'Employee Email' },
  { field: 'department', label: 'Department' },
  { field: 'clockIn', label: 'Clock In' },
  { field: 'clockOut', label: 'Clock Out' },
  { field: 'date', label: 'Date' },
  { field: 'regularHours', label: 'Regular Hours' },
  { field: 'dailyOvertimeHours', label: 'Daily OT Hours' },
  { field: 'weeklyOvertimeHours', label: 'Weekly OT Hours' },
  { field: 'totalHours', label: 'Total Hours' },
  { field: 'status', label: 'Status' },
  { field: 'approvedBy', label: 'Approved By' },
  { field: 'approvedAt', label: 'Approved At' },
];

/**
 * GET /api/timeclock/templates
 * Get all export templates
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

    const canManage = hasPermission(
      userWithPerms.permissions,
      'timeclock',
      'canManageExportTemplates'
    );

    // Users with canExportPayroll can view templates but not manage them
    const canExport = hasPermission(
      userWithPerms.permissions,
      'timeclock',
      'canExportPayroll'
    );

    if (!canManage && !canExport) {
      return NextResponse.json(
        { error: 'You do not have permission to view export templates' },
        { status: 403 }
      );
    }

    const templates = await prisma.exportTemplate.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Parse columns JSON for each template
    const templatesWithParsedColumns = templates.map((template) => ({
      ...template,
      columns: JSON.parse(template.columns) as TemplateColumn[],
    }));

    return NextResponse.json({
      templates: templatesWithParsedColumns,
      availableFields: AVAILABLE_EXPORT_FIELDS,
    });
  } catch (error) {
    console.error('Error fetching export templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch export templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/timeclock/templates
 * Create a new export template
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

    const canManage = hasPermission(
      userWithPerms.permissions,
      'timeclock',
      'canManageExportTemplates'
    );

    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to create export templates' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, columns, isDefault } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json(
        { error: 'At least one column is required' },
        { status: 400 }
      );
    }

    // Validate columns
    const validFields = AVAILABLE_EXPORT_FIELDS.map((f) => f.field);
    for (const col of columns) {
      if (!col.sourceField || !validFields.includes(col.sourceField)) {
        return NextResponse.json(
          { error: `Invalid source field: ${col.sourceField}` },
          { status: 400 }
        );
      }
      if (!col.headerName || typeof col.headerName !== 'string') {
        return NextResponse.json(
          { error: 'Each column must have a header name' },
          { status: 400 }
        );
      }
    }

    const { ipAddress, userAgent } = getRequestContext(req);

    // If setting as default, unset any existing default
    if (isDefault) {
      await prisma.exportTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.exportTemplate.create({
      data: {
        name: name.trim(),
        columns: JSON.stringify(columns),
        isDefault: Boolean(isDefault),
        createdById: session.user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    await createAuditLog({
      userId: session.user.id,
      action: 'EXPORT_TEMPLATE_CREATED',
      entityType: 'ExportTemplate',
      entityId: template.id,
      changes: {
        before: null,
        after: {
          name: template.name,
          columns: columns,
          isDefault: template.isDefault,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      template: {
        ...template,
        columns: JSON.parse(template.columns),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating export template:', error);
    return NextResponse.json(
      { error: 'Failed to create export template' },
      { status: 500 }
    );
  }
}
