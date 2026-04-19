type Bar = { label: string; value: number };

export default function BarChart({ bars, title, height = 180 }: { bars: Bar[]; title?: string; height?: number }) {
  const max = Math.max(1, ...bars.map(b => b.value));

  return (
    <div>
      {title && <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300 mb-3">{title}</div>}
      {bars.length === 0 ? (
        <div className="text-ink-500 text-sm">No data yet.</div>
      ) : (
        <div className="flex items-end gap-2" style={{ height }}>
          {bars.map(b => {
            const pct = (b.value / max) * 100;
            return (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                <div className="font-mono text-[11px] text-ink-500">{b.value}</div>
                <div className="w-full bg-cream-200 rounded-sm overflow-hidden" style={{ height: '100%' }}>
                  <div
                    className="w-full bg-forest-700 rounded-sm transition-all"
                    style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                    title={`${b.label}: ${b.value}`}
                  />
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-500 truncate w-full text-center" title={b.label}>
                  {b.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
