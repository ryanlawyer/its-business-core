import { prisma } from './prisma';

export type AuditAction =
  // User actions
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_DEPARTMENT_CHANGED'
  | 'USER_PASSWORD_CHANGED'
  // PO actions
  | 'PO_CREATED'
  | 'PO_UPDATED'
  | 'PO_SUBMITTED'
  | 'PO_APPROVED'
  | 'PO_REJECTED'
  | 'PO_COMPLETED'
  | 'PO_VOIDED'
  | 'PO_LINE_ITEM_ADDED'
  | 'PO_LINE_ITEM_REMOVED'
  | 'PO_LINE_ITEM_UPDATED'
  // Role actions
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'ROLE_DELETED'
  | 'ROLE_PERMISSIONS_CHANGED'
  // Department actions
  | 'DEPARTMENT_CREATED'
  | 'DEPARTMENT_UPDATED'
  | 'DEPARTMENT_DELETED'
  | 'DEPARTMENT_DEACTIVATED'
  | 'DEPARTMENT_USERS_REASSIGNED'
  // Budget actions
  | 'BUDGET_ITEM_CREATED'
  | 'BUDGET_ITEM_UPDATED'
  | 'BUDGET_ITEM_DELETED'
  // Vendor actions
  | 'VENDOR_CREATED'
  | 'VENDOR_UPDATED'
  | 'VENDOR_DELETED'
  // Auth actions
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  // Settings actions
  | 'SETTINGS_UPDATED'
  // Receipt actions
  | 'RECEIPT_UPLOADED'
  | 'RECEIPT_UPDATED'
  | 'RECEIPT_DELETED'
  | 'RECEIPT_OCR_STARTED'
  | 'RECEIPT_OCR_COMPLETED'
  | 'RECEIPT_OCR_FAILED'
  | 'RECEIPT_LINKED_TO_PO'
  | 'RECEIPT_UNLINKED_FROM_PO'
  // Bank statement actions
  | 'BANK_STATEMENT_UPLOADED'
  | 'BANK_STATEMENT_PARSED'
  | 'BANK_STATEMENT_DELETED'
  | 'BANK_TRANSACTION_MATCHED'
  | 'BANK_TRANSACTION_UNMATCHED'
  // Timeclock workflow actions
  | 'TIMECLOCK_ENTRY_APPROVED'
  | 'TIMECLOCK_ENTRY_REJECTED'
  | 'TIMECLOCK_ENTRY_AUTO_APPROVED'
  | 'TIMECLOCK_ENTRY_AUTO_REJECTED'
  | 'TIMECLOCK_ENTRY_SUBMITTED'
  | 'PAY_PERIOD_LOCKED'
  | 'PAY_PERIOD_UNLOCKED'
  | 'TIMECLOCK_RULES_CONFIG_UPDATED'
  // System actions
  | 'BACKUP_DOWNLOADED'
  | 'BACKUP_RESTORED';

export type AuditEntityType =
  | 'User'
  | 'Role'
  | 'Department'
  | 'PurchaseOrder'
  | 'POLineItem'
  | 'BudgetItem'
  | 'Vendor'
  | 'Settings'
  | 'Auth'
  | 'Receipt'
  | 'BankStatement'
  | 'BankTransaction'
  | 'TimeclockEntry'
  | 'PayPeriodConfig'
  | 'OvertimeConfig'
  | 'ManagerAssignment'
  | 'ExportTemplate'
  | 'TimeclockRulesConfig'
  | 'PayPeriodLock'
  | 'System';

interface AuditLogData {
  userId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  changes?: {
    before?: any;
    after?: any;
  };
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 * This function is async but catches all errors to prevent audit failures from breaking operations
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        changes: JSON.stringify(data.changes || {}),
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit failures shouldn't break operations
  }
}

/**
 * Helper to extract IP address and user agent from Next.js Request
 */
export function getRequestContext(req: Request): {
  ipAddress: string;
  userAgent: string;
} {
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return { ipAddress, userAgent };
}

/**
 * Helper to compare objects and create a before/after change object
 * Only includes fields that actually changed
 */
export function getChanges(
  before: Record<string, any>,
  after: Record<string, any>
): { before: Record<string, any>; after: Record<string, any> } {
  const changes: { before: Record<string, any>; after: Record<string, any> } = {
    before: {},
    after: {},
  };

  // Find changed fields
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      changes.before[key] = before[key];
      changes.after[key] = after[key];
    }
  }

  return changes;
}

/**
 * Helper to sanitize sensitive data before logging
 * Removes password fields and other sensitive information
 */
export function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = { ...data };
  const sensitiveFields = ['password', 'passwordHash', 'token', 'secret'];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}
