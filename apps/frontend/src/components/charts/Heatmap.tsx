type Cell = { date: string; count: number };

export default function Heatmap({ cells, title }: { cells: Cell[]; title?: string }) {
  const max = Math.max(1, ...cells.map(c => c.count));
  const cols = 10;
  const rows = Math.ceil(cells.length / cols);

  function color(count: number): string {
    if (count === 0) return 'bg-cream-200';
    const ratio = count / max;
    if (ratio > 0.75) return 'bg-terracotta-600';
    if (ratio > 0.5) return 'bg-terracotta-500';
    if (ratio > 0.25) return 'bg-terracotta-400';
    return 'bg-terracotta-100';
  }

  return (
    <div>
      {title && <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300 mb-3">{title}</div>}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {cells.map(cell => (
          <div
            key={cell.date}
            title={`${cell.date}: ${cell.count}`}
            className={`aspect-square rounded ${color(cell.count)}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-[11px] font-mono uppercase tracking-[0.1em] text-ink-300">
        <span>Less</span>
        <div className="w-3 h-3 rounded bg-cream-200" />
        <div className="w-3 h-3 rounded bg-terracotta-100" />
        <div className="w-3 h-3 rounded bg-terracotta-400" />
        <div className="w-3 h-3 rounded bg-terracotta-500" />
        <div className="w-3 h-3 rounded bg-terracotta-600" />
        <span>More</span>
      </div>
    </div>
  );
}
