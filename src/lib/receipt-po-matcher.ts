/**
 * Shared scoring utility for matching receipts against purchase orders.
 * Used by both the receipt-side suggest-po and the PO-side suggest-receipts endpoints.
 */

export interface ReceiptForMatching {
  id: string;
  vendorId: string | null;
  merchantName: string | null;
  totalAmount: number | null;
  receiptDate: Date | null;
}

export interface POForMatching {
  id: string;
  vendorId: string | null;
  vendor: { id: string; name: string } | null;
  totalAmount: number | null;
  poDate: Date | null;
  receipts: { id: string }[];
}

export interface MatchScore {
  id: string;
  score: number;
  reasons: string[];
}

/**
 * Score how well a receipt matches a PO based on vendor, amount, and date.
 * Returns a score object with the PO's id.
 */
export function scoreReceiptVsPO(
  receipt: ReceiptForMatching,
  po: POForMatching
): MatchScore {
  const reasons: string[] = [];
  let score = 0;

  // Check vendor match
  if (receipt.vendorId && po.vendorId === receipt.vendorId) {
    score += 40;
    reasons.push('Vendor match');
  }

  // Check merchant name similarity (if no vendor linked)
  if (!receipt.vendorId && receipt.merchantName && po.vendor?.name) {
    const merchantLower = receipt.merchantName.toLowerCase();
    const vendorLower = po.vendor.name.toLowerCase();
    if (
      merchantLower.includes(vendorLower) ||
      vendorLower.includes(merchantLower)
    ) {
      score += 30;
      reasons.push('Vendor name similar to merchant');
    }
  }

  // Check amount match (within 1% tolerance)
  if (receipt.totalAmount !== null && po.totalAmount !== null) {
    const diff = Math.abs(receipt.totalAmount - po.totalAmount);
    const tolerance = Math.max(receipt.totalAmount, po.totalAmount) * 0.01;
    if (diff <= tolerance) {
      score += 40;
      reasons.push('Amount matches');
    } else if (diff <= tolerance * 5) {
      score += 20;
      reasons.push('Amount close');
    }
  }

  // Check date proximity (within 30 days)
  if (receipt.receiptDate && po.poDate) {
    const receiptTime = receipt.receiptDate.getTime();
    const poTime = po.poDate.getTime();
    const daysDiff = Math.abs(receiptTime - poTime) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 3) {
      score += 20;
      reasons.push('Date within 3 days');
    } else if (daysDiff <= 7) {
      score += 15;
      reasons.push('Date within 7 days');
    } else if (daysDiff <= 30) {
      score += 10;
      reasons.push('Date within 30 days');
    }
  }

  // Penalize POs that already have linked receipts
  if (reasons.length > 0 && po.receipts.length > 0) {
    score -= 20;
    reasons.push('Already has linked receipts');
  }

  return { id: po.id, score, reasons };
}

/**
 * Score how well a receipt matches a PO, comparing the receipt amount
 * against the remaining unreceipted amount on the PO.
 */
export function scoreReceiptVsPO_remaining(
  receipt: ReceiptForMatching,
  po: POForMatching,
  alreadyReceiptedAmount: number
): MatchScore {
  const reasons: string[] = [];
  let score = 0;

  // Check vendor match
  if (receipt.vendorId && po.vendorId === receipt.vendorId) {
    score += 40;
    reasons.push('Vendor match');
  }

  // Check merchant name similarity (if no vendor linked)
  if (!receipt.vendorId && receipt.merchantName && po.vendor?.name) {
    const merchantLower = receipt.merchantName.toLowerCase();
    const vendorLower = po.vendor.name.toLowerCase();
    if (
      merchantLower.includes(vendorLower) ||
      vendorLower.includes(merchantLower)
    ) {
      score += 30;
      reasons.push('Vendor name similar to merchant');
    }
  }

  // Check amount against remaining unreceipted amount
  if (receipt.totalAmount !== null && po.totalAmount !== null) {
    const remainingAmount = po.totalAmount - alreadyReceiptedAmount;
    if (remainingAmount > 0) {
      const diff = Math.abs(receipt.totalAmount - remainingAmount);
      const tolerance = Math.max(receipt.totalAmount, remainingAmount) * 0.01;
      if (diff <= tolerance) {
        score += 40;
        reasons.push('Amount matches remaining');
      } else if (diff <= tolerance * 5) {
        score += 20;
        reasons.push('Amount close to remaining');
      }
    }
  }

  // Check date proximity (within 30 days)
  if (receipt.receiptDate && po.poDate) {
    const receiptTime = receipt.receiptDate.getTime();
    const poTime = po.poDate.getTime();
    const daysDiff = Math.abs(receiptTime - poTime) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 3) {
      score += 20;
      reasons.push('Date within 3 days');
    } else if (daysDiff <= 7) {
      score += 15;
      reasons.push('Date within 7 days');
    } else if (daysDiff <= 30) {
      score += 10;
      reasons.push('Date within 30 days');
    }
  }

  return { id: receipt.id, score, reasons };
}
