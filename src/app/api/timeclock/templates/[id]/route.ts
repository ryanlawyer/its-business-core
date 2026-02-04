import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { AVAILABLE_EXPORT_FIELDS, TemplateColumn } from '../route';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/timeclock/templates/[id]
 * Get a single export template
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    const template = await prisma.exportTemplate.findUnique({
      where: { id },
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

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      template: {
        ...template,
        columns: JSON.parse(template.columns) as TemplateColumn[],
      },
    });
  } catch (error) {
    console.error('Error fetching export template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch export template' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/timeclock/templates/[id]
 * Update an export template
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
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
        { error: 'You do not have permission to update export templates' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existingTemplate = await prisma.exportTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, columns, isDefault } = body;

    // Validate name if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return NextResponse.json(
        { error: 'Template name cannot be empty' },
        { status: 400 }
      );
    }

    // Validate columns if provided
    if (columns !== undefined) {
      if (!Array.isArray(columns) || columns.length === 0) {
        return NextResponse.json(
          { error: 'At least one column is required' },
          { status: 400 }
        );
      }

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
    }

    const { ipAddress, userAgent } = getRequestContext(req);

    // If setting as default, unset any existing default (except this one)
    if (isDefault === true) {
      await prisma.exportTemplate.updateMany({
        where: {
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    const updateData: {
      name?: string;
      columns?: string;
      isDefault?: boolean;
    } = {};

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    if (columns !== undefined) {
      updateData.columns = JSON.stringify(columns);
    }

    if (isDefault !== undefined) {
      updateData.isDefault = Boolean(isDefault);
    }

    const template = await prisma.exportTemplate.update({
      where: { id },
      data: updateData,
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
      action: 'EXPORT_TEMPLATE_UPDATED',
      entityType: 'ExportTemplate',
      entityId: template.id,
      changes: {
        before: {
          name: existingTemplate.name,
          columns: JSON.parse(existingTemplate.columns),
          isDefault: existingTemplate.isDefault,
        },
        after: {
          name: template.name,
          columns: JSON.parse(template.columns),
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
    });
  } catch (error) {
    console.error('Error updating export template:', error);
    return NextResponse.json(
      { error: 'Failed to update export template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/timeclock/templates/[id]
 * Delete an export template
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
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
        { error: 'You do not have permission to delete export templates' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existingTemplate = await prisma.exportTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const { ipAddress, userAgent } = getRequestContext(req);

    await prisma.exportTemplate.delete({
      where: { id },
    });

    // Audit log
    await createAuditLog({
      userId: session.user.id,
      action: 'EXPORT_TEMPLATE_DELETED',
      entityType: 'ExportTemplate',
      entityId: id,
      changes: {
        before: {
          name: existingTemplate.name,
          columns: JSON.parse(existingTemplate.columns),
          isDefault: existingTemplate.isDefault,
        },
        after: null,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting export template:', error);
    return NextResponse.json(
      { error: 'Failed to delete export template' },
      { status: 500 }
    );
  }
}
