import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { validatePassword } from '@/lib/settings';
import bcrypt from 'bcryptjs';

/**
 * GET /api/profile
 * Return current user's profile (no password)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role?.name || 'Unknown',
        department: user.department?.name || 'Unassigned',
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/profile
 * Update current user's name and/or password
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, currentPassword, newPassword } = body;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updateData: { name?: string; password?: string } = {};

    // Update name if provided
    if (name !== undefined) {
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      if (name.length > 200) {
        return NextResponse.json({ error: 'Name is too long (max 200 characters)' }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    // Update password if provided
    let passwordChanged = false;
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to set a new password' },
          { status: 400 }
        );
      }

      // Verify current password
      if (!user.password) {
        return NextResponse.json({ error: 'Account has no password set' }, { status: 400 });
      }
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }

      // Validate new password against policy
      const passwordResult = validatePassword(newPassword);
      if (!passwordResult.valid) {
        return NextResponse.json(
          { error: passwordResult.errors.join(', ') },
          { status: 400 }
        );
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
      passwordChanged = true;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: passwordChanged ? 'USER_PASSWORD_CHANGED' : 'USER_UPDATED',
      entityType: 'User',
      entityId: session.user.id,
      changes: {
        ...(updateData.name ? { name: { from: user.name, to: updateData.name } } : {}),
        ...(passwordChanged ? { password: '[CHANGED]' } : {}),
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
