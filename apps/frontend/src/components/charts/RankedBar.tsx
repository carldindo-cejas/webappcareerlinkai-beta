export type RankedItem = { name: string; count: number };

const RANK_BADGE: Record<number, { bg: string; text: string; bar: string }> = {
  1: { bg: 'bg-gold-500/15', text: 'text-gold-500', bar: '#B8924A' },
  2: { bg: 'bg-ink-300/20', text: 'text-ink-700', bar: '#8A9BAA' },
  3: { bg: 'bg-terracotta-100', text: 'text-terracotta-600', bar: '#C9723A' },
};

export default function RankedBar({
  items,
  maxItems = 5,
  emptyText = 'No data yet.'
}: {
  items: RankedItem[];
  maxItems?: number;
  emptyText?: string;
}) {
  const sorted = [...items].sort((a, b) => b.count - a.count).slice(0, maxItems);
  const max = Math.max(1, ...sorted.map(i => i.count));

  if (sorted.length === 0) {
    return <div className="text-ink-500 text-sm">{emptyText}</div>;
  }

  return (
    <div className="space-y-3">
      {sorted.map((item, idx) => {
        const rank = idx + 1;
        const pct = (item.count / max) * 100;
        const style = RANK_BADGE[rank];
        const barColor = style?.bar ?? '#DDD5C4';
        const isTop3 = rank <= 3;

        return (
          <div key={item.name}>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`font-mono text-[11px] font-bold w-6 shrink-0 text-center rounded px-0.5 py-0.5 ${isTop3 ? (style?.bg ?? '') + ' ' + (style?.text ?? '') : 'text-ink-400'}`}
              >
                #{rank}
              </span>
              <span className="text-sm truncate flex-1 font-medium" title={item.name}>
                {item.name}
              </span>
              <span className="font-mono text-xs text-ink-500 shrink-0">{item.count}</span>
            </div>
            <div className="h-2 bg-cream-200 rounded-full overflow-hidden ml-8">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
