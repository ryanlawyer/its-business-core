import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getPermissionsFromSession, hasPermission } from '@/lib/check-permissions';


export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perms = getPermissionsFromSession(session);
    if (!perms || !hasPermission(perms.permissions, 'vendors', 'canView')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    return NextResponse.json({ vendor });
  } catch (error) {
    console.error('Error fetching vendor:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perms = getPermissionsFromSession(session);
    if (!perms || !hasPermission(perms.permissions, 'vendors', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { vendorNumber, name, phone, email, address, city, state, zipCode } = body;

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        vendorNumber,
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
      },
    });

    return NextResponse.json({ vendor });
  } catch (error) {
    console.error('Error updating vendor:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perms = getPermissionsFromSession(session);
    if (!perms || !hasPermission(perms.permissions, 'vendors', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.vendor.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
