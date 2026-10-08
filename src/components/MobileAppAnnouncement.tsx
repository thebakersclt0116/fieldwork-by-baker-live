import { Link } from 'react-router';
import { ArrowUpRight, Smartphone } from 'lucide-react';

function PreviewScreen({ wide = false }: { wide?: boolean }) {
  return <div className="h-full rounded-[inherit] bg-[#fffaf6] p-4 text-[#332C28]">
    <div className="mb-5 flex items-center justify-between text-[9px] font-semibold"><span>9:41</span><span>● ▰</span></div>
    <div className="font-serif text-lg font-bold">Fieldwork <span className="font-sans text-[8px] text-[#E85D70]">by Baker</span></div>
    <p className="mt-3 text-[9px] text-[#9B8575]">YOUR FIELDWORK JOURNEY</p><p className="font-serif text-xl">A little closer, every day.</p>
    <div className="my-4 rounded-2xl bg-[#332C28] p-4 text-white"><p className="text-[8px] text-[#f4c895]">OCTOBER · SAMPLE PREVIEW</p><p className="mt-2 text-3xl">24.5 <span className="text-[10px] text-white/60">hours</span></p><div className="mt-3 h-1 rounded-full bg-white/20"><div className="h-full w-3/5 rounded-full bg-[#f4c895]" /></div></div>
    <div className={`grid gap-2 ${wide ? 'grid-cols-2' : ''}`}><div className="rounded-xl border border-[#eaded4] p-3 text-[10px]">Unrestricted <strong className="block text-lg">18.0h</strong></div><div className="rounded-xl border border-[#eaded4] p-3 text-[10px]">Supervision <strong className="block text-lg">2.5h</strong></div></div>
    <div className="mt-4 rounded-xl bg-[#fce7eb] p-3 text-[10px] font-semibold text-[#b94256]">＋ Log your next session</div>
  </div>;
}
export default function MobileAppAnnouncement() {
  return <section aria-labelledby="mobile-app-title" className="relative my-6 overflow-hidden rounded-[2rem] border border-[#eaded4] bg-gradient-to-br from-[#332c28] via-[#45332f] to-[#76514b] text-white">
    <div className="grid items-center gap-6 px-6 pt-8 md:grid-cols-2 md:px-10">
      <div className="pb-6"><span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs text-[#f4c895]"><Smartphone size={14} /> A new chapter is coming</span><h2 id="mobile-app-title" className="mt-5 font-serif text-4xl leading-tight md:text-5xl">Your journey.<br />Soon, in your pocket.</h2><p className="mt-5 text-xl font-semibold text-[#ffadb8]">iOS and Android app coming soon!</p><p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">A little more freedom to move forward. Your fieldwork workspace is already available in your mobile browser.</p><Link to="/suggestions" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#f4c895] px-4 py-3 text-sm font-semibold text-[#332c28]">Help shape what comes next <ArrowUpRight size={16} /></Link><p className="mt-4 text-[11px] text-white/50">Illustrative app preview. Device illustrations inspired by iPhone and your iPhone Duo reference.</p></div>
      <div aria-label="Fieldwork dashboard previews on a regular iPhone and an iPhone Duo-inspired foldable phone" role="img" className="relative mx-auto flex h-[365px] w-full max-w-[480px] items-end justify-center gap-3 overflow-hidden pt-4">
        <div className="relative z-10 w-[170px] shrink-0 translate-y-5 -rotate-6 rounded-[2rem] border-[6px] border-[#161616] bg-[#161616] shadow-2xl"><div className="absolute left-1/2 top-2 z-10 h-3 w-14 -translate-x-1/2 rounded-full bg-black" /><PreviewScreen /></div>
        <div className="relative w-[300px] shrink-0 translate-y-12 rotate-6 rounded-[1.5rem] border-[6px] border-[#242424] bg-[#242424] shadow-2xl"><div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px bg-black/10" /><PreviewScreen wide /></div>
      </div>
    </div>
  </section>;
}
