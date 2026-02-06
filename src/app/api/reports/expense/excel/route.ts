import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import * as XLSX from 'xlsx';

/**
 * GET /api/reports/expense/excel
 * Generate Excel expense report with multiple sheets
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user, permissions } = userWithPerms;

    // Check report permissions
    const canViewAll = hasPermission(permissions, 'reports', 'canViewAll');
    const canViewOwn = hasPermission(permissions, 'reports', 'canViewOwn');

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const categoryIds = searchParams.getAll('categoryId');
    const departmentIds = searchParams.getAll('departmentId');
    const vendorIds = searchParams.getAll('vendorId');
    const userIds = searchParams.getAll('userId');

    // Default to last 30 days if no dates provided
    const now = new Date();
    const defaultEndDate = new Date(now);
    const defaultStartDate = new Date(now);
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    const queryStartDate = startDate ? new Date(startDate) : defaultStartDate;
    const queryEndDate = endDate ? new Date(endDate) : defaultEndDate;
    queryEndDate.setHours(23, 59, 59, 999);

    // Build where clause
    const where: Record<string, unknown> = {
      status: { in: ['COMPLETED', 'REVIEWED'] },
      receiptDate: {
        gte: queryStartDate,
        lte: queryEndDate,
      },
    };

    // User restriction
    if (!canViewAll && canViewOwn) {
      where.userId = user.id;
    } else if (userIds.length > 0) {
      where.userId = { in: userIds };
    }

    if (categoryIds.length > 0) {
      where.budgetCategoryId = { in: categoryIds };
    }

    if (vendorIds.length > 0) {
      where.vendorId = { in: vendorIds };
    }

    // Fetch receipts (capped at 10,000 rows)
    const receipts = await prisma.receipt.findMany({
      where,
      include: {
        budgetCategory: { select: { id: true, name: true, code: true } },
        vendor: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
        lineItems: {
          select: {
            description: true,
            quantity: true,
            unitPrice: true,
            amount: true,
          },
        },
      },
      orderBy: { receiptDate: 'desc' },
      take: 10000,
    });

    // Filter by department if specified
    let filteredReceipts = receipts;
    if (departmentIds.length > 0) {
      filteredReceipts = receipts.filter(
        (r) => r.user?.department?.id && departmentIds.includes(r.user.department.id)
      );
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
      ['Expense Report'],
      ['Generated', new Date().toLocaleString()],
      ['Date Range', `${queryStartDate.toLocaleDateString()} - ${queryEndDate.toLocaleDateString()}`],
      [],
      ['Summary'],
      ['Total Expenses', filteredReceipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0)],
      ['Total Receipts', filteredReceipts.length],
      ['Average Expense', filteredReceipts.length > 0 ? filteredReceipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / filteredReceipts.length : 0],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Sheet 2: All Receipts
    const receiptData = filteredReceipts.map((r) => ({
      Date: r.receiptDate ? new Date(r.receiptDate).toLocaleDateString() : '',
      Merchant: r.merchantName || '',
      Amount: r.totalAmount || 0,
      Currency: r.currency,
      Category: r.budgetCategory?.name || '',
      'Category Code': r.budgetCategory?.code || '',
      Vendor: r.vendor?.name || '',
      Department: r.user?.department?.name || '',
      User: r.user?.name || '',
      Status: r.status,
    }));
    const receiptsSheet = XLSX.utils.json_to_sheet(receiptData);
    XLSX.utils.book_append_sheet(workbook, receiptsSheet, 'Receipts');

    // Sheet 3: By Category
    const categoryMap = new Map<string, { name: string; code: string | null; total: number; count: number }>();
    for (const receipt of filteredReceipts) {
      const categoryId = receipt.budgetCategoryId || 'uncategorized';
      const existing = categoryMap.get(categoryId) || {
        name: receipt.budgetCategory?.name || 'Uncategorized',
        code: receipt.budgetCategory?.code || null,
        total: 0,
        count: 0,
      };
      existing.total += receipt.totalAmount || 0;
      existing.count += 1;
      categoryMap.set(categoryId, existing);
    }
    const categoryData = Array.from(categoryMap.values())
      .sort((a, b) => b.total - a.total)
      .map((c) => ({
        Category: c.name,
        Code: c.code || '',
        'Total Amount': c.total,
        'Receipt Count': c.count,
      }));
    const categorySheet = XLSX.utils.json_to_sheet(categoryData);
    XLSX.utils.book_append_sheet(workbook, categorySheet, 'By Category');

    // Sheet 4: By Vendor
    const vendorMap = new Map<string, { name: string; total: number; count: number }>();
    for (const receipt of filteredReceipts) {
      const vendorId = receipt.vendorId || 'no-vendor';
      const existing = vendorMap.get(vendorId) || {
        name: receipt.vendor?.name || receipt.merchantName || 'Unknown Vendor',
        total: 0,
        count: 0,
      };
      existing.total += receipt.totalAmount || 0;
      existing.count += 1;
      vendorMap.set(vendorId, existing);
    }
    const vendorData = Array.from(vendorMap.values())
      .sort((a, b) => b.total - a.total)
      .map((v) => ({
        Vendor: v.name,
        'Total Amount': v.total,
        'Receipt Count': v.count,
      }));
    const vendorSheet = XLSX.utils.json_to_sheet(vendorData);
    XLSX.utils.book_append_sheet(workbook, vendorSheet, 'By Vendor');

    // Sheet 5: By Department
    const deptMap = new Map<string, { name: string; total: number; count: number }>();
    for (const receipt of filteredReceipts) {
      const dept = receipt.user?.department;
      const deptId = dept?.id || 'no-department';
      const existing = deptMap.get(deptId) || {
        name: dept?.name || 'No Department',
        total: 0,
        count: 0,
      };
      existing.total += receipt.totalAmount || 0;
      existing.count += 1;
      deptMap.set(deptId, existing);
    }
    const deptData = Array.from(deptMap.values())
      .sort((a, b) => b.total - a.total)
      .map((d) => ({
        Department: d.name,
        'Total Amount': d.total,
        'Receipt Count': d.count,
      }));
    const deptSheet = XLSX.utils.json_to_sheet(deptData);
    XLSX.utils.book_append_sheet(workbook, deptSheet, 'By Department');

    // Sheet 6: By Month
    const monthMap = new Map<string, { total: number; count: number }>();
    for (const receipt of filteredReceipts) {
      if (!receipt.receiptDate) continue;
      const date = new Date(receipt.receiptDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(monthKey) || { total: 0, count: 0 };
      existing.total += receipt.totalAmount || 0;
      existing.count += 1;
      monthMap.set(monthKey, existing);
    }
    const monthData = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        Month: month,
        'Total Amount': data.total,
        'Receipt Count': data.count,
      }));
    const monthSheet = XLSX.utils.json_to_sheet(monthData);
    XLSX.utils.book_append_sheet(workbook, monthSheet, 'By Month');

    // Sheet 7: Line Items (if any)
    const lineItemsData: Array<{
      'Receipt Date': string;
      Merchant: string;
      Description: string;
      Quantity: number | null;
      'Unit Price': number | null;
      Amount: number | null;
    }> = [];
    for (const receipt of filteredReceipts) {
      for (const item of receipt.lineItems) {
        lineItemsData.push({
          'Receipt Date': receipt.receiptDate ? new Date(receipt.receiptDate).toLocaleDateString() : '',
          Merchant: receipt.merchantName || '',
          Description: item.description || '',
          Quantity: item.quantity,
          'Unit Price': item.unitPrice,
          Amount: item.amount,
        });
      }
    }
    if (lineItemsData.length > 0) {
      const lineItemsSheet = XLSX.utils.json_to_sheet(lineItemsData);
      XLSX.utils.book_append_sheet(workbook, lineItemsSheet, 'Line Items');
    }

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `expense-report-${queryStartDate.toISOString().split('T')[0]}-${queryEndDate.toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Error generating Excel report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
