type Props = {
  values: Record<string, number>;
  max?: number;
  size?: number;
};

export default function RadarChart({ values, max = 5, size = 280 }: Props) {
  const labels = Object.keys(values);
  const n = labels.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 36;

  const pt = (i: number, scale: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(angle) * r * scale, cy + Math.sin(angle) * r * scale];
  };

  const grid = [1, 0.75, 0.5, 0.25].map(scale =>
    labels.map((_, i) => pt(i, scale).join(',')).join(' ')
  );

  const polygon = labels
    .map((l, i) => pt(i, (values[l] || 0) / max).join(','))
    .join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {grid.map((p, i) => (
        <polygon key={i} points={p} fill="none" stroke="#DDD5C4" strokeWidth="1" />
      ))}
      {labels.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#DDD5C4" strokeWidth="1" />;
      })}
      <polygon points={polygon} fill="#C56A4A" fillOpacity="0.2" stroke="#C56A4A" strokeWidth="2" />
      {labels.map((l, i) => {
        const [x, y] = pt(i, 1.15);
        return (
          <text
            key={l}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            className="font-mono fill-ink-700"
            fontSize="11"
            letterSpacing="0.1em"
          >
            {l}
          </text>
        );
      })}
    </svg>
  );
}
