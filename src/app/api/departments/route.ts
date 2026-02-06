import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { getPermissionsFromSession, hasPermission } from '@/lib/check-permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perms = getPermissionsFromSession(session);
    if (!perms || !hasPermission(perms.permissions, 'departments', 'canView')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get departments with optional pagination
    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '0');

    const whereClause = includeInactive ? {} : { isActive: true };

    // If pagination requested
    if (page > 0 && limit > 0) {
      const total = await prisma.department.count({ where: whereClause });

      const departments = await prisma.department.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true,
              budgetItems: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
        skip: (page - 1) * limit,
        take: limit,
      });

      return NextResponse.json({
        departments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // Otherwise return all (for dropdowns, etc)
    const departments = await prisma.department.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            budgetItems: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    if (!user?.role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const permissions = JSON.parse(user.role.permissions);
    if (!permissions.departments?.canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name,
        description: description || null,
        isActive: true,
      },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'DEPARTMENT_CREATED',
      entityType: 'Department',
      entityId: department.id,
      changes: {
        after: department,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ department });
  } catch (error: any) {
    console.error('Error creating department:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Department name already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create department' },
      { status: 500 }
    );
  }
}
