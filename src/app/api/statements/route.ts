import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { parseStatementFile, ParseResult } from '@/lib/statement-parser';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

/**
 * GET /api/statements
 * List all bank statements
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user, permissions } = userWithPerms;

    // Check permissions
    const canViewAll = hasPermission(permissions, 'reports', 'canViewAll');
    const canViewOwn = hasPermission(permissions, 'reports', 'canViewOwn');

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    // If user can only view own, restrict to their statements
    if (!canViewAll && canViewOwn) {
      where.userId = user.id;
    }

    if (status) {
      where.status = status;
    }

    const [statements, total] = await Promise.all([
      prisma.bankStatement.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { transactions: true } },
        },
        orderBy: { uploadDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bankStatement.count({ where }),
    ]);

    return NextResponse.json({
      statements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching statements:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/statements
 * Upload a new bank statement
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

    const { user, permissions } = userWithPerms;

    // Check if user can create reports (repurposing reports permission for statements)
    if (!hasPermission(permissions, 'reports', 'canCreate')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const accountName = formData.get('accountName') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (50MB max)
    const MAX_STATEMENT_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_STATEMENT_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedExtensions = ['.csv', '.xlsx', '.xls', '.txt'];
    const extension = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: CSV, Excel, TXT' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse the statement file
    let parseResult: ParseResult;
    try {
      parseResult = await parseStatementFile(buffer, file.name);
    } catch (parseError) {
      console.error('Error parsing statement file:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse statement file' },
        { status: 400 }
      );
    }

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error || 'Failed to parse statement',
          headers: parseResult.headers,
        },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'uploads', 'statements');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save file
    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const savedFilename = `${timestamp}-${safeFilename}`;
    const filePath = path.join(uploadDir, savedFilename);
    await writeFile(filePath, buffer);

    // Create statement record
    const statement = await prisma.bankStatement.create({
      data: {
        userId: user.id,
        filename: file.name,
        filePath: `statements/${savedFilename}`,
        accountName: accountName || null,
        startDate: parseResult.startDate,
        endDate: parseResult.endDate,
        status: 'COMPLETED',
        transactions: {
          create: parseResult.transactions.map((t) => ({
            transactionDate: t.date,
            description: t.description,
            amount: t.amount,
            type: t.type,
          })),
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { transactions: true } },
      },
    });

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: user.id,
      action: 'STATEMENT_UPLOADED',
      entityType: 'BankStatement',
      entityId: statement.id,
      changes: {
        filename: file.name,
        transactionCount: parseResult.transactions.length,
        detectedFormat: parseResult.detectedFormat,
        dateRange: {
          start: parseResult.startDate?.toISOString(),
          end: parseResult.endDate?.toISOString(),
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      statement,
      parseInfo: {
        transactionCount: parseResult.transactions.length,
        detectedFormat: parseResult.detectedFormat,
        dateRange: {
          start: parseResult.startDate,
          end: parseResult.endDate,
        },
      },
    });
  } catch (error) {
    console.error('Error uploading statement:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
