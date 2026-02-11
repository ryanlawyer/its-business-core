import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getPermissionsFromSession, hasPermission } from '@/lib/check-permissions';
import bcrypt from 'bcryptjs';
import { createAuditLog, getRequestContext, sanitizeData } from '@/lib/audit';
import { validatePassword } from '@/lib/settings';
import { parsePagination } from '@/lib/validation';


export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perms = getPermissionsFromSession(session);
    if (!perms || !hasPermission(perms.permissions, 'users', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse pagination parameters
    const { searchParams } = new URL(req.url);
    const { page, limit } = parsePagination(searchParams);
    const search = searchParams.get('search');
    const roleId = searchParams.get('roleId');
    const departmentId = searchParams.get('departmentId');

    // Build where clause
    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (roleId) {
      whereClause.roleId = roleId;
    }

    if (departmentId) {
      whereClause.departmentId = departmentId;
    }

    // Get total count for pagination
    const total = await prisma.user.count({ where: whereClause });

    // Fetch paginated users (use select to exclude password from query)
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        entraIdObjectId: true,
        authProvider: true,
        roleId: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
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
      users: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
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

    const perms = getPermissionsFromSession(session);
    if (!perms || !hasPermission(perms.permissions, 'users', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, password, roleId, departmentId, isActive } = body;

    if (!email || !name || !password || !roleId) {
      return NextResponse.json(
        { error: 'Email, name, password, and role are required' },
        { status: 400 }
      );
    }

    // Validate password against policy
    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) {
      return NextResponse.json({ error: passwordResult.errors.join(', ') }, { status: 400 });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        roleId,
        departmentId: departmentId || null,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        department: {
          select: {
            name: true,
          },
        },
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Audit log the creation
    const { ipAddress, userAgent } = getRequestContext(request);
    await createAuditLog({
      userId: session.user.id,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      changes: {
        after: sanitizeData(userWithoutPassword),
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
