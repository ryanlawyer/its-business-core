import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';
import { createAuditLog, getRequestContext, getChanges } from '@/lib/audit';


// PUT /api/roles/[id] - Update role
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id: params.id },
    });

    if (!existingRole) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Prevent editing system role codes
    if (existingRole.isSystem && code && code !== existingRole.code) {
      return NextResponse.json(
        { error: 'Cannot change code of system roles' },
        { status: 400 }
      );
    }

    // Prevent non-admin users from setting _isAdmin flag
    if (permissions?._isAdmin === true && !userPermissions._isAdmin) {
      return NextResponse.json({ error: 'Cannot set admin flag' }, { status: 403 });
    }

    // Update role
    const role = await prisma.role.update({
      where: { id: params.id },
      data: {
        name: name || existingRole.name,
        code: code ? code.toUpperCase() : existingRole.code,
        description,
        permissions: permissions ? JSON.stringify(permissions) : existingRole.permissions,
      },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: user.id,
      action: 'ROLE_UPDATED',
      entityType: 'Role',
      entityId: role.id,
      changes: getChanges(
        {
          name: existingRole.name,
          code: existingRole.code,
          description: existingRole.description,
          permissions: JSON.parse(existingRole.permissions),
        },
        {
          name: role.name,
          code: role.code,
          description: role.description,
          permissions: JSON.parse(role.permissions),
        }
      ),
      ipAddress,
      userAgent,
    });

    // Invalidate cache
    cache.delete('roles:all');

    return NextResponse.json({
      role: {
        ...role,
        permissions: JSON.parse(role.permissions),
      },
    });
  } catch (error: any) {
    console.error('Error updating role:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Role with this name or code already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

// DELETE /api/roles/[id] - Delete role
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Prevent deleting system roles
    if (role.isSystem) {
      return NextResponse.json(
        { error: 'Cannot delete system roles' },
        { status: 400 }
      );
    }

    // Prevent deleting roles with assigned users
    if (role._count.users > 0) {
      return NextResponse.json(
        { error: `Cannot delete role with ${role._count.users} assigned user(s)` },
        { status: 400 }
      );
    }

    // Delete role
    await prisma.role.delete({
      where: { id: params.id },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: user.id,
      action: 'ROLE_DELETED',
      entityType: 'Role',
      entityId: role.id,
      changes: {
        before: {
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
    cache.delete('roles:all');

    return NextResponse.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
  }
}
