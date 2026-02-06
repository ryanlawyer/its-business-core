import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getPermissionsFromSession, hasPermission } from '@/lib/check-permissions';
import bcrypt from 'bcryptjs';
import { createAuditLog, getRequestContext, sanitizeData, getChanges } from '@/lib/audit';
import { validatePassword } from '@/lib/settings';


export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perms = getPermissionsFromSession(session);
    if (!perms || !hasPermission(perms.permissions, 'users', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { email, name, password, roleId, departmentId, isActive } = body;

    // Get current user state for audit log
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        role: { select: { id: true, name: true, code: true } },
        department: { select: { name: true } },
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Cannot change own role
    if (id === session.user.id && roleId && roleId !== existingUser.roleId) {
      return NextResponse.json({ error: 'Cannot change own role' }, { status: 403 });
    }

    // Cannot deactivate own account
    if (id === session.user.id && isActive === false) {
      return NextResponse.json({ error: 'Cannot deactivate own account' }, { status: 403 });
    }

    const updateData: any = {
      email,
      name,
      roleId,
      departmentId: departmentId || null,
      isActive,
    };

    // Only update password if provided
    let passwordChanged = false;
    if (password) {
      const passwordResult = validatePassword(password);
      if (!passwordResult.valid) {
        return NextResponse.json({ error: passwordResult.errors.join(', ') }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(password, 10);
      passwordChanged = true;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
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
    const { password: __, ...existingWithoutPassword } = existingUser;

    // Audit log the update
    const { ipAddress, userAgent } = getRequestContext(request);
    const changes = getChanges(
      sanitizeData(existingWithoutPassword),
      sanitizeData(userWithoutPassword)
    );

    await createAuditLog({
      userId: session.user.id,
      action: passwordChanged ? 'USER_PASSWORD_CHANGED' : 'USER_UPDATED',
      entityType: 'User',
      entityId: user.id,
      changes,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
