import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { sanitizeCSVValue } from '@/lib/csv-sanitize';

type ExpenseByCategory = {
  categoryId: string | null;
  categoryName: string;
  categoryCode: string | null;
  totalAmount: number;
  receiptCount: number;
};

type ExpenseByDepartment = {
  departmentId: string | null;
  departmentName: string;
  totalAmount: number;
  receiptCount: number;
};

type ExpenseByVendor = {
  vendorId: string | null;
  vendorName: string;
  totalAmount: number;
  receiptCount: number;
};

type ExpenseByMonth = {
  month: string;
  totalAmount: number;
  receiptCount: number;
};

type ReceiptDetail = {
  id: string;
  merchantName: string | null;
  receiptDate: string | null;
  totalAmount: number | null;
  currency: string;
  status: string;
  category: { id: string; name: string; code: string | null } | null;
  vendor: { id: string; name: string } | null;
  user: { id: string; name: string | null } | null;
  lineItems: Array<{
    description: string | null;
    quantity: number | null;
    unitPrice: number | null;
    total: number | null;
  }>;
};

export interface ExpenseReport {
  title: string;
  generatedAt: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  filters: {
    categoryIds?: string[];
    departmentIds?: string[];
    vendorIds?: string[];
    userIds?: string[];
  };
  summary: {
    totalExpenses: number;
    receiptCount: number;
    averageExpense: number;
    topCategory: string | null;
    topVendor: string | null;
  };
  byCategory: ExpenseByCategory[];
  byDepartment: ExpenseByDepartment[];
  byVendor: ExpenseByVendor[];
  byMonth: ExpenseByMonth[];
  receipts: ReceiptDetail[];
}

/**
 * GET /api/reports/expense
 * Generate expense report with optional filters
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
    const format = searchParams.get('format') || 'json'; // json, csv, excel

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
            total: true,
          },
        },
      },
      orderBy: { receiptDate: 'desc' },
      take: 10000,
    });

    // Filter by department if specified (needs post-filter due to nested relation)
    let filteredReceipts = receipts;
    if (departmentIds.length > 0) {
      filteredReceipts = receipts.filter(
        (r) => r.user?.department?.id && departmentIds.includes(r.user.department.id)
      );
    }

    // Calculate summary stats
    const totalExpenses = filteredReceipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    const receiptCount = filteredReceipts.length;
    const averageExpense = receiptCount > 0 ? totalExpenses / receiptCount : 0;

    // Group by category
    const categoryMap = new Map<string, ExpenseByCategory>();
    for (const receipt of filteredReceipts) {
      const categoryId = receipt.budgetCategoryId || 'uncategorized';
      const existing = categoryMap.get(categoryId) || {
        categoryId: receipt.budgetCategoryId,
        categoryName: receipt.budgetCategory?.name || 'Uncategorized',
        categoryCode: receipt.budgetCategory?.code || null,
        totalAmount: 0,
        receiptCount: 0,
      };
      existing.totalAmount += receipt.totalAmount || 0;
      existing.receiptCount += 1;
      categoryMap.set(categoryId, existing);
    }
    const byCategory = Array.from(categoryMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

    // Group by department
    const departmentMap = new Map<string, ExpenseByDepartment>();
    for (const receipt of filteredReceipts) {
      const dept = receipt.user?.department;
      const departmentId = dept?.id || 'no-department';
      const existing = departmentMap.get(departmentId) || {
        departmentId: dept?.id || null,
        departmentName: dept?.name || 'No Department',
        totalAmount: 0,
        receiptCount: 0,
      };
      existing.totalAmount += receipt.totalAmount || 0;
      existing.receiptCount += 1;
      departmentMap.set(departmentId, existing);
    }
    const byDepartment = Array.from(departmentMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

    // Group by vendor
    const vendorMap = new Map<string, ExpenseByVendor>();
    for (const receipt of filteredReceipts) {
      const vendorId = receipt.vendorId || 'no-vendor';
      const existing = vendorMap.get(vendorId) || {
        vendorId: receipt.vendorId,
        vendorName: receipt.vendor?.name || receipt.merchantName || 'Unknown Vendor',
        totalAmount: 0,
        receiptCount: 0,
      };
      existing.totalAmount += receipt.totalAmount || 0;
      existing.receiptCount += 1;
      vendorMap.set(vendorId, existing);
    }
    const byVendor = Array.from(vendorMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

    // Group by month
    const monthMap = new Map<string, ExpenseByMonth>();
    for (const receipt of filteredReceipts) {
      if (!receipt.receiptDate) continue;
      const date = new Date(receipt.receiptDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(monthKey) || {
        month: monthKey,
        totalAmount: 0,
        receiptCount: 0,
      };
      existing.totalAmount += receipt.totalAmount || 0;
      existing.receiptCount += 1;
      monthMap.set(monthKey, existing);
    }
    const byMonth = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    // Build report
    const report: ExpenseReport = {
      title: 'Expense Report',
      generatedAt: new Date().toISOString(),
      dateRange: {
        startDate: queryStartDate.toISOString(),
        endDate: queryEndDate.toISOString(),
      },
      filters: {
        categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
        departmentIds: departmentIds.length > 0 ? departmentIds : undefined,
        vendorIds: vendorIds.length > 0 ? vendorIds : undefined,
        userIds: userIds.length > 0 ? userIds : undefined,
      },
      summary: {
        totalExpenses,
        receiptCount,
        averageExpense,
        topCategory: byCategory.length > 0 ? byCategory[0].categoryName : null,
        topVendor: byVendor.length > 0 ? byVendor[0].vendorName : null,
      },
      byCategory,
      byDepartment,
      byVendor,
      byMonth,
      receipts: filteredReceipts.map((r) => ({
        id: r.id,
        merchantName: r.merchantName,
        receiptDate: r.receiptDate?.toISOString() || null,
        totalAmount: r.totalAmount,
        currency: r.currency,
        status: r.status,
        category: r.budgetCategory,
        vendor: r.vendor,
        user: r.user ? { id: r.user.id, name: r.user.name } : null,
        lineItems: r.lineItems,
      })),
    };

    // Handle different export formats
    if (format === 'csv') {
      const csv = generateCSV(report);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="expense-report-${queryStartDate.toISOString().split('T')[0]}-${queryEndDate.toISOString().split('T')[0]}.csv"`,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating expense report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateCSV(report: ExpenseReport): string {
  const lines: string[] = [];

  // UTF-8 BOM prefix
  const bom = '\uFEFF';

  // Header
  lines.push('Expense Report');
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push(`Date Range: ${new Date(report.dateRange.startDate).toLocaleDateString()} - ${new Date(report.dateRange.endDate).toLocaleDateString()}`);
  lines.push('');

  // Summary
  lines.push('Summary');
  lines.push(`Total Expenses,${report.summary.totalExpenses.toFixed(2)}`);
  lines.push(`Receipt Count,${report.summary.receiptCount}`);
  lines.push(`Average Expense,${report.summary.averageExpense.toFixed(2)}`);
  lines.push('');

  // By Category
  lines.push('Expenses by Category');
  lines.push('Category,Code,Total Amount,Receipt Count');
  for (const cat of report.byCategory) {
    const catName = sanitizeCSVValue(cat.categoryName);
    const catCode = sanitizeCSVValue(cat.categoryCode || '');
    lines.push(`"${catName}","${catCode}",${cat.totalAmount.toFixed(2)},${cat.receiptCount}`);
  }
  lines.push('');

  // By Vendor
  lines.push('Expenses by Vendor');
  lines.push('Vendor,Total Amount,Receipt Count');
  for (const vendor of report.byVendor) {
    const vendorName = sanitizeCSVValue(vendor.vendorName);
    lines.push(`"${vendorName}",${vendor.totalAmount.toFixed(2)},${vendor.receiptCount}`);
  }
  lines.push('');

  // Receipt Details
  lines.push('Receipt Details');
  lines.push('Date,Merchant,Amount,Currency,Category,Vendor,Status');
  for (const receipt of report.receipts) {
    const date = receipt.receiptDate ? new Date(receipt.receiptDate).toLocaleDateString() : '';
    const merchantName = sanitizeCSVValue(receipt.merchantName || '');
    const categoryName = sanitizeCSVValue(receipt.category?.name || '');
    const vendorName = sanitizeCSVValue(receipt.vendor?.name || '');
    lines.push(
      `${date},"${merchantName}",${(receipt.totalAmount || 0).toFixed(2)},${receipt.currency},"${categoryName}","${vendorName}",${receipt.status}`
    );
  }

  return bom + lines.join('\n');
}
