import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

/**
 * GET /api/timeclock/manager-assignments
 * List all manager-department assignments
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canAssign = hasPermission(
      userWithPerms.permissions,
      'timeclock',
      'canAssignManagers'
    );

    if (!canAssign) {
      return NextResponse.json(
        { error: 'You do not have permission to view manager assignments' },
        { status: 403 }
      );
    }

    // Get query params
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const departmentId = searchParams.get('departmentId');

    // Build where clause
    const whereClause: {
      userId?: string;
      departmentId?: string;
    } = {};

    if (userId) {
      whereClause.userId = userId;
    }
    if (departmentId) {
      whereClause.departmentId = departmentId;
    }

    const assignments = await prisma.managerAssignment.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { user: { name: 'asc' } },
        { department: { name: 'asc' } },
      ],
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('Error fetching manager assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manager assignments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/timeclock/manager-assignments
 * Create a new manager-department assignment
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canAssign = hasPermission(
      userWithPerms.permissions,
      'timeclock',
      'canAssignManagers'
    );

    if (!canAssign) {
      return NextResponse.json(
        { error: 'You do not have permission to assign managers' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userId, departmentId } = body;

    if (!userId || !departmentId) {
      return NextResponse.json(
        { error: 'userId and departmentId are required' },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true },
    });
    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // Check if assignment already exists
    const existing = await prisma.managerAssignment.findUnique({
      where: {
        userId_departmentId: {
          userId,
          departmentId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This manager is already assigned to this department' },
        { status: 400 }
      );
    }

    const assignment = await prisma.managerAssignment.create({
      data: {
        userId,
        departmentId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'MANAGER_ASSIGNMENT_CREATED',
      entityType: 'ManagerAssignment',
      entityId: assignment.id,
      changes: {
        after: {
          userId: assignment.userId,
          userName: assignment.user.name,
          departmentId: assignment.departmentId,
          departmentName: assignment.department.name,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ assignment });
  } catch (error) {
    console.error('Error creating manager assignment:', error);
    return NextResponse.json(
      { error: 'Failed to create manager assignment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/timeclock/manager-assignments
 * Delete a manager-department assignment by userId and departmentId
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canAssign = hasPermission(
      userWithPerms.permissions,
      'timeclock',
      'canAssignManagers'
    );

    if (!canAssign) {
      return NextResponse.json(
        { error: 'You do not have permission to manage assignments' },
        { status: 403 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const departmentId = searchParams.get('departmentId');

    if (!userId || !departmentId) {
      return NextResponse.json(
        { error: 'userId and departmentId are required as query parameters' },
        { status: 400 }
      );
    }

    // Find the assignment
    const assignment = await prisma.managerAssignment.findUnique({
      where: {
        userId_departmentId: {
          userId,
          departmentId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Delete the assignment
    await prisma.managerAssignment.delete({
      where: {
        userId_departmentId: {
          userId,
          departmentId,
        },
      },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'MANAGER_ASSIGNMENT_DELETED',
      entityType: 'ManagerAssignment',
      entityId: assignment.id,
      changes: {
        before: {
          userId: assignment.userId,
          userName: assignment.user.name,
          departmentId: assignment.departmentId,
          departmentName: assignment.department.name,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting manager assignment:', error);
    return NextResponse.json(
      { error: 'Failed to delete manager assignment' },
      { status: 500 }
    );
  }
}
