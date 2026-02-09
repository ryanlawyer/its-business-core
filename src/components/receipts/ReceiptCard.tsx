'use client';

import Link from 'next/link';

interface Receipt {
  id: string;
  merchantName: string | null;
  receiptDate: string | null;
  totalAmount: number | null;
  currency: string;
  status: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  vendor: { id: string; name: string } | null;
  budgetCategory: { id: string; name: string } | null;
  user: { id: string; name: string | null } | null;
  createdAt: string;
  _count?: { lineItems: number };
}

interface ReceiptCardProps {
  receipt: Receipt;
}

const statusColors: Record<string, string> = {
  PENDING: 'badge badge-neutral',
  PROCESSING: 'badge badge-info',
  COMPLETED: 'badge badge-success',
  FAILED: 'badge badge-error',
  REVIEWED: 'badge badge-accent',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  REVIEWED: 'Reviewed',
};

const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf') ?? false;

export default function ReceiptCard({ receipt }: ReceiptCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatAmount = (amount: number | null, currency: string) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  return (
    <Link href={`/receipts/${receipt.id}`}>
      <div className="card-interactive overflow-hidden p-0">
        {/* Thumbnail */}
        <div className="aspect-[4/3] bg-[var(--bg-surface)] relative">
          {receipt.thumbnailUrl || receipt.imageUrl ? (
            isPdf(receipt.imageUrl) ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <svg className="w-12 h-12 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <span className="text-xs font-medium text-[var(--text-muted)] uppercase">PDF</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/receipts/${receipt.id}/image?thumbnail=true&t=${Date.now()}`}
                alt={receipt.merchantName || 'Receipt'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement!.innerHTML = `
                    <div class="w-full h-full flex items-center justify-center">
                      <svg class="w-12 h-12 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                  `;
                }}
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-12 h-12 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-2 right-2">
            <span className={statusColors[receipt.status] || 'badge badge-neutral'}>
              {statusLabels[receipt.status] || receipt.status}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-medium text-[var(--text-primary)] truncate">
            {receipt.merchantName || 'Unknown Merchant'}
          </h3>

          <div className="mt-2 flex justify-between items-center">
            <span className="text-sm text-[var(--text-secondary)]">
              {formatDate(receipt.receiptDate)}
            </span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {formatAmount(receipt.totalAmount, receipt.currency)}
            </span>
          </div>

          {receipt.budgetCategory && (
            <div className="mt-2">
              <span className="badge badge-info">
                {receipt.budgetCategory.name}
              </span>
            </div>
          )}

          {receipt._count && receipt._count.lineItems > 0 && (
            <div className="mt-2 text-xs text-[var(--text-secondary)]">
              {receipt._count.lineItems} line item{receipt._count.lineItems !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
