# Timeclock Enhancements Design

**Date:** 2026-02-04
**Status:** Approved

## Overview

Transform the basic clock-in/out system into a full timesheet management system with manager oversight, approval workflows, and payroll-ready exports.

**Scope:**
- Manager visibility (view/edit team entries, multi-department oversight)
- Approval workflow (partial approval, locking after approval)
- Configurable pay periods and overtime rules
- Compliance alerts (approaching/exceeding thresholds)
- Flexible payroll exports (CSV, Excel, PDF with custom templates)

**Out of Scope:**
- Shift scheduling (future separate component)
- Break tracking (handled informally)

---

## Data Model Changes

### New Models

```prisma
// Pay period configuration
model PayPeriodConfig {
  id             String   @id @default(uuid())
  type           String   // "weekly" | "biweekly" | "semimonthly" | "monthly"
  startDayOfWeek Int?     // 0-6 for weekly/biweekly (0=Sunday)
  startDate      DateTime? // Reference start date for biweekly
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

// Overtime configuration
model OvertimeConfig {
  id                 String  @id @default(uuid())
  dailyThreshold     Int?    // Minutes before daily OT (null = disabled)
  weeklyThreshold    Int?    // Minutes before weekly OT (null = disabled)
  alertBeforeDaily   Int?    // Minutes before threshold to alert
  alertBeforeWeekly  Int?    // Minutes before threshold to alert
  notifyEmployee     Boolean @default(true)
  notifyManager      Boolean @default(true)
}

// Manager-department assignments (multi-department oversight)
model ManagerAssignment {
  id           String @id @default(uuid())
  userId       String // The manager
  departmentId String // Department they can oversee

  user         User       @relation(fields: [userId], references: [id])
  department   Department @relation(fields: [departmentId], references: [id])

  @@unique([userId, departmentId])
}

// Export templates
model ExportTemplate {
  id        String   @id @default(uuid())
  name      String
  columns   String   // JSON array of column configs
  isDefault Boolean  @default(false)
  createdBy String
  createdAt DateTime @default(now())
}
```

### Modified Models

```prisma
model TimeclockEntry {
  id           String    @id @default(uuid())
  userId       String
  clockIn      DateTime
  clockOut     DateTime?
  duration     Int?      // Seconds

  // NEW: Approval workflow
  status       String    @default("pending") // pending | approved | rejected
  approvedBy   String?   // Manager user ID
  approvedAt   DateTime?
  rejectedNote String?   // Reason if rejected
  isLocked     Boolean   @default(false)

  // NEW: Audit
  lastEditedBy String?
  lastEditedAt DateTime?

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  user         User      @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([clockIn])
  @@index([status])
}
```

---

## Permissions

```typescript
timeclock?: {
  // Existing
  canClockInOut?: boolean;
  canViewOwnEntries?: boolean;

  // NEW: Manager capabilities
  canViewTeamEntries?: boolean;    // View assigned departments
  canEditTeamEntries?: boolean;    // Edit/correct entries
  canApproveEntries?: boolean;     // Approve/reject for payroll

  // NEW: Admin capabilities
  canViewAllEntries?: boolean;     // See all employees
  canManageConfig?: boolean;       // Pay periods, OT rules, alerts
  canManageExportTemplates?: boolean;
  canExportPayroll?: boolean;      // Generate exports
  canAssignManagers?: boolean;     // Assign managers to departments
};
```

---

## API Endpoints

| Method | Endpoint | Purpose | Permission |
|--------|----------|---------|------------|
| GET | `/api/timeclock` | Own entries (existing) | `canViewOwnEntries` |
| GET | `/api/timeclock/team` | Team entries for manager | `canViewTeamEntries` |
| GET | `/api/timeclock/all` | All entries (admin) | `canViewAllEntries` |
| PUT | `/api/timeclock/[id]` | Edit entry | `canEditTeamEntries` + audit |
| POST | `/api/timeclock/[id]/approve` | Approve entry | `canApproveEntries` |
| POST | `/api/timeclock/[id]/reject` | Reject with note | `canApproveEntries` |
| POST | `/api/timeclock/bulk-approve` | Approve multiple | `canApproveEntries` |
| GET | `/api/timeclock/pending` | Pending approvals queue | `canApproveEntries` |
| GET | `/api/timeclock/export` | Generate export | `canExportPayroll` |
| GET | `/api/timeclock/config` | Get OT/pay period config | `canManageConfig` |
| PUT | `/api/timeclock/config` | Update config | `canManageConfig` |
| CRUD | `/api/timeclock/templates` | Export templates | `canManageExportTemplates` |
| CRUD | `/api/timeclock/manager-assignments` | Manager-dept mapping | `canAssignManagers` |

---

## Approval Workflow

### Entry Lifecycle

```
pending → (manager edits) → pending (audit logged)
pending → (manager approves) → approved (locked)
pending → (manager rejects) → rejected (with note, unlocked)
rejected → (manager edits & approves) → approved (locked)
approved → (manager rejects to unlock) → rejected → can edit again
```

### Business Rules

1. **Pending entries** — Managers can edit freely (logged with `lastEditedBy`, `lastEditedAt`)
2. **Approved entries** — Locked, no edits. To change: reject first, edit, re-approve
3. **Rejected entries** — Employee sees rejection note. Manager edits and re-approves when corrected
4. **Bulk operations** — Select multiple pending entries, approve/reject in one action
5. **Export restriction** — Only approved entries in payroll export. Warn if unapproved exist

---

## Overtime Calculation

### Logic

- **Daily OT:** Hours exceeding daily threshold on any single day
- **Weekly OT:** Hours exceeding weekly threshold (after daily OT removed)

### Example (8hr daily / 40hr weekly)

| Day | Worked | Regular | Daily OT | Weekly OT |
|-----|--------|---------|----------|-----------|
| Mon | 10h | 8h | 2h | — |
| Tue | 9h | 8h | 1h | — |
| Wed | 8h | 8h | — | — |
| Thu | 10h | 8h | 2h | — |
| Fri | 9h | 8h | 1h | — |
| **Total** | **46h** | **40h** | **6h** | **0h** |

### Alert Triggers

1. **Approaching daily** — Current day nears threshold
2. **Exceeded daily** — Clock-out results in daily OT
3. **Approaching weekly** — Weekly total nears threshold
4. **Exceeded weekly** — Weekly total exceeds threshold

### Configuration

- Admin sets daily/weekly thresholds (or disables)
- Admin sets warning thresholds (minutes before limit)
- Admin configures who gets notified (employee, manager, both)

---

## Export System

### Available Fields

```typescript
// Employee info
"employee.id", "employee.name", "employee.email",
"employee.department", "employee.departmentCode"

// Entry data
"entry.date", "entry.clockIn", "entry.clockOut",
"entry.durationMinutes", "entry.durationHours", "entry.durationFormatted"

// Calculated totals (per employee per period)
"totals.regularHours", "totals.dailyOvertimeHours",
"totals.weeklyOvertimeHours", "totals.totalHours"

// Period info
"period.startDate", "period.endDate", "period.name"
```

### Export Formats

- **CSV** — Standard comma-delimited
- **Excel (.xlsx)** — Formatted with headers, auto-width
- **PDF Timesheet** — Per-employee printable with signature line

### Template Configuration

Admin creates templates mapping fields to columns with custom headers and formats.

---

## UI Pages

| Route | Purpose | Access |
|-------|---------|--------|
| `/` | Employee timeclock (enhanced) | All users |
| `/timeclock/history` | Full personal history | `canViewOwnEntries` |
| `/timeclock/team` | Team list with hours summary | `canViewTeamEntries` |
| `/timeclock/team/[userId]` | Individual employee detail | `canViewTeamEntries` |
| `/timeclock/approvals` | Pending approvals queue | `canApproveEntries` |
| `/timeclock/export` | Payroll export page | `canExportPayroll` |
| `/admin/timeclock` | Config: pay periods, OT, alerts | `canManageConfig` |
| `/admin/timeclock/templates` | Export template management | `canManageExportTemplates` |
| `/admin/timeclock/managers` | Manager-department assignments | `canAssignManagers` |

---

## Implementation Phases

### Phase 1: Database & Config Foundation

| ID | Story |
|----|-------|
| TC-001 | Pay Period Config Model |
| TC-002 | Overtime Config Model |
| TC-003 | Manager Assignment Model |
| TC-004 | TimeclockEntry Schema Updates |

### Phase 2: Permissions & Core API

| ID | Story |
|----|-------|
| TC-005 | Extended Timeclock Permissions |
| TC-006 | Team Entries API |
| TC-007 | Entry Edit API |
| TC-008 | Approval API |
| TC-009 | Bulk Approval API |
| TC-010 | Pending Approvals API |

### Phase 3: Overtime & Alerts

| ID | Story |
|----|-------|
| TC-011 | Overtime Calculation Service |
| TC-012 | Alert Threshold Checking |
| TC-013 | Employee Alert Banner |
| TC-014 | Manager OT Flags |

### Phase 4: Employee UI Enhancements

| ID | Story |
|----|-------|
| TC-015 | Enhanced Employee Dashboard |
| TC-016 | Rejection Notice Display |
| TC-017 | Employee History Page |

### Phase 5: Manager UI

| ID | Story |
|----|-------|
| TC-018 | Team Overview Page |
| TC-019 | Employee Detail Page |
| TC-020 | Pending Approvals Page |
| TC-021 | Navbar Updates |

### Phase 6: Export System

| ID | Story |
|----|-------|
| TC-022 | Export Template Model |
| TC-023 | Template Editor UI |
| TC-024 | CSV Export |
| TC-025 | Excel Export |
| TC-026 | PDF Timesheet Export |
| TC-027 | Export UI Page |

---

**Total: 27 user stories across 6 phases**
