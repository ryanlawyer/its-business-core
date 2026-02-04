import { prisma } from './prisma';

interface MatchCandidate {
  receiptId?: string;
  purchaseOrderId?: string;
  matchScore: number;
  matchReasons: string[];
}

interface TransactionMatchResult {
  transactionId: string;
  bestMatch: MatchCandidate | null;
  allMatches: MatchCandidate[];
}

/**
 * Find potential matches for a bank transaction
 * Matches against receipts and purchase orders based on:
 * - Amount (exact or within tolerance)
 * - Date (within ± 3 days by default)
 * - Description/merchant name similarity
 */
export async function findTransactionMatches(
  transactionId: string,
  options: {
    dateTolerance?: number; // Days, default 3
    amountTolerance?: number; // Percentage, default 1%
    maxResults?: number;
  } = {}
): Promise<TransactionMatchResult> {
  const { dateTolerance = 3, amountTolerance = 0.01, maxResults = 5 } = options;

  // Get the transaction
  const transaction = await prisma.bankTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      transactionDate: true,
      description: true,
      amount: true,
      type: true,
      matchedReceiptId: true,
      matchedPurchaseOrderId: true,
    },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  // Don't match if already matched
  if (transaction.matchedReceiptId || transaction.matchedPurchaseOrderId) {
    return {
      transactionId,
      bestMatch: null,
      allMatches: [],
    };
  }

  // Calculate date range
  const minDate = new Date(transaction.transactionDate);
  minDate.setDate(minDate.getDate() - dateTolerance);
  const maxDate = new Date(transaction.transactionDate);
  maxDate.setDate(maxDate.getDate() + dateTolerance);

  // Calculate amount range
  const minAmount = transaction.amount * (1 - amountTolerance);
  const maxAmount = transaction.amount * (1 + amountTolerance);

  const allMatches: MatchCandidate[] = [];

  // Find matching receipts (for debits/expenses)
  if (transaction.type === 'DEBIT') {
    const receipts = await prisma.receipt.findMany({
      where: {
        AND: [
          {
            receiptDate: {
              gte: minDate,
              lte: maxDate,
            },
          },
          {
            totalAmount: {
              gte: minAmount,
              lte: maxAmount,
            },
          },
          {
            // Only match unlinked receipts
            bankTransactions: {
              none: {},
            },
          },
        ],
      },
      select: {
        id: true,
        merchantName: true,
        receiptDate: true,
        totalAmount: true,
        status: true,
      },
      take: 20,
    });

    for (const receipt of receipts) {
      const matchReasons: string[] = [];
      let matchScore = 0;

      // Amount match
      if (receipt.totalAmount !== null) {
        const amountDiff = Math.abs(receipt.totalAmount - transaction.amount);
        const tolerance = transaction.amount * amountTolerance;
        if (amountDiff <= tolerance * 0.1) {
          matchScore += 50;
          matchReasons.push('Exact amount match');
        } else if (amountDiff <= tolerance) {
          matchScore += 40;
          matchReasons.push('Amount within tolerance');
        }
      }

      // Date match
      if (receipt.receiptDate) {
        const daysDiff = Math.abs(
          (receipt.receiptDate.getTime() - transaction.transactionDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (daysDiff === 0) {
          matchScore += 30;
          matchReasons.push('Same date');
        } else if (daysDiff <= 1) {
          matchScore += 25;
          matchReasons.push('Date within 1 day');
        } else if (daysDiff <= 3) {
          matchScore += 15;
          matchReasons.push('Date within 3 days');
        }
      }

      // Merchant name similarity
      if (receipt.merchantName) {
        const transactionDesc = transaction.description.toLowerCase();
        const merchantName = receipt.merchantName.toLowerCase();

        if (transactionDesc.includes(merchantName) || merchantName.includes(transactionDesc)) {
          matchScore += 20;
          matchReasons.push('Merchant name match');
        } else {
          // Check for partial word matches
          const merchantWords = merchantName.split(/\s+/);
          const descWords = transactionDesc.split(/\s+/);
          const commonWords = merchantWords.filter(
            (word) => word.length > 2 && descWords.some((dw) => dw.includes(word) || word.includes(dw))
          );
          if (commonWords.length > 0) {
            matchScore += 10;
            matchReasons.push('Partial merchant name match');
          }
        }
      }

      if (matchReasons.length > 0) {
        allMatches.push({
          receiptId: receipt.id,
          matchScore,
          matchReasons,
        });
      }
    }

    // Find matching purchase orders
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        AND: [
          {
            poDate: {
              gte: minDate,
              lte: maxDate,
            },
          },
          {
            totalAmount: {
              gte: minAmount,
              lte: maxAmount,
            },
          },
          {
            status: {
              in: ['APPROVED', 'COMPLETED'],
            },
          },
          {
            // Only match unlinked POs
            bankTransactions: {
              none: {},
            },
          },
        ],
      },
      select: {
        id: true,
        poNumber: true,
        poDate: true,
        totalAmount: true,
        vendor: { select: { name: true } },
      },
      take: 20,
    });

    for (const po of purchaseOrders) {
      const matchReasons: string[] = [];
      let matchScore = 0;

      // Amount match
      const amountDiff = Math.abs(po.totalAmount - transaction.amount);
      const tolerance = transaction.amount * amountTolerance;
      if (amountDiff <= tolerance * 0.1) {
        matchScore += 50;
        matchReasons.push('Exact amount match');
      } else if (amountDiff <= tolerance) {
        matchScore += 40;
        matchReasons.push('Amount within tolerance');
      }

      // Date match
      const daysDiff = Math.abs(
        (po.poDate.getTime() - transaction.transactionDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysDiff === 0) {
        matchScore += 30;
        matchReasons.push('Same date');
      } else if (daysDiff <= 1) {
        matchScore += 25;
        matchReasons.push('Date within 1 day');
      } else if (daysDiff <= 3) {
        matchScore += 15;
        matchReasons.push('Date within 3 days');
      }

      // Vendor name similarity
      if (po.vendor?.name) {
        const transactionDesc = transaction.description.toLowerCase();
        const vendorName = po.vendor.name.toLowerCase();

        if (transactionDesc.includes(vendorName) || vendorName.includes(transactionDesc)) {
          matchScore += 20;
          matchReasons.push('Vendor name match');
        }
      }

      if (matchReasons.length > 0) {
        allMatches.push({
          purchaseOrderId: po.id,
          matchScore,
          matchReasons,
        });
      }
    }
  }

  // Sort by match score
  allMatches.sort((a, b) => b.matchScore - a.matchScore);

  return {
    transactionId,
    bestMatch: allMatches.length > 0 ? allMatches[0] : null,
    allMatches: allMatches.slice(0, maxResults),
  };
}

/**
 * Auto-match all unmatched transactions in a statement
 */
export async function autoMatchStatementTransactions(
  statementId: string,
  options: {
    minConfidence?: number; // Minimum match score, default 70
  } = {}
): Promise<{
  matched: number;
  unmatched: number;
  results: TransactionMatchResult[];
}> {
  const { minConfidence = 70 } = options;

  // Get all unmatched transactions
  const transactions = await prisma.bankTransaction.findMany({
    where: {
      statementId,
      matchedReceiptId: null,
      matchedPurchaseOrderId: null,
      noReceiptRequired: false,
    },
    select: { id: true },
  });

  const results: TransactionMatchResult[] = [];
  let matched = 0;
  let unmatched = 0;

  for (const transaction of transactions) {
    const matchResult = await findTransactionMatches(transaction.id);
    results.push(matchResult);

    if (matchResult.bestMatch && matchResult.bestMatch.matchScore >= minConfidence) {
      // Auto-match if confidence is high enough
      await prisma.bankTransaction.update({
        where: { id: transaction.id },
        data: {
          matchedReceiptId: matchResult.bestMatch.receiptId,
          matchedPurchaseOrderId: matchResult.bestMatch.purchaseOrderId,
        },
      });
      matched++;
    } else {
      unmatched++;
    }
  }

  return { matched, unmatched, results };
}

/**
 * Manually match a transaction to a receipt or PO
 */
export async function matchTransaction(
  transactionId: string,
  match: { receiptId?: string; purchaseOrderId?: string }
): Promise<void> {
  await prisma.bankTransaction.update({
    where: { id: transactionId },
    data: {
      matchedReceiptId: match.receiptId || null,
      matchedPurchaseOrderId: match.purchaseOrderId || null,
    },
  });
}

/**
 * Unmatch a transaction
 */
export async function unmatchTransaction(transactionId: string): Promise<void> {
  await prisma.bankTransaction.update({
    where: { id: transactionId },
    data: {
      matchedReceiptId: null,
      matchedPurchaseOrderId: null,
    },
  });
}

/**
 * Mark a transaction as not requiring a receipt
 */
export async function markNoReceiptRequired(
  transactionId: string,
  noReceiptRequired: boolean
): Promise<void> {
  await prisma.bankTransaction.update({
    where: { id: transactionId },
    data: { noReceiptRequired },
  });
}

/**
 * Get reconciliation summary for a statement
 */
export async function getReconciliationSummary(statementId: string): Promise<{
  totalTransactions: number;
  matchedToReceipt: number;
  matchedToPO: number;
  noReceiptRequired: number;
  unmatched: number;
  totalDebits: number;
  totalCredits: number;
  matchedAmount: number;
  unmatchedAmount: number;
}> {
  const transactions = await prisma.bankTransaction.findMany({
    where: { statementId },
    select: {
      amount: true,
      type: true,
      matchedReceiptId: true,
      matchedPurchaseOrderId: true,
      noReceiptRequired: true,
    },
  });

  let totalTransactions = 0;
  let matchedToReceipt = 0;
  let matchedToPO = 0;
  let noReceiptRequired = 0;
  let unmatched = 0;
  let totalDebits = 0;
  let totalCredits = 0;
  let matchedAmount = 0;
  let unmatchedAmount = 0;

  for (const t of transactions) {
    totalTransactions++;

    if (t.type === 'DEBIT') {
      totalDebits += t.amount;
    } else {
      totalCredits += t.amount;
    }

    if (t.matchedReceiptId) {
      matchedToReceipt++;
      matchedAmount += t.amount;
    } else if (t.matchedPurchaseOrderId) {
      matchedToPO++;
      matchedAmount += t.amount;
    } else if (t.noReceiptRequired) {
      noReceiptRequired++;
      matchedAmount += t.amount;
    } else {
      unmatched++;
      unmatchedAmount += t.amount;
    }
  }

  return {
    totalTransactions,
    matchedToReceipt,
    matchedToPO,
    noReceiptRequired,
    unmatched,
    totalDebits,
    totalCredits,
    matchedAmount,
    unmatchedAmount,
  };
}
