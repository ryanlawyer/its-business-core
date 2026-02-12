# PO-Receipt Matching & Reconciliation Design

## Goal

Add bidirectional matching between Purchase Orders and Receipts. Users can find and attach existing uploaded receipts to a PO, or link a receipt to an existing PO, with amount reconciliation supporting partial receipts across multiple deliveries.

## Design Decisions

- **Bidirectional**: match from either the PO detail page or the receipt detail/list page
- **Multi-receipt per PO**: multiple receipts can link to one PO; a reconciliation summary shows receipted vs remaining amount
- **On-demand matching**: user clicks to find matches; no proactive notifications or badges
- **No schema changes**: existing `Receipt.purchaseOrderId` already supports multi-receipt linking; reconciliation is computed on-the-fly
- **Discrepancy notes**: optional note captured in audit log when linking with amount mismatch

## Data Model

No Prisma schema changes. The existing `Receipt.purchaseOrderId` foreign key allows many receipts to reference one PO.

Reconciliation is computed by querying all receipts where `purchaseOrderId = PO.id`, summing their `totalAmount`, and comparing against `PO.totalAmount`.

## New API Endpoints

### `GET /api/purchase-orders/[id]/suggest-receipts`

Suggests unlinked receipts that may match a PO. Uses shared scoring logic:

| Signal | Points |
|---|---|
| Vendor match | +40 |
| Merchant name similarity | +30 |
| Amount match (exact, within 1%) | +40 |
| Amount match (close, within 5%) | +20 |
| Date within 3 days | +20 |
| Date within 7 days | +15 |
| Date within 30 days | +10 |

For POs with existing linked receipts, scores against the **remaining** amount (PO total minus already-receipted) rather than the full PO amount.

Query params: `?search=`, `?minAmount=`, `?maxAmount=`, `?startDate=`, `?endDate=`

Returns top 5 sorted by score.

### `GET /api/purchase-orders/[id]/receipt-summary`

Returns reconciliation data for a PO:

```json
{
  "poTotal": 500.00,
  "receiptedTotal": 350.00,
  "remainingAmount": 150.00,
  "receiptCount": 2,
  "percentCovered": 70,
  "receipts": [
    { "id": "...", "merchantName": "Sysco", "totalAmount": 200.00, "receiptDate": "2026-01-15", "thumbnailUrl": "..." },
    { "id": "...", "merchantName": "Sysco", "totalAmount": 150.00, "receiptDate": "2026-01-22", "thumbnailUrl": "..." }
  ]
}
```

## Existing Endpoints (No Changes)

- `POST /api/receipts/[id]/link-po` — links receipt to PO
- `DELETE /api/receipts/[id]/link-po` — unlinks receipt from PO
- `GET /api/receipts/[id]/suggest-po` — scores and suggests POs for a receipt

## UI Changes

### PO Detail Page (`/purchase-orders/[id]`)

**Reconciliation bar** (top of linked receipts section):
- Shows: PO Total, Receipted amount, Remaining amount, receipt count
- Progress bar with percentage covered
- Yellow when under-receipted, red when over PO amount

**"Find & Attach Receipts" button**:
- Visible when PO status is APPROVED or COMPLETED
- Requires `receipts.canEdit` permission
- Opens a slide-over panel containing:
  1. Search bar (merchant name, date range, amount)
  2. Suggested matches (top 5 from `suggest-receipts` endpoint)
  3. All unlinked receipts (paginated, scrollable)
  4. Each receipt card: thumbnail, merchant name, date, amount, match score badge
  5. "Attach" button with optional note field

### Receipt Detail Page (`/receipts/[id]`)

**"Link to Purchase Order" button** (when `purchaseOrderId IS NULL`):
- Opens slide-over panel containing:
  1. Suggested POs (from existing `suggest-po` endpoint)
  2. Search bar (PO number, vendor, amount range)
  3. All linkable POs (APPROVED or COMPLETED status, paginated)
  4. Each PO card: PO number, vendor, total, receipted so far, status badge
  5. "Link" button with optional note

When already linked: shows PO details inline with "Unlink" option.

### Receipt List Page (`/receipts`)

- Add linked/unlinked status column
- Add filter: "Show unlinked only"

## New Components

| Component | Purpose |
|---|---|
| `FindReceiptsPanel.tsx` | Slide-over for PO detail page; searches and attaches receipts |
| `FindPOPanel.tsx` | Slide-over for receipt detail page; searches and links to PO |
| `ReconciliationBar.tsx` | Progress bar showing receipted vs PO total |

## Shared Utility

### `src/lib/receipt-po-matcher.ts`

Extract the scoring algorithm from `suggest-po/route.ts` into a shared utility so both `suggest-receipts` and `suggest-po` call the same function.

```typescript
interface MatchScore {
  id: string;
  score: number;
  breakdown: {
    vendorMatch: number;
    merchantSimilarity: number;
    amountMatch: number;
    dateProximity: number;
  };
}

function scoreReceiptAgainstPO(receipt, po, options?): MatchScore;
function scorePOAgainstReceipt(po, receipt, options?): MatchScore;
```

## Files

**Create:**
- `src/app/api/purchase-orders/[id]/suggest-receipts/route.ts`
- `src/app/api/purchase-orders/[id]/receipt-summary/route.ts`
- `src/components/FindReceiptsPanel.tsx`
- `src/components/FindPOPanel.tsx`
- `src/components/ReconciliationBar.tsx`
- `src/lib/receipt-po-matcher.ts`

**Modify:**
- `src/app/purchase-orders/[id]/page.tsx` — add reconciliation bar, find button, panel
- `src/app/receipts/[id]/page.tsx` — add link button and panel
- `src/app/receipts/page.tsx` — add linked/unlinked filter and column
- `src/app/api/receipts/[id]/suggest-po/route.ts` — refactor to use shared matcher utility

**No changes to:** Prisma schema, permissions, audit logging, budget tracking.
