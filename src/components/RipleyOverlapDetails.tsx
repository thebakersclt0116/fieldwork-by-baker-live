import type { PdfReport } from '@/lib/ripleyPdfLayout';

function time(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
function minutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export default function RipleyOverlapDetails({ report }: { report: PdfReport }) {
  if (!report.overlapPairs.length) return null;
  return <section aria-label="Overlapping times" className="mt-4 space-y-3 rounded-xl border border-amber-400/60 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-900/15 dark:text-amber-100">
    <h3 className="font-semibold">Where times overlap</h3>
    {report.overlapPairs.map(([a, b]) => {
      const first = report.sessions.find(session => session.index === a);
      const second = report.sessions.find(session => session.index === b);
      if (!first || !second) return null;
      const start = first.startTime > second.startTime ? first.startTime : second.startTime;
      const end = first.endTime < second.endTime ? first.endTime : second.endTime;
      return <article key={`${a}:${b}`} className="rounded-lg bg-white/70 p-3 dark:bg-white/5">
        <p className="font-semibold">{first.date} · overlap {time(start)}–{time(end)} ({minutes(end) - minutes(start)} minutes)</p>
        {[first, second].map(session => <div key={session.index} className="mt-3 border-t border-amber-300/50 pt-3">
          <p><strong>Source session {session.index}</strong> · {time(session.startTime)}–{time(session.endTime)} · PDF page{session.pages.length === 1 ? '' : 's'} {session.pages.join(', ')}</p>
          <p className="mt-1">{session.supervisor?.name || session.supervisorAlias}</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{session.narrative}</p>
        </div>)}
      </article>;
    })}
    <p>Use the session numbers, time ranges, and PDF pages to locate the original entries. Review corrections with your supervisor; importing preserves the original times.</p>
  </section>;
}
