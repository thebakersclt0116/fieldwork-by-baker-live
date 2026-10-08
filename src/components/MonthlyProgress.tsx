import { useMemo } from 'react';
import type { HourEntry } from '@/types';
import { currentMonthKey, monthLabel, summarizeMonth, trackedMonthKeys } from '@/lib/monthlyProgress';

export default function MonthlyProgress({ entries, selectedMonth, onSelect }: { entries: HourEntry[]; selectedMonth: string; onSelect: (month: string) => void }) {
  const summaries = useMemo(() => trackedMonthKeys(entries).map(month => summarizeMonth(entries, month)), [entries]);
  const summary = summaries.find(item => item.month === selectedMonth) || summarizeMonth([], selectedMonth);
  const metrics = [
    ['Total hours', summary.totalHours], ['Independent hours', summary.independentHours],
    ['Supervised hours', summary.supervisedHours], ['Individual supervision', summary.individualHours],
    ['Restricted', summary.restrictedHours], ['Unrestricted', summary.unrestrictedHours],
  ] as const;
  return <section aria-label="Fieldwork by month" className="rounded-3xl border border-[#F2EDEA] bg-white p-6 dark:border-white/10 dark:bg-[#211D1A]">
    <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#E85D70]">Your fieldwork timeline</p><h2 className="mt-1 font-serif text-2xl text-[#332C28] dark:text-white">Every month, in its place.</h2></div>
    <div role="tablist" aria-label="Tracked months" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {summaries.map(item => { const month = item.month; return <button key={month} type="button" role="tab" tabIndex={selectedMonth === month ? 0 : -1} onKeyDown={event => {
          if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
          event.preventDefault(); const index = summaries.findIndex(value => value.month === month);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? summaries.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + summaries.length) % summaries.length;
          onSelect(summaries[next].month); document.getElementById(`month-${summaries[next].month}`)?.focus();
        }} aria-selected={selectedMonth === month} aria-controls="monthly-hours-panel" id={`month-${month}`} onClick={() => onSelect(month)} className={`rounded-2xl border p-4 text-left transition ${selectedMonth === month ? 'border-[#E85D70] bg-[#FFF1F4] dark:bg-[#E85D70]/15' : 'border-[#F2EDEA] bg-[#FFFCF9] hover:border-[#E85D70]/50 dark:border-white/10 dark:bg-white/5'}`}>
        <div className="text-sm font-bold text-[#332C28] dark:text-white">{monthLabel(month)}</div>
        <div className="mt-1 text-xs text-[#A8998E]">{month === currentMonthKey() ? 'This month · ' : ''}{item.totalHours.toFixed(2)} hours · {item.sessions.length} entries</div>
        {item.organizations.length > 0 && <div className="mt-2 truncate text-xs text-[#6B5D54] dark:text-[#CFC4BE]">{item.organizations.join(' · ')}</div>}
      </button>; })}
    </div>
    <div id="monthly-hours-panel" role="tabpanel" aria-labelledby={`month-${selectedMonth}`} className="mt-5">
      <h3 className="mb-3 font-serif text-xl text-[#332C28] dark:text-white">{monthLabel(selectedMonth)}</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{metrics.map(([label, hours]) => <div key={label} className="rounded-xl bg-[#FAF8F6] p-4 dark:bg-white/5"><div className="text-xs text-[#A8998E]">{label}</div><div className="mt-1 font-mono text-xl text-[#332C28] dark:text-white">{hours.toFixed(2)}h</div></div>)}</div>
      {summary.unknownHours > 0 && <p className="mt-3 text-sm text-[#B77722]">{summary.unknownHours.toFixed(2)} hours need a restricted/unrestricted category.</p>}
      {summary.unknownSupervisionHours > 0 && <p className="mt-3 text-sm text-[#B77722]">{summary.unknownSupervisionHours.toFixed(2)} supervised hours have no individual/group allocation recorded.</p>}
      {summary.sessions.length === 0 && <p className="mt-3 text-sm text-[#A8998E]">No hours recorded for this month. Your imported history is available in the month tabs above.</p>}
    </div>
  </section>;
}
