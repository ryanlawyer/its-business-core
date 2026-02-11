import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext, type AuditEntityType } from '@/lib/audit';
import {
  parseFile,
  validateRows,
  executeImport,
  type ImportEntityType,
} from '@/lib/csv-import';

const VALID_ENTITY_TYPES: ImportEntityType[] = ['users', 'vendors', 'budgetItems'];

const ENTITY_TYPE_MAP: Record<ImportEntityType, AuditEntityType> = {
  users: 'User',
  vendors: 'Vendor',
  budgetItems: 'BudgetItem',
};

/**
 * POST /api/import/execute
 * Execute import: re-validate then create records in a transaction
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { permissions } = userWithPerms;

    if (!hasPermission(permissions, 'settings', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const entityType = formData.get('entityType') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!entityType || !VALID_ENTITY_TYPES.includes(entityType as ImportEntityType)) {
      return NextResponse.json(
        { error: `Invalid entity type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 5MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseFile(buffer, file.name);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // Re-validate before executing
    const validation = await validateRows(entityType as ImportEntityType, rows);

    if (validation.validRows === 0) {
      return NextResponse.json(
        { error: 'No valid rows to import', validation },
        { status: 400 },
      );
    }

    // Execute import
    const result = await executeImport(
      entityType as ImportEntityType,
      validation.rows,
    );

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    createAuditLog({
      userId: session.user.id,
      action: 'DATA_IMPORTED',
      entityType: ENTITY_TYPE_MAP[entityType as ImportEntityType],
      changes: {
        after: {
          entityType,
          totalRows: validation.totalRows,
          created: result.created,
          errors: result.errors.length,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      result,
      validation: {
        totalRows: validation.totalRows,
        validRows: validation.validRows,
        errorRows: validation.errorRows,
      },
    });
  } catch (error) {
    console.error('Error executing import:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 },
    );
  }
}
