import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import {
  parseFile,
  validateRows,
  generateTemplateCSV,
  getTemplateHeaders,
  type ImportEntityType,
} from '@/lib/csv-import';

const VALID_ENTITY_TYPES: ImportEntityType[] = ['users', 'vendors', 'budgetItems'];

/**
 * POST /api/import
 * Dry-run: parse and validate CSV/XLSX file, return validation results
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

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 5MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseFile(buffer, file.name);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 });
    }

    if (rows.length > 1000) {
      return NextResponse.json(
        { error: 'Too many rows. Maximum 1000 rows per import.' },
        { status: 400 },
      );
    }

    const result = await validateRows(entityType as ImportEntityType, rows);

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error validating import:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to validate file' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/import?entityType=users
 * Download template CSV for the given entity type
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entityType');

    if (!entityType || !VALID_ENTITY_TYPES.includes(entityType as ImportEntityType)) {
      return NextResponse.json(
        { error: `Invalid entity type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    const csv = generateTemplateCSV(entityType as ImportEntityType);
    const filename = `${entityType}-import-template.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
