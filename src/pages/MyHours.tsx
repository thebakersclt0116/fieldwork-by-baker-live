import { Link, useParams } from 'react-router';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import LogHoursTab from '@/components/dashboard/LogHoursTab';
import { isTrackedMonth } from '@/lib/loggedMonths';
import { monthLabel } from '@/lib/monthlyProgress';

export default function MyHours() {
  const { month } = useParams<{ month: string }>();
  const valid = !month || isTrackedMonth(month);
  return <div className="min-h-[80vh] bg-[#F5F1E8] px-4 py-6 text-[#333B2F] dark:bg-[#171C16] dark:text-[#F5F1E8] sm:px-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {month && <Link to="/dashboard" className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[#6B513E] dark:text-[#D8C9B3]"><ArrowLeft size={17} />Back to my hours</Link>}
          <h1 className="font-serif text-3xl font-semibold sm:text-4xl">{month ? (valid ? monthLabel(month) : 'Month not found') : 'My hours'}</h1>
          {month && valid && <p className="mt-2 text-sm text-[#655F50] dark:text-[#D8C9B3]">Review your individual entries and edit their details.</p>}
        </div>
        <Link to="/audit-history" className="inline-flex min-h-11 items-center gap-2 px-2 py-2 text-sm text-[#6B513E] underline dark:text-[#D8C9B3]"><FolderOpen size={16} />Original records</Link>
      </header>
      {valid ? <LogHoursTab month={month} /> : <p className="rounded-xl bg-[#FBF8F1] p-5 text-sm dark:bg-[#222A20]">Choose a month from My hours to view your saved entries.</p>}
    </div>
  </div>;
}
