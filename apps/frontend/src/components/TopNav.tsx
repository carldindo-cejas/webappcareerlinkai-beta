import { ReactNode } from 'react';
import Logo from './Logo';

export default function TopNav({ right, sticky = false }: { right?: ReactNode; sticky?: boolean }) {
  return (
    <header
      className={`border-b border-cream-300 bg-cream-100 ${sticky ? 'sticky top-0 z-10 backdrop-blur bg-cream-100/90' : ''}`}
    >
      <div className="max-w-[1200px] mx-auto flex justify-between items-center px-4 sm:px-8 py-5">
        <Logo size="md" />
        {right}
      </div>
    </header>
  );
}

export function SaveStatus({ label = 'SAVED · JUST NOW' }: { label?: string }) {
  return (
    <span className="font-mono text-xs text-ink-300 tracking-[0.08em] flex items-center gap-2">
      <span className="w-1.5 h-1.5 bg-forest-400 rounded-full" />
      {label}
    </span>
  );
}
