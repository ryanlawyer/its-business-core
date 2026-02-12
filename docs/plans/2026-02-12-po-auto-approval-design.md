# PO Auto-Approval with Budget Awareness

**Date:** 2026-02-12
**Status:** Design

## Overview

A system-level feature that automatically approves purchase orders when they meet two criteria:

1. Total amount is under a configurable threshold
2. All line items fit within their respective budget line item remaining funds

When either criterion fails, the PO falls back to normal manual approval with context explaining why auto-approval was skipped.

## Motivation

The current PO approval workflow is binary and fully manual — every PO requires human approval regardless of amount or budget availability. This creates unnecessary friction for routine low-value purchases that are clearly within budget.

Most SMB tools (QuickBooks, Xero) either have no PO approval workflow at all or require expensive add-ons. Budget-aware auto-approval is a gap in the market that provides real controls without enterprise complexity.

## Settings

Configuration lives in `config/system-settings.json` under the existing `purchaseOrders` key:

```json
{
  "purchaseOrders": {
    "numberPrefix": "PO-",
    "resetCounterYearly": true,
    "autoApproval": {
      "enabled": false,
      "threshold": 500
    }
  }
}
```

- `enabled` — boolean, default `false`. When false, everything works exactly as today.
- `threshold` — number (dollar amount), default `500`. POs at or under this amount are candidates for auto-approval.

Settings are read per-request, so changes take effect immediately on save.

### Settings UI

New section under the existing PO settings tab in `/admin/settings`:

```
Auto-Approval
─────────────────────────────────────
[ ] Enable auto-approval for purchase orders

When enabled, POs are automatically approved if:
• Total amount is under the threshold
• All line items are within their budget

Threshold:  $[  500.00  ]
─────────────────────────────────────
```

- Toggle is a checkbox (consistent with existing settings UI patterns)
- Threshold input is a currency field, disabled when toggle is off
- Validation: threshold must be a positive number

## Auto-Approval Logic

### Trigger Point

The existing `/api/purchase-orders/[id]/status` route, when `newStatus === 'PENDING_APPROVAL'` (i.e., on PO submission).

### Decision Flow

```
User submits PO (DRAFT → PENDING_APPROVAL)
  │
  ├─ Is auto-approval enabled?
  │   No → PENDING_APPROVAL (today's behavior)
  │
  ├─ Is PO total ≤ threshold?
  │   No → PENDING_APPROVAL + note: "Over auto-approval threshold ($X)"
  │
  ├─ Do ALL line items fit within budget remaining?
  │   (remaining = budgetAmount - encumbered - actualSpent)
  │   No → PENDING_APPROVAL + note: "Would exceed budget: [item name]"
  │
  └─ All pass → APPROVED (auto)
       ├─ Set status to APPROVED
       ├─ Set approvedById to requesting user's ID
       ├─ Set approvedAt to now
       ├─ Update encumbered via budget-tracking
       ├─ Create audit log: "Auto-approved (under threshold, within budget)"
       └─ All in single transaction
```

### Key Details

- Budget check uses: `remaining = budgetAmount - encumbered - actualSpent`
- `approvedById` stores the requesting user's ID; the audit log clearly marks it as auto-approved (distinguishing from manual approval)
- If any single line item would exceed its budget, the entire PO falls back to manual — no partial auto-approval
- The fallback reason is stored in the new `autoApprovalNote` field so the approver sees context
- Self-created POs are eligible for auto-approval — the system is approving based on objective criteria, not the person

## Receipt Attachment Changes

### Current Behavior

Receipts can only be linked to POs with status APPROVED or COMPLETED.

### New Behavior

Receipts can be linked to POs in any status except CANCELLED.

### Changes Required

1. **PO detail page** (`src/app/purchase-orders/[id]/page.tsx`, lines 672, 746)
   - Change: `po.status === 'APPROVED' || po.status === 'COMPLETED'`
   - To: `po.status !== 'CANCELLED'`

2. **Suggest PO API** (`src/app/api/receipts/[id]/suggest-po/route.ts`, lines 67-71)
   - Change: `status: { in: ['APPROVED', 'COMPLETED'] }`
   - To: `status: { not: 'CANCELLED' }`

3. **Receipt detail page** (`src/app/receipts/[id]/page.tsx`, line 325)
   - Change: `status: 'APPROVED,COMPLETED'` filter
   - To: Remove status filter or use `notStatus=CANCELLED`

4. **Link PO API** (`src/app/api/receipts/[id]/link-po/route.ts`)
   - Add server-side validation that the target PO is not CANCELLED (currently has no server-side status check — this fixes a security gap)

Three-way matching and reconciliation logic remain unchanged — formal matching still only applies to APPROVED/COMPLETED POs for payment purposes.

## Budget Context in Approval UI

When viewing a PO with status PENDING_APPROVAL and the user has `canApprove` permission, each line item shows budget impact:

```
Line Item: Office Supplies - Paper
Amount: $350.00
Budget: Office Supplies FY2026
  ┌──────────────────────────────────────┐
  │ Budget: $10,000  Committed: $6,000   │
  │ This PO: $350    Remaining after: $3,650  │
  └──────────────────────────────────────┘
```

### Implementation

- Extend the PO detail response to include budget context per line item: `budgetAmount`, `encumbered`, `actualSpent`, `remaining`, and `remainingAfterThisPO`
- Reuse the existing `ReconciliationBar` component pattern (green/yellow/red) for visual budget consumption
- If a line item would push the budget over, show it in red with a warning label
- When auto-approval was skipped, display the `autoApprovalNote` as a banner at the top of the approval area

## Data Model Changes

### New field on PurchaseOrder

```prisma
autoApprovalNote  String?   // Reason auto-approval was skipped, shown to approver
```

No new models needed.

### Audit Log Entries

Using existing `createAuditLog`:

- **Auto-approved:** `action: "AUTO_APPROVED"`, details include threshold and budget check results
- **Fallback to manual:** `action: "AUTO_APPROVAL_SKIPPED"`, details include the reason

## Out of Scope (YAGNI)

- Per-department or per-role thresholds
- Multi-tier approval chains
- User-to-budget-line authorization
- Hard block on over-budget submissions
- Vendor whitelists or pre-approved catalogs
- Approval delegation or escalation rules

## Files to Modify

| File | Change |
|------|--------|
| `config/system-settings.json` | Add `autoApproval` settings |
| `prisma/schema.prisma` | Add `autoApprovalNote` field to PurchaseOrder |
| `src/app/api/purchase-orders/[id]/status/route.ts` | Auto-approval logic on submission |
| `src/lib/budget-tracking.ts` | No changes (already has what's needed) |
| `src/app/purchase-orders/[id]/page.tsx` | Receipt attachment for all states, budget context in approval view |
| `src/app/api/receipts/[id]/suggest-po/route.ts` | Remove APPROVED/COMPLETED status filter |
| `src/app/api/receipts/[id]/link-po/route.ts` | Add server-side CANCELLED check |
| `src/app/receipts/[id]/page.tsx` | Remove status filter on PO search |
| `src/app/admin/settings/page.tsx` | Auto-approval settings UI section |
