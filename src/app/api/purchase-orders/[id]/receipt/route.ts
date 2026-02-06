import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { sanitizeFilename } from '@/lib/file-utils';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * GET /api/purchase-orders/[id]/receipt
 * Download/view receipt for a purchase order
 * Returns PDF file with appropriate headers for viewing or downloading
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Authentication check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get PO with receipt info
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: {
        id: true,
        poNumber: true,
        receiptFileName: true,
        receiptFilePath: true,
        requestedById: true,
        departmentId: true,
      },
    });

    if (!po) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    if (!po.receiptFilePath || !po.receiptFileName) {
      return NextResponse.json(
        { error: 'No receipt available for this purchase order' },
        { status: 404 }
      );
    }

    // Permission check - user must be able to view POs
    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const canView =
      po.requestedById === session.user.id ||
      hasPermission(userWithPerms.permissions, 'purchaseOrders', 'canView') ||
      hasPermission(userWithPerms.permissions, 'purchaseOrders', 'canEdit');

    if (!canView) {
      return NextResponse.json(
        { error: 'You do not have permission to view this receipt' },
        { status: 403 }
      );
    }

    // Check if file exists
    if (!existsSync(po.receiptFilePath)) {
      return NextResponse.json(
        {
          error: 'Receipt file not found on server',
          detail: 'The receipt may have been deleted or moved',
        },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await readFile(po.receiptFilePath);

    // Get query param to determine if download or inline view
    const { searchParams } = new URL(req.url);
    const download = searchParams.get('download') === 'true';

    // Set headers for PDF
    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Length', fileBuffer.length.toString());

    const safeFilename = sanitizeFilename(po.receiptFileName);

    if (download) {
      // Force download
      headers.set(
        'Content-Disposition',
        `attachment; filename="${safeFilename}"`
      );
    } else {
      // Display inline in browser
      headers.set(
        'Content-Disposition',
        `inline; filename="${safeFilename}"`
      );
    }

    // Disable caching to ensure fresh receipt is always shown
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    headers.set('X-Content-Type-Options', 'nosniff');

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Error retrieving receipt:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve receipt' },
      { status: 500 }
    );
  }
}
