import { Link } from 'react-router';
import { Archive, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { ARCHIVED_PRODUCTS, MEMBER_NAV_ITEMS } from '@/lib/launchFeatures';

export default function AdminArchive() {
  return <div className="min-h-[70vh] bg-[#FFFCF9] px-4 py-10 dark:bg-[#171412] sm:px-6">
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#E85D70]"><ShieldCheck size={18} aria-hidden="true" /> Administrator only</div>
      <h1 className="mt-3 font-serif text-4xl font-semibold text-[#332C28] dark:text-white">Product archive</h1>
      <p className="mt-3 max-w-2xl text-[#6B5D54] dark:text-[#CFC4BE]">These products are preserved for review and a future rollout. Members use My Hours, Monthly Verification Forms, Exam Prep, and Suggestions.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ARCHIVED_PRODUCTS.map((product) => <article key={product.path} className="flex flex-col rounded-2xl border border-[#E9E0DA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A]">
          <Archive size={20} className="text-[#A8998E]" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-[#332C28] dark:text-white">{product.name}</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-[#6B5D54] dark:text-[#CFC4BE]">{product.description}</p>
          <Link className="mt-5 inline-flex items-center gap-2 self-start rounded-lg text-sm font-semibold text-[#C7465A] underline-offset-4 hover:underline dark:text-[#F28D9B]" to={product.path}>Preview {product.name}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </article>)}
      </div>
      <section className="mt-10 rounded-2xl border border-[#E9E0DA] p-5 dark:border-white/10" aria-labelledby="launch-workspace-heading">
        <h2 id="launch-workspace-heading" className="text-lg font-semibold text-[#332C28] dark:text-white">Current member workspace</h2>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">{MEMBER_NAV_ITEMS.map((item) => <Link key={item.path} className="text-sm font-semibold text-[#C7465A] underline dark:text-[#F28D9B]" to={item.path}>{item.label}</Link>)}</div>
      </section>
    </div>
  </div>;
}
