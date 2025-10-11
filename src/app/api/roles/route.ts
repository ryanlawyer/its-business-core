import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';
import { createAuditLog, getRequestContext } from '@/lib/audit';

// GET /api/roles - Get all roles (with caching)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check cache first
    const cacheKey = 'roles:all';
    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      return NextResponse.json({ roles: cached });
    }

    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    // Parse permissions JSON for each role
    const rolesWithParsedPermissions = roles.map((role) => {
      try {
        return {
          ...role,
          permissions: JSON.parse(role.permissions),
        };
      } catch (error) {
        console.error(`Error parsing permissions for role ${role.code}:`, error);
        return {
          ...role,
          permissions: {},
        };
      }
    });

    // Cache for 5 minutes
    cache.set(cacheKey, rolesWithParsedPermissions);

    return NextResponse.json({ roles: rolesWithParsedPermissions });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

// POST /api/roles - Create new role
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to manage roles
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    if (!user?.role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userPermissions = JSON.parse(user.role.permissions);
    if (!userPermissions.roles?.canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, code, description, permissions } = body;

    // Validate required fields
    if (!name || !code) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      );
    }

    // Create role
    const role = await prisma.role.create({
      data: {
        name,
        code: code.toUpperCase(),
        description,
        permissions: JSON.stringify(permissions || {}),
        isSystem: false,
      },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'ROLE_CREATED',
      entityType: 'Role',
      entityId: role.id,
      changes: {
        after: {
          name: role.name,
          code: role.code,
          description: role.description,
          permissions: JSON.parse(role.permissions),
        },
      },
      ipAddress,
      userAgent,
    });

    // Invalidate cache
    cache.clear('roles:all');

    return NextResponse.json({
      role: {
        ...role,
        permissions: JSON.parse(role.permissions),
      },
    });
  } catch (error: any) {
    console.error('Error creating role:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Role with this name or code already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}
