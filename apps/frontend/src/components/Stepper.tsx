type Step = { name: string; status: 'done' | 'active' | 'pending' };

export default function Stepper({ steps }: { steps: Step[] }) {
  return (
    <div className="bg-cream-50 border-b border-cream-300 px-4 sm:px-8 py-6">
      <div className="max-w-[1200px] mx-auto flex gap-0 overflow-x-auto">
        {steps.map((s, i) => {
          const numColor =
            s.status === 'active' ? 'text-terracotta-600' : s.status === 'done' ? 'text-forest-700' : 'text-ink-300';
          const nameColor = s.status === 'pending' ? 'text-ink-300' : 'text-ink-900';
          const barBg =
            s.status === 'done'
              ? 'bg-forest-700'
              : s.status === 'active'
              ? 'bg-cream-200 relative after:absolute after:inset-y-0 after:left-0 after:w-[60%] after:bg-terracotta-600'
              : 'bg-cream-300';
          const label =
            s.status === 'done'
              ? `0${i + 1} / DONE`
              : s.status === 'active'
              ? `0${i + 1} / IN PROGRESS`
              : `0${i + 1}`;
          return (
            <div
              key={i}
              className={`flex-1 min-w-[140px] pr-4 relative ${i !== steps.length - 1 ? 'after:content-[""] after:absolute after:right-0 after:top-2 after:w-px after:h-full after:bg-cream-300' : ''}`}
            >
              <div className={`font-mono text-[11px] tracking-[0.14em] mb-1.5 ${numColor}`}>{label}</div>
              <div className={`font-display font-medium text-[15px] ${nameColor}`}>{s.name}</div>
              <div className={`mt-3 h-[2px] rounded ${barBg}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
