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
  PENDING: 'bg-gray-100 text-gray-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  REVIEWED: 'bg-purple-100 text-purple-800',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  REVIEWED: 'Reviewed',
};

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
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
        {/* Thumbnail */}
        <div className="aspect-[4/3] bg-gray-100 relative">
          {receipt.thumbnailUrl || receipt.imageUrl ? (
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
                    <svg class="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                `;
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-2 right-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[receipt.status] || 'bg-gray-100 text-gray-800'}`}>
              {statusLabels[receipt.status] || receipt.status}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-medium text-gray-900 truncate">
            {receipt.merchantName || 'Unknown Merchant'}
          </h3>

          <div className="mt-2 flex justify-between items-center">
            <span className="text-sm text-gray-500">
              {formatDate(receipt.receiptDate)}
            </span>
            <span className="text-sm font-semibold text-gray-900">
              {formatAmount(receipt.totalAmount, receipt.currency)}
            </span>
          </div>

          {receipt.budgetCategory && (
            <div className="mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                {receipt.budgetCategory.name}
              </span>
            </div>
          )}

          {receipt._count && receipt._count.lineItems > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              {receipt._count.lineItems} line item{receipt._count.lineItems !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
