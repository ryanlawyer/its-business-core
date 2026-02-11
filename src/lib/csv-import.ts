import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export type ImportEntityType = 'users' | 'vendors' | 'budgetItems';

export interface ImportRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
}

export interface ImportResult {
  entityType: ImportEntityType;
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: ImportRow[];
}

export interface ExecuteResult {
  entityType: ImportEntityType;
  created: number;
  errors: { rowNumber: number; error: string }[];
}

const REQUIRED_FIELDS: Record<ImportEntityType, string[]> = {
  users: ['email', 'name', 'role'],
  vendors: ['vendorNumber', 'name'],
  budgetItems: ['code', 'description', 'budgetAmount', 'fiscalYear'],
};

const OPTIONAL_FIELDS: Record<ImportEntityType, string[]> = {
  users: ['department'],
  vendors: ['phone', 'email', 'address', 'city', 'state', 'zipCode'],
  budgetItems: ['department', 'category', 'accrualType', 'glAccountCode'],
};

export function getTemplateHeaders(entityType: ImportEntityType): string[] {
  return [...REQUIRED_FIELDS[entityType], ...OPTIONAL_FIELDS[entityType]];
}

export function generateTemplateCSV(entityType: ImportEntityType): string {
  const headers = getTemplateHeaders(entityType);
  return '\uFEFF' + headers.join(',') + '\n';
}

/**
 * Parse CSV/XLSX file buffer into rows
 */
export function parseFile(buffer: Buffer, _fileName: string): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('No sheets found in file');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: '',
    raw: false,
  });

  return rows;
}

/**
 * Validate parsed rows against entity type requirements
 */
export async function validateRows(
  entityType: ImportEntityType,
  rows: Record<string, string>[],
): Promise<ImportResult> {
  const required = REQUIRED_FIELDS[entityType];
  const importRows: ImportRow[] = [];

  // Pre-fetch existing data for uniqueness checks
  const existingData = await fetchExistingData(entityType);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors: string[] = [];

    // Check required fields
    for (const field of required) {
      const value = row[field]?.trim();
      if (!value) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Entity-specific validation
    switch (entityType) {
      case 'users':
        validateUserRow(row, errors, existingData as Set<string>, i, importRows);
        break;
      case 'vendors':
        validateVendorRow(row, errors, existingData as Set<string>, i, importRows);
        break;
      case 'budgetItems':
        validateBudgetItemRow(row, errors, existingData as Set<string>, i, importRows);
        break;
    }

    importRows.push({
      rowNumber: i + 2, // +2 for 1-indexed + header row
      data: row,
      errors,
      valid: errors.length === 0,
    });
  }

  const validRows = importRows.filter((r) => r.valid).length;

  return {
    entityType,
    totalRows: importRows.length,
    validRows,
    errorRows: importRows.length - validRows,
    rows: importRows,
  };
}

function validateUserRow(
  row: Record<string, string>,
  errors: string[],
  existingEmails: Set<string>,
  index: number,
  previousRows: ImportRow[],
) {
  const email = row.email?.trim().toLowerCase();
  if (email) {
    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Invalid email format');
    }
    // Check against existing DB
    if (existingEmails.has(email)) {
      errors.push(`Email "${email}" already exists`);
    }
    // Check against previous rows in this import
    const duplicate = previousRows.find(
      (r) => r.valid && r.data.email?.trim().toLowerCase() === email,
    );
    if (duplicate) {
      errors.push(`Duplicate email in file (row ${duplicate.rowNumber})`);
    }
  }

  const role = row.role?.trim().toUpperCase();
  if (role && !['USER', 'MANAGER', 'ADMIN'].includes(role)) {
    errors.push(`Invalid role: ${role}. Must be USER, MANAGER, or ADMIN`);
  }
}

function validateVendorRow(
  row: Record<string, string>,
  errors: string[],
  existingVendorNumbers: Set<string>,
  index: number,
  previousRows: ImportRow[],
) {
  const vendorNumber = row.vendorNumber?.trim();
  if (vendorNumber) {
    if (existingVendorNumbers.has(vendorNumber)) {
      errors.push(`Vendor number "${vendorNumber}" already exists`);
    }
    const duplicate = previousRows.find(
      (r) => r.valid && r.data.vendorNumber?.trim() === vendorNumber,
    );
    if (duplicate) {
      errors.push(`Duplicate vendor number in file (row ${duplicate.rowNumber})`);
    }
  }
}

function validateBudgetItemRow(
  row: Record<string, string>,
  errors: string[],
  existingCodes: Set<string>,
  index: number,
  previousRows: ImportRow[],
) {
  const code = row.code?.trim();
  if (code) {
    if (existingCodes.has(code)) {
      errors.push(`Budget item code "${code}" already exists`);
    }
    const duplicate = previousRows.find(
      (r) => r.valid && r.data.code?.trim() === code,
    );
    if (duplicate) {
      errors.push(`Duplicate code in file (row ${duplicate.rowNumber})`);
    }
  }

  const budgetAmount = row.budgetAmount?.trim();
  if (budgetAmount && isNaN(parseFloat(budgetAmount))) {
    errors.push('budgetAmount must be a number');
  }

  const fiscalYear = row.fiscalYear?.trim();
  if (fiscalYear && isNaN(parseInt(fiscalYear, 10))) {
    errors.push('fiscalYear must be a number');
  }

  const accrualType = row.accrualType?.trim().toUpperCase();
  if (accrualType && !['ANNUAL', 'MONTHLY', 'QUARTERLY'].includes(accrualType)) {
    errors.push(`Invalid accrualType: ${accrualType}. Must be ANNUAL, MONTHLY, or QUARTERLY`);
  }
}

async function fetchExistingData(entityType: ImportEntityType): Promise<Set<string>> {
  switch (entityType) {
    case 'users': {
      const users = await prisma.user.findMany({ select: { email: true } });
      return new Set(users.map((u) => u.email.toLowerCase()));
    }
    case 'vendors': {
      const vendors = await prisma.vendor.findMany({ select: { vendorNumber: true } });
      return new Set(vendors.map((v) => v.vendorNumber));
    }
    case 'budgetItems': {
      const items = await prisma.budgetItem.findMany({ select: { code: true } });
      return new Set(items.map((i) => i.code));
    }
  }
}

/**
 * Execute import - create records in a transaction
 */
export async function executeImport(
  entityType: ImportEntityType,
  rows: ImportRow[],
): Promise<ExecuteResult> {
  const validRows = rows.filter((r) => r.valid);
  let created = 0;
  const errors: { rowNumber: number; error: string }[] = [];

  // Look up roles and departments once
  const roleLookup = entityType === 'users' ? await getRoleLookup() : {};
  const deptLookup =
    entityType === 'users' || entityType === 'budgetItems' ? await getDeptLookup() : {};
  const categoryLookup = entityType === 'budgetItems' ? await getCategoryLookup() : {};

  // Use a transaction for atomicity
  await prisma.$transaction(async (tx) => {
    for (const row of validRows) {
      try {
        switch (entityType) {
          case 'users':
            await createUser(tx, row.data, roleLookup, deptLookup);
            break;
          case 'vendors':
            await createVendor(tx, row.data);
            break;
          case 'budgetItems':
            await createBudgetItem(tx, row.data, deptLookup, categoryLookup);
            break;
        }
        created++;
      } catch (error) {
        errors.push({
          rowNumber: row.rowNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  });

  return { entityType, created, errors };
}

async function getRoleLookup(): Promise<Record<string, string>> {
  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const lookup: Record<string, string> = {};
  for (const role of roles) {
    lookup[role.name.toUpperCase()] = role.id;
  }
  return lookup;
}

async function getDeptLookup(): Promise<Record<string, string>> {
  const depts = await prisma.department.findMany({ select: { id: true, name: true } });
  const lookup: Record<string, string> = {};
  for (const dept of depts) {
    lookup[dept.name.toLowerCase()] = dept.id;
  }
  return lookup;
}

async function getCategoryLookup(): Promise<Record<string, string>> {
  const cats = await prisma.budgetCategory.findMany({ select: { id: true, name: true } });
  const lookup: Record<string, string> = {};
  for (const cat of cats) {
    lookup[cat.name.toLowerCase()] = cat.id;
  }
  return lookup;
}

async function createUser(
  tx: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  data: Record<string, string>,
  roleLookup: Record<string, string>,
  deptLookup: Record<string, string>,
) {
  const roleName = data.role?.trim().toUpperCase() || 'USER';
  const roleId = roleLookup[roleName];
  if (!roleId) throw new Error(`Role "${roleName}" not found`);

  // Generate a temporary password (user must change on first login)
  const tempPassword = await bcrypt.hash('ChangeMe123!', 10);

  const departmentId = data.department
    ? deptLookup[data.department.trim().toLowerCase()] || null
    : null;

  await tx.user.create({
    data: {
      email: data.email.trim().toLowerCase(),
      name: data.name.trim(),
      password: tempPassword,
      roleId,
      departmentId,
    },
  });
}

async function createVendor(tx: any, data: Record<string, string>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  await tx.vendor.create({
    data: {
      vendorNumber: data.vendorNumber.trim(),
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      zipCode: data.zipCode?.trim() || null,
    },
  });
}

async function createBudgetItem(
  tx: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  data: Record<string, string>,
  deptLookup: Record<string, string>,
  categoryLookup: Record<string, string>,
) {
  const departmentId = data.department
    ? deptLookup[data.department.trim().toLowerCase()] || null
    : null;

  const categoryId = data.category
    ? categoryLookup[data.category.trim().toLowerCase()] || null
    : null;

  await tx.budgetItem.create({
    data: {
      code: data.code.trim(),
      description: data.description.trim(),
      budgetAmount: parseFloat(data.budgetAmount) || 0,
      fiscalYear: parseInt(data.fiscalYear, 10) || new Date().getFullYear(),
      departmentId,
      categoryId,
      accrualType: data.accrualType?.trim().toUpperCase() || 'ANNUAL',
      glAccountCode: data.glAccountCode?.trim() || null,
    },
  });
}
