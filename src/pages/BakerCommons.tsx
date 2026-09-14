import { useMemo, useState } from 'react';
import { Bell, Bookmark, CalendarDays, Heart, MessageCircle, Search, ShieldAlert, Sparkles, Users } from 'lucide-react';

const forums = ['Starting the BCBA journey', 'Coursework questions', 'Fieldwork & supervision', 'Ethics discussions', 'Exam preparation', 'Practice-question discussions', 'Study strategies', 'Career advice', 'Job opportunities', 'Research & resources', 'Wins & milestones', 'General discussion'];
const seedPosts = [
  { id: 'p1', author: 'Maya R.', badge: 'Fieldwork Focus', forum: 'Fieldwork & supervision', title: 'How are you organizing unrestricted activities across multiple supervisors?', body: 'I am trying to keep my monthly review clean when two BCBAs are responsible for different entries. What has made supervisor review easiest for you?', likes: 28, replies: 11 },
  { id: 'p2', author: 'Jordan T.', badge: 'Study Consistency', forum: 'Exam preparation', title: 'My exam-date cohort started a 30-minute daily review block', body: 'We each bring one concept we missed in practice and teach it back to the group. It has been surprisingly effective.', likes: 41, replies: 17 },
  { id: 'p3', author: 'Priya S., BCBA', badge: 'Verified Professional', forum: 'Ethics discussions', title: 'A good ethics discussion starts by separating facts from assumptions', body: 'When you work through a scenario, explicitly list what is known, what is inferred, and what additional information would be needed before choosing a response.', likes: 67, replies: 23 },
];

export default function BakerCommons() {
  const [query, setQuery] = useState('');
  const [activeForum, setActiveForum] = useState('All discussions');
  const [draft, setDraft] = useState('');
  const [posts, setPosts] = useState(seedPosts);
  const [saved, setSaved] = useState<string[]>([]);
  const visible = useMemo(() => posts.filter((post) => (activeForum === 'All discussions' || post.forum === activeForum) && `${post.title} ${post.body} ${post.author}`.toLowerCase().includes(query.toLowerCase())), [posts, activeForum, query]);

  const publish = () => {
    if (draft.trim().length < 8) return;
    setPosts([{ id: `local-${Date.now()}`, author: 'You', badge: 'Community Member', forum: activeForum === 'All discussions' ? 'General discussion' : activeForum, title: draft.trim().slice(0, 90), body: draft.trim(), likes: 0, replies: 0 }, ...posts]);
    setDraft('');
  };

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] px-4 py-8 dark:bg-[#171412]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-sm font-bold text-[#E85D70]"><Users size={17} /> Baker Commons</div><h1 className="mt-2 font-serif text-4xl font-semibold text-[#332C28] dark:text-white">Your private BCBA professional community.</h1><p className="mt-2 max-w-3xl text-[#6B5D54] dark:text-[#CFC4BE]">Study together, ask better questions, find accountability, connect with supervisors and peers, and celebrate milestones without turning the experience into a noisy generic social feed.</p></div><button className="inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B5D54] dark:border-white/10 dark:bg-white/5 dark:text-[#E7DED9]"><Bell size={16} /> Notifications</button></header>

        <div className="mb-5 rounded-2xl border border-[#F4D9C9] bg-[#FFF8F3] p-4 dark:border-[#D4A574]/20 dark:bg-[#D4A574]/10"><div className="flex items-start gap-3"><ShieldAlert size={19} className="mt-0.5 shrink-0 text-[#B36A2E]" /><div><div className="text-sm font-bold text-[#8A5D36] dark:text-[#F2C08D]">Protect client and workplace privacy.</div><p className="mt-1 text-xs leading-5 text-[#7A6049] dark:text-[#CDB59D]">Never post client names, protected health information, confidential employer information, private fieldwork records, or anything that could identify a client. Use de-identified educational discussion only.</p></div></div></div>

        <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
          <aside className="space-y-4"><div className="rounded-[26px] border border-[#F2EDEA] bg-white p-4 dark:border-white/10 dark:bg-[#211D1A]"><div className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[#A8998E]">Top forums</div><button onClick={() => setActiveForum('All discussions')} className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${activeForum === 'All discussions' ? 'bg-[#FFF0F3] text-[#D94D62]' : 'text-[#6B5D54] dark:text-[#CFC4BE]'}`}>All discussions</button>{forums.map((forum) => <button key={forum} onClick={() => setActiveForum(forum)} className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm ${activeForum === forum ? 'bg-[#FFF0F3] font-semibold text-[#D94D62] dark:bg-[#E85D70]/10' : 'text-[#6B5D54] hover:bg-[#FAF8F6] dark:text-[#CFC4BE] dark:hover:bg-white/5'}`}>{forum}</button>)}</div></aside>

          <main className="space-y-4">
            <div className="rounded-[26px] border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A]"><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0F3] text-sm font-bold text-[#E85D70] dark:bg-[#E85D70]/15">YOU</div><div className="flex-1"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Ask a question, share a win, start a study discussion…" className="w-full resize-none rounded-2xl border border-[#E2DAD5] bg-[#FFFCF9] px-4 py-3 text-sm text-[#332C28] outline-none focus:border-[#E85D70] dark:border-white/10 dark:bg-white/5 dark:text-white" /><div className="mt-3 flex items-center justify-between"><div className="text-xs text-[#A8998E]">Posting to: {activeForum === 'All discussions' ? 'General discussion' : activeForum}</div><button onClick={publish} className="rounded-xl bg-[#E85D70] px-4 py-2 text-sm font-bold text-white">Post to Commons</button></div></div></div></div>
            <div className="relative"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A8998E]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members, posts, groups, and topics" className="w-full rounded-2xl border border-[#E2DAD5] bg-white py-3 pl-11 pr-4 text-sm text-[#332C28] dark:border-white/10 dark:bg-[#211D1A] dark:text-white" /></div>
            {visible.map((post) => <article key={post.id} className="rounded-[26px] border border-[#F2EDEA] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#211D1A]"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-[#332C28] dark:text-white">{post.author}</span><span className="rounded-full bg-[#E8F5EE] px-2 py-1 text-[10px] font-bold text-[#4B8C69]">{post.badge}</span></div><div className="mt-1 text-xs text-[#A8998E]">{post.forum}</div></div><button onClick={() => setSaved((s) => s.includes(post.id) ? s.filter((id) => id !== post.id) : [...s, post.id])} className={saved.includes(post.id) ? 'text-[#E85D70]' : 'text-[#A8998E]'}><Bookmark size={18} fill={saved.includes(post.id) ? 'currentColor' : 'none'} /></button></div><h2 className="mt-4 font-serif text-xl font-semibold text-[#332C28] dark:text-white">{post.title}</h2><p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">{post.body}</p><div className="mt-4 flex gap-4 text-xs font-semibold text-[#8B7C73]"><span className="flex items-center gap-1.5"><Heart size={15} /> {post.likes}</span><span className="flex items-center gap-1.5"><MessageCircle size={15} /> {post.replies} replies</span></div></article>)}
          </main>

          <aside className="space-y-4"><div className="rounded-[26px] bg-[#332C28] p-5 text-white dark:bg-[#211D1A] dark:ring-1 dark:ring-white/10"><div className="flex items-center gap-2 text-sm font-bold text-[#F4C895]"><Sparkles size={16} /> Match me</div><h3 className="mt-2 font-serif text-xl font-semibold">Find your study people.</h3><p className="mt-2 text-sm leading-6 text-white/65">Match by exam date, study availability, content gaps, local area, or accountability style.</p><button className="mt-4 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#332C28]">Find study partners</button></div><div className="rounded-[26px] border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A]"><div className="flex items-center gap-2 text-sm font-bold text-[#4D423C] dark:text-white"><CalendarDays size={16} className="text-[#D4A574]" /> Upcoming</div><div className="mt-4 space-y-3 text-sm"><Event title="Exam-date cohort study sprint" meta="Tuesday • Virtual" /><Event title="Fieldwork documentation Q&A" meta="Thursday • Virtual" /><Event title="Ethics scenario roundtable" meta="Saturday • 45 min" /></div></div></aside>
        </div>
      </div>
    </div>
  );
}

function Event({ title, meta }: { title: string; meta: string }) { return <div className="border-b border-[#F2EDEA] pb-3 last:border-0 dark:border-white/10"><div className="font-semibold text-[#4D423C] dark:text-[#E7DED9]">{title}</div><div className="mt-1 text-xs text-[#A8998E]">{meta}</div></div>; }
