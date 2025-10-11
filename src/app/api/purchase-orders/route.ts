import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, canViewAllData, canViewDepartmentData } from '@/lib/check-permissions';


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

    // Parse pagination parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Build query based on permissions
    let whereClause: any = {};

    if (canViewAllData(permissions, 'purchaseOrders')) {
      // Can view all POs - no filter
    } else if (canViewDepartmentData(permissions, 'purchaseOrders') && user.departmentId) {
      // Can view department POs
      whereClause.departmentId = user.departmentId;
    } else if (permissions.purchaseOrders?.canViewOwn) {
      // Can only view own POs
      whereClause.requestedById = user.id;
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Add optional filters
    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { poNumber: { contains: search } },
        { vendor: { name: { contains: search } } },
      ];
    }

    // Get total count for pagination
    const total = await prisma.purchaseOrder.count({ where: whereClause });

    // Fetch paginated results
    const orders = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        vendor: {
          select: {
            name: true,
            vendorNumber: true,
          },
        },
      },
      orderBy: {
        poDate: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    // Check if user can create POs
    if (!permissions.purchaseOrders?.canCreate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { vendorId, department, note, lineItems } = body;

    // Validate
    if (!vendorId || !lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Vendor and line items are required' },
        { status: 400 }
      );
    }

    // Calculate total
    const totalAmount = lineItems.reduce(
      (sum: number, item: any) => sum + parseFloat(item.amount),
      0
    );

    // Generate PO number
    const year = new Date().getFullYear();
    const count = await prisma.purchaseOrder.count();
    const poNumber = `PO-${year}-${String(count + 1).padStart(3, '0')}`;

    // Create PO with line items
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        poDate: new Date(),
        vendorId,
        requestedById: user.id,
        departmentId: user.departmentId,
        notes: note || null,
        status: 'DRAFT',
        totalAmount,
        lineItems: {
          create: lineItems.map((item: any) => ({
            description: item.description,
            amount: parseFloat(item.amount),
            budgetItemId: item.budgetItemId,
          })),
        },
      },
      include: {
        vendor: true,
        lineItems: {
          include: {
            budgetItem: true,
          },
        },
      },
    });

    return NextResponse.json({ po });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
