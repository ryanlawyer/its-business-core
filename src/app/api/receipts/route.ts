import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { parsePagination } from '@/lib/validation';

/**
 * GET /api/receipts
 * List receipts with pagination and filtering
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

    // Check if user can view receipts
    const canViewAll = hasPermission(permissions, 'receipts', 'canViewAll');
    const canViewOwn = hasPermission(permissions, 'receipts', 'canViewOwn');

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const { page, limit } = parsePagination(searchParams, 20);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const vendorId = searchParams.get('vendorId');
    const budgetCategoryId = searchParams.get('budgetCategoryId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const unlinked = searchParams.get('unlinked');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const whereClause: any = {};

    // Permission-based filtering
    if (!canViewAll) {
      whereClause.userId = user.id;
    }

    // Optional filters
    if (status) {
      whereClause.status = status;
    }

    if (vendorId) {
      whereClause.vendorId = vendorId;
    }

    if (budgetCategoryId) {
      whereClause.budgetCategoryId = budgetCategoryId;
    }

    if (unlinked === 'true') {
      whereClause.purchaseOrderId = null;
    }

    if (startDate || endDate) {
      whereClause.receiptDate = {};
      if (startDate) {
        whereClause.receiptDate.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.receiptDate.lte = new Date(endDate);
      }
    }

    if (search) {
      whereClause.OR = [
        { merchantName: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    if (minAmount || maxAmount) {
      whereClause.totalAmount = {};
      if (minAmount) {
        whereClause.totalAmount.gte = parseFloat(minAmount);
      }
      if (maxAmount) {
        whereClause.totalAmount.lte = parseFloat(maxAmount);
      }
    }

    // Get total count
    const total = await prisma.receipt.count({ where: whereClause });

    // Build orderBy
    const orderBy: any = {};
    if (['createdAt', 'receiptDate', 'totalAmount', 'merchantName'].includes(sortBy)) {
      orderBy[sortBy] = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    // Fetch receipts
    const receipts = await prisma.receipt.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        vendor: {
          select: { id: true, name: true, vendorNumber: true },
        },
        budgetCategory: {
          select: { id: true, name: true, code: true },
        },
        purchaseOrder: {
          select: { id: true, poNumber: true },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        _count: {
          select: { lineItems: true },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      receipts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/receipts
 * Create a new receipt (manual entry without file upload)
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

    // Check if user can upload receipts
    if (!hasPermission(permissions, 'receipts', 'canUpload')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      merchantName,
      receiptDate,
      totalAmount,
      currency,
      taxAmount,
      vendorId,
      budgetCategoryId,
      purchaseOrderId,
      notes,
      lineItems,
    } = body;

    // Cap line items at 500 per receipt
    if (Array.isArray(lineItems) && lineItems.length > 500) {
      return NextResponse.json(
        { error: 'Too many line items. Maximum 500 items per receipt.' },
        { status: 400 }
      );
    }

    // Create the receipt
    const receipt = await prisma.receipt.create({
      data: {
        userId: session.user.id,
        merchantName,
        receiptDate: receiptDate ? new Date(receiptDate) : null,
        totalAmount: totalAmount ? parseFloat(totalAmount) : null,
        currency: currency || 'USD',
        taxAmount: taxAmount ? parseFloat(taxAmount) : null,
        vendorId: vendorId || null,
        budgetCategoryId: budgetCategoryId || null,
        purchaseOrderId: purchaseOrderId || null,
        notes: notes || null,
        status: 'REVIEWED', // Manual entries are considered reviewed
        source: 'UPLOAD',
        lineItems: lineItems?.length > 0 ? {
          create: lineItems.map((item: any) => ({
            description: item.description,
            quantity: item.quantity ? parseFloat(item.quantity) : null,
            unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : null,
            total: parseFloat(item.total),
            budgetCategoryId: item.budgetCategoryId || null,
          })),
        } : undefined,
      },
      include: {
        lineItems: true,
        vendor: { select: { id: true, name: true } },
        budgetCategory: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
      },
    });

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'RECEIPT_UPLOADED',
      entityType: 'Receipt',
      entityId: receipt.id,
      changes: { after: { merchantName, totalAmount, currency } },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ receipt }, { status: 201 });
  } catch (error) {
    console.error('Error creating receipt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
