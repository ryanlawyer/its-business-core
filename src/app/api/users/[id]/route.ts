import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { permissions } from '@/lib/permissions';
import bcrypt from 'bcryptjs';
import { createAuditLog, getRequestContext, sanitizeData, getChanges } from '@/lib/audit';


export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!permissions.canManageUsers(session.user.role as any)) {
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
