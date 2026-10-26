import { Link } from 'react-router';
import { FolderOpen, Upload } from 'lucide-react';
import LogHoursTab from '@/components/dashboard/LogHoursTab';
export default function MyHours() {
  return <div className="min-h-[80vh] bg-[#FFFCF9] px-4 py-8 text-[#332C28] dark:bg-[#171412] dark:text-[#F8F4F1] sm:px-6"><div className="mx-auto max-w-6xl space-y-6"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="font-serif text-4xl font-semibold">My Hours</h1><p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">Track your time, complete your session details, and keep your fieldwork together.</p></div><div className="flex flex-wrap gap-3 text-sm"><Link to="/import" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DDD2CA] px-4 py-2 font-semibold dark:border-white/20"><Upload size={16} />Import hours</Link><Link to="/audit-history" className="inline-flex min-h-11 items-center gap-2 px-2 py-2 text-[#6B5D54] underline dark:text-[#CFC4BE]"><FolderOpen size={16} />Original records</Link></div></header><LogHoursTab /></div></div>;
}
