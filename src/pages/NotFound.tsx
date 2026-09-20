import { Link } from 'react-router';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] bg-[#FFFCF9] px-4 py-16 dark:bg-[#171412]">
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0F3] text-[#E85D70] dark:bg-[#E85D70]/15"><Compass size={24} /></div>
        <div className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-[#A8998E]">404</div>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-[#332C28] dark:text-white">That page isn’t part of your path.</h1>
        <p className="mt-3 text-[#6B5D54] dark:text-[#CFC4BE]">The link may be outdated or the feature may have moved. Use the platform navigation or return home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] px-5 py-3 text-sm font-bold text-white dark:bg-[#E85D70]"><ArrowLeft size={15}/> Home</Link>
          <Link to="/roadmap" className="rounded-xl border border-[#E2DAD5] px-5 py-3 text-sm font-semibold text-[#6B5D54] dark:border-white/10 dark:text-[#CFC4BE]">BCBA Roadmap</Link>
        </div>
      </div>
    </div>
  );
}
