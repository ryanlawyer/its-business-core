'use client';

interface ReconciliationBarProps {
  poTotal: number;
  receiptedTotal: number;
  receiptCount: number;
}

export default function ReconciliationBar({
  poTotal,
  receiptedTotal,
  receiptCount,
}: ReconciliationBarProps) {
  const remaining = poTotal - receiptedTotal;
  const percent = poTotal > 0 ? Math.min((receiptedTotal / poTotal) * 100, 100) : 0;
  const isOver = receiptedTotal > poTotal;
  const isNearFull = percent >= 90 && !isOver;

  const barColor = isOver
    ? 'var(--error)'
    : isNearFull
    ? 'var(--warning)'
    : 'var(--success)';

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text-secondary)]">
          Receipted: {formatCurrency(receiptedTotal)} of {formatCurrency(poTotal)}{' '}
          ({receiptCount} receipt{receiptCount !== 1 ? 's' : ''})
        </span>
        <span
          className="font-medium"
          style={{
            color: isOver ? 'var(--error)' : 'var(--text-primary)',
          }}
        >
          {isOver
            ? `${formatCurrency(Math.abs(remaining))} over`
            : `${formatCurrency(remaining)} remaining`}
        </span>
      </div>
      <div
        className="w-full h-2.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(percent, 100)}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  );
}
