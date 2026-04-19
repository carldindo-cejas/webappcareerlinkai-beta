import { useMemo, useState } from 'react';

export type CalendarEvent = {
  id: number;
  title: string;
  scheduledAt: number; // unix seconds
  subtitle?: string;
};

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}

export default function MiniCalendar({ events, title }: { events: CalendarEvent[]; title?: string }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const { weeks, eventsByDay } = useMemo(() => {
    const first = startOfMonth(cursor.year, cursor.month);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const w: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7));

    const map: Record<number, CalendarEvent[]> = {};
    for (const ev of events) {
      const d = new Date(ev.scheduledAt * 1000);
      if (d.getFullYear() === cursor.year && d.getMonth() === cursor.month) {
        const key = d.getDate();
        (map[key] ||= []).push(ev);
      }
    }
    return { weeks: w, eventsByDay: map };
  }, [cursor, events]);

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric'
  });

  const upcoming = useMemo(() => {
    const now = Date.now() / 1000;
    return [...events]
      .filter(e => e.scheduledAt >= now)
      .sort((a, b) => a.scheduledAt - b.scheduledAt)
      .slice(0, 4);
  }, [events]);

  function shift(delta: number) {
    setCursor(c => {
      const next = new Date(c.year, c.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {title ? (
          <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300">{title}</div>
        ) : <span />}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="w-7 h-7 inline-flex items-center justify-center rounded border border-cream-300 text-ink-500 hover:border-forest-700 hover:text-forest-700"
            aria-label="Previous month"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M6.5 1.5L3 5l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span className="font-display text-sm w-32 text-center">{monthLabel}</span>
          <button
            type="button"
            onClick={() => shift(1)}
            className="w-7 h-7 inline-flex items-center justify-center rounded border border-cream-300 text-ink-500 hover:border-forest-700 hover:text-forest-700"
            aria-label="Next month"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 1.5L7 5l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d, i) => (
          <div key={i} className="font-mono text-[10px] uppercase text-ink-300 text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day, i) => {
          if (day === null) return <div key={i} className="aspect-square" />;
          const isToday =
            cursor.year === today.getFullYear() &&
            cursor.month === today.getMonth() &&
            day === today.getDate();
          const dayEvents = eventsByDay[day] || [];
          const hasEvents = dayEvents.length > 0;
          return (
            <div
              key={i}
              className={`aspect-square rounded text-[12px] flex flex-col items-center justify-center relative
                ${isToday ? 'bg-forest-700 text-cream-50' : hasEvents ? 'bg-terracotta-100 text-terracotta-800' : 'bg-cream-50 text-ink-500'}`}
              title={hasEvents ? dayEvents.map(e => e.title).join(' · ') : ''}
            >
              <span>{day}</span>
              {hasEvents && !isToday && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-terracotta-600" />
              )}
            </div>
          );
        })}
      </div>

      {upcoming.length > 0 && (
        <div className="mt-5 pt-4 border-t border-cream-300 space-y-2">
          <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300">Upcoming</div>
          {upcoming.map(ev => {
            const d = new Date(ev.scheduledAt * 1000);
            return (
              <div key={ev.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{ev.title}</div>
                  {ev.subtitle && <div className="text-ink-500 text-xs truncate">{ev.subtitle}</div>}
                </div>
                <span className="font-mono text-[11px] text-ink-500 whitespace-nowrap">
                  {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
