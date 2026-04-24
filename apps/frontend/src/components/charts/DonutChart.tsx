export const DONUT_PALETTE = ['#194D3B', '#8C3F22', '#B8924A', '#2F6F58', '#4F7A5A', '#C9723A', '#6E8C5C', '#3F5F48'];

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarPoint(cx, cy, r, endDeg);
  const end = polarPoint(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

export type DonutSlice = { label: string; value: number; color?: string };

export default function DonutChart({
  slices,
  size = 200,
  centerLabel,
  centerSub
}: {
  slices: DonutSlice[];
  size?: number;
  centerLabel: string;
  centerSub: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = rOuter * 0.58;

  return (
    <div className="relative inline-block shrink-0">
      <svg width={size} height={size} role="img" aria-label="Donut chart">
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={rOuter} fill="#F0EADF" />
        ) : (
          (() => {
            let acc = 0;
            return slices.map((s, i) => {
              const color = s.color ?? DONUT_PALETTE[i % DONUT_PALETTE.length];
              const startDeg = (acc / total) * 360;
              acc += s.value;
              const endDeg = (acc / total) * 360;
              if (slices.length === 1) {
                return <circle key={i} cx={cx} cy={cy} r={rOuter} fill={color} />;
              }
              return <path key={i} d={arcPath(cx, cy, rOuter, startDeg, endDeg)} fill={color} />;
            });
          })()
        )}
        <circle cx={cx} cy={cy} r={rInner} fill="#ffffff" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <div className="font-display text-3xl text-forest-700 leading-none">{centerLabel}</div>
        <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-500 mt-1">{centerSub}</div>
      </div>
    </div>
  );
}
