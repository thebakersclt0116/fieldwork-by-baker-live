import { useState } from 'react';
import { Link } from 'react-router';
import type { HourEntry } from '@/types';
import { useFieldworkProfile } from '@/hooks/useFieldworkProfile';
import { currentMonthKey, trackedMonthKeys } from '@/lib/monthlyProgress';
import { summarizeForPlan, trackLabel, TRANSITION_SOURCE } from '../../shared/fieldwork-profile';
export default function FieldworkRequirements({entries}: {entries: HourEntry[]}) {
  const profile = useFieldworkProfile();
  const [month,setMonth] = useState(currentMonthKey);
  const [organization,setOrganization] = useState('');
  if (!profile) return null;
  const active = profile.organizations.filter(o => o.active).map(o => o.name);
  const names = [...new Set([...active,...entries.map(e => e.organizationName).filter((name): name is string => Boolean(name))])];
  const chosen = organization || active[0] || '';
  const data = summarizeForPlan(entries,profile,month,chosen), goal=data.rules[0].targetHours;
  const percent = Math.min(100,Math.max(0,data.recordedSelectedHours/goal*100));
  return <section className="rounded-2xl border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A]">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">Your fieldwork plan</h2><p className="mt-1 text-sm text-[#6B5D54] dark:text-[#CFC4BE]">{trackLabel(profile.fieldworkType)} · {data.rules.map(r => r.year).join(' and ')} requirements</p></div><Link to="/fieldwork-profile" className="text-sm font-semibold underline">Edit fieldwork profile</Link></div>
    <div className="my-4 grid gap-3 sm:grid-cols-3"><div><strong className="text-xl tabular-nums">{data.recordedSelectedHours.toFixed(2)} / {goal.toLocaleString()} h</strong><p className="text-xs">Recorded in your selected fieldwork type</p></div><div><strong className="text-xl tabular-nums">{data.restricted.toFixed(2)} h</strong><p className="text-xs">Restricted</p></div><div><strong className="text-xl tabular-nums">{data.unrestricted.toFixed(2)} h</strong><p className="text-xs">Unrestricted</p></div></div>
    <progress aria-label="Recorded hours toward selected fieldwork target" value={percent} max={100} className="h-2 w-full accent-[#E85D70]" />
    <p className="mt-2 text-xs leading-5 text-[#6B5D54] dark:text-[#CFC4BE]">Recorded hours are not a guarantee of qualifying credit. Drafts, rejected entries and incomplete activities are excluded here. {data.otherTypeHours > 0 && `${data.otherTypeHours.toFixed(2)} hours in the other fieldwork type are retained separately; mixed credit needs supervisor review.`}</p>
    <details className="mt-4 border-t border-[#E2DAD5] pt-4 dark:border-white/10"><summary className="cursor-pointer text-sm font-semibold">Monthly checks from the BACB transition guide</summary><div className="my-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Month<select className="mt-1 w-full rounded-xl border bg-white p-2 dark:bg-[#171412]" value={month} onChange={e => setMonth(e.target.value)}>{trackedMonthKeys(entries).map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm">Organization<select className="mt-1 w-full rounded-xl border bg-white p-2 dark:bg-[#171412]" value={chosen} onChange={e => setOrganization(e.target.value)}>{names.map(name => <option key={name}>{name}</option>)}</select></label></div>
      <p className="mb-3 text-xs leading-5">Review each organization and its supervision arrangement separately. {data.pendingEntries} selected entries await approval. {data.mixedMonth && 'This organization/month contains mixed fieldwork types; do not treat the checks below as a complete assessment.'}</p>
      <div className="space-y-3">{data.rules.map(r => <div key={r.year} className="rounded-xl bg-[#FAF8F6] p-4 text-sm dark:bg-white/5"><h3 className="font-semibold">{r.year} · {trackLabel(profile.fieldworkType)}</h3><p className="mt-2">Monthly hours: {data.organizationTotalHours.toFixed(2)} / {r.minimumMonthlyHours}–{r.maximumMonthlyHours} — {data.organizationTotalHours < r.minimumMonthlyHours ? 'below minimum' : data.organizationTotalHours > r.maximumMonthlyHours ? 'above maximum; review' : 'within guide range'}</p><p>Supervision: {data.supervisionPercent.toFixed(2)}% / {r.supervisionPercent}% — {data.mixedMonth ? 'review mixed types' : data.supervisionPercent + 0.000001 >= r.supervisionPercent ? 'recorded threshold reached' : 'more supervision needed'}</p><p>Client observation: {r.observationCount !== null ? `${data.observationCount} documented/indicated session(s) / at least 1` : `${data.observationMinutes.toFixed(1)} minutes / ${r.observationMinutes} minutes`} — {r.observationCount !== null ? data.inferredObservationCounts ? 'confirm counts from original records' : data.observationCount >= r.observationCount ? 'recorded threshold reached' : 'observation needed' : data.observationMinutes + 0.000001 >= r.observationMinutes! ? 'recorded threshold reached' : 'more observation minutes needed'}</p></div>)}</div>
      <p className="mt-4 text-xs leading-5 text-[#6B5D54] dark:text-[#CFC4BE]">This compares only the changes summarized in the transition guide, not every BACB requirement. Counts inferred from legacy observation minutes need confirmation. Retain both observation counts and durations. {profile.applicationTiming === 'BOTH' && 'Keep both sets of monthly/final forms with your supervisor while planning for both.'} <a href={TRANSITION_SOURCE} target="_blank" rel="noreferrer" className="underline">Official source</a>.</p>
    </details>
  </section>;
}
