import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const userCreateSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(200),
  password: z.string().min(8).max(128),
  roleId: z.string().min(1),
  departmentId: z.string().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const userUpdateSchema = z.object({
  email: z.string().email().max(255).optional(),
  name: z.string().min(1).max(200).optional(),
  password: z.string().min(8).max(128).optional(),
  roleId: z.string().min(1).optional(),
  departmentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const timeclockEditSchema = z.object({
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
}).refine(data => {
  if (data.clockIn && data.clockOut) {
    const diff = new Date(data.clockOut).getTime() - new Date(data.clockIn).getTime();
    return diff > 0 && diff <= 24 * 60 * 60 * 1000; // max 24 hours
  }
  return true;
}, { message: 'Clock out must be after clock in and within 24 hours' });

export const budgetAmendmentSchema = z.object({
  amount: z.number().positive().finite(),
  reason: z.string().min(1).max(1000),
  type: z.enum(['INCREASE', 'DECREASE', 'TRANSFER']),
  budgetItemId: z.string().min(1),
  targetBudgetItemId: z.string().optional(),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).refine(data => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const diffMs = end.getTime() - start.getTime();
  return diffMs > 0 && diffMs <= 365 * 24 * 60 * 60 * 1000; // max 1 year
}, { message: 'End date must be after start date and within 1 year' });

export const entryIdsSchema = z.object({
  entryIds: z.array(z.string()).min(1).max(500),
});

export const rejectedNoteSchema = z.object({
  rejectedNote: z.string().max(1000).optional(),
});

export const timeclockRulesConfigSchema = z.object({
  autoApproveEnabled: z.boolean().optional(),
  autoApproveMinHours: z.number().min(0).max(24).optional(),
  autoApproveMaxHours: z.number().min(0).max(24).optional(),
  autoApproveBlockOnOT: z.boolean().optional(),
  missedPunchEnabled: z.boolean().optional(),
  missedPunchThresholdHours: z.number().min(1).max(72).optional(),
  roundingMode: z.enum(['none', '5min', '6min', '7min', '15min']).optional(),
  minDurationEnabled: z.boolean().optional(),
  minDurationSeconds: z.number().int().min(0).max(3600).optional(),
  minDurationAction: z.enum(['flag', 'reject']).optional(),
  attestationEnabled: z.boolean().optional(),
  breakDeductionEnabled: z.boolean().optional(),
  breakDeductionMinutes: z.number().int().min(0).max(120).optional(),
  breakDeductionAfterHours: z.number().min(0).max(24).optional(),
});

export const payPeriodLockSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

// Helper to parse and return validation errors
export function parseWithErrors<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((e: z.ZodIssue) => e.message).join(', ');
    return { success: false, error: messages };
  }
  return { success: true, data: result.data };
}
