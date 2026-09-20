import { useMemo, useState } from 'react';
import { Bell, Bookmark, CalendarDays, Heart, MessageCircle, Search, ShieldAlert, Sparkles, Users, X } from 'lucide-react';

const POST_KEY = 'fieldworkByBaker:commonsPosts:v1';
const MATCH_KEY = 'fieldworkByBaker:commonsMatch:v1';

const forums = ['Starting the BCBA journey', 'Coursework questions', 'Fieldwork & supervision', 'Ethics discussions', 'Exam preparation', 'Practice-question discussions', 'Study strategies', 'Career advice', 'Job opportunities', 'Research & resources', 'Wins & milestones', 'General discussion'];

const starterPosts = [
  { id: 'prompt1', author: 'Baker Commons', badge: 'Discussion prompt', forum: 'Fieldwork & supervision', title: 'What makes a monthly supervisor review easiest for you?', body: 'Share a de-identified workflow tip for organizing hours across multiple supervisors or organizations.', likes: 0, replies: 0 },
  { id: 'prompt2', author: 'Baker Commons', badge: 'Discussion prompt', forum: 'Exam preparation', title: 'What concept do you keep mixing up in practice?', body: 'Post the concepts you are discriminating between and explain what part still feels unclear. Do not post secure exam content.', likes: 0, replies: 0 },
  { id: 'prompt3', author: 'Baker Commons', badge: 'Discussion prompt', forum: 'Ethics discussions', title: 'Facts first: what information would you need before deciding?', body: 'Use a de-identified ethics scenario and separate known facts, assumptions, and information you would still need.', likes: 0, replies: 0 },
];

type Post = typeof starterPosts[number];

function loadPosts(): Post[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(POST_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function BakerCommons() {
  const [query, setQuery] = useState('');
  const [activeForum, setActiveForum] = useState('All discussions');
  const [draft, setDraft] = useState('');
  const [posts, setPosts] = useState<Post[]>(() => [...loadPosts(), ...starterPosts]);
  const [saved, setSaved] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMatcher, setShowMatcher] = useState(false);
  const [eventDetail, setEventDetail] = useState<{ title: string; meta: string } | null>(null);
  const [examDate, setExamDate] = useState('');
  const [focus, setFocus] = useState('Exam preparation');
  const [availability, setAvailability] = useState('');
  const [matchSaved, setMatchSaved] = useState(false);

  const visible = useMemo(() => posts.filter((post) => (activeForum === 'All discussions' || post.forum === activeForum) && (post.title + ' ' + post.body + ' ' + post.author).toLowerCase().includes(query.toLowerCase())), [posts, activeForum, query]);

  const publish = () => {
    if (draft.trim().length < 8) return;
    const post: Post = {
      id: 'local-' + Date.now(),
      author: 'You',
      badge: 'Browser-local beta post',
      forum: activeForum === 'All discussions' ? 'General discussion' : activeForum,
      title: draft.trim().slice(0, 90),
      body: draft.trim(),
      likes: 0,
      replies: 0,
    };
    const local = [post, ...loadPosts()].slice(0, 50);
    localStorage.setItem(POST_KEY, JSON.stringify(local));
    setPosts([post, ...posts]);
    setDraft('');
  };

  const saveMatch = () => {
    localStorage.setItem(MATCH_KEY, JSON.stringify({ examDate, focus, availability, updatedAt: new Date().toISOString() }));
    setMatchSaved(true);
  };

  const notifications = [
    saved.length > 0 ? 'You have ' + saved.length + ' saved Commons discussion' + (saved.length === 1 ? '' : 's') + '.' : 'Bookmark a discussion to build your saved reading list.',
    loadPosts().length > 0 ? 'Your browser currently has ' + loadPosts().length + ' local Commons post' + (loadPosts().length === 1 ? '' : 's') + '.' : 'Your first Commons post can be created from the composer.',
    'Shared multi-user notifications are not enabled in this beta yet.',
  ];

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] px-4 py-8 dark:bg-[#171412]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-[#E85D70]"><Users size={17} /> Baker Commons <span className="rounded-full bg-[#FFF0F3] px-2 py-1 text-[9px] font-bold uppercase tracking-wider dark:bg-[#E85D70]/15">Beta</span></div>
            <h1 className="mt-2 font-serif text-4xl font-semibold text-[#332C28] dark:text-white">Your BCBA professional community workspace.</h1>
            <p className="mt-2 max-w-3xl text-[#6B5D54] dark:text-[#CFC4BE]">Study together, ask better questions, find accountability, and organize community ideas without turning the experience into a noisy generic social feed.</p>
          </div>
          <button onClick={() => setShowNotifications(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#E2DAD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B5D54] dark:border-white/10 dark:bg-white/5 dark:text-[#E7DED9]"><Bell size={16} /> Notifications</button>
        </header>

        <div className="mb-5 rounded-2xl border border-[#F4D9C9] bg-[#FFF8F3] p-4 dark:border-[#D4A574]/20 dark:bg-[#D4A574]/10">
          <div className="flex items-start gap-3"><ShieldAlert size={19} className="mt-0.5 shrink-0 text-[#B36A2E]" /><div><div className="text-sm font-bold text-[#8A5D36] dark:text-[#F2C08D]">Protect client and workplace privacy.</div><p className="mt-1 text-xs leading-5 text-[#7A6049] dark:text-[#CDB59D]">Never post client names, protected health information, confidential employer information, private fieldwork records, or anything that could identify a client. This beta currently stores your own new posts in this browser; the shared multi-user community backend is not live yet.</p></div></div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
          <aside className="space-y-4">
            <div className="rounded-[26px] border border-[#F2EDEA] bg-white p-4 dark:border-white/10 dark:bg-[#211D1A]">
              <div className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[#A8998E]">Top forums</div>
              <button onClick={() => setActiveForum('All discussions')} className={'mb-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ' + (activeForum === 'All discussions' ? 'bg-[#FFF0F3] text-[#D94D62]' : 'text-[#6B5D54] dark:text-[#CFC4BE]')}>All discussions</button>
              {forums.map((forum) => <button key={forum} onClick={() => setActiveForum(forum)} className={'mb-1 w-full rounded-xl px-3 py-2 text-left text-sm ' + (activeForum === forum ? 'bg-[#FFF0F3] font-semibold text-[#D94D62] dark:bg-[#E85D70]/10' : 'text-[#6B5D54] hover:bg-[#FAF8F6] dark:text-[#CFC4BE] dark:hover:bg-white/5')}>{forum}</button>)}
            </div>
          </aside>

          <main className="space-y-4">
            <div className="rounded-[26px] border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A]">
              <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0F3] text-sm font-bold text-[#E85D70] dark:bg-[#E85D70]/15">YOU</div><div className="flex-1"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Ask a question, share a win, start a study discussion…" className="w-full resize-none rounded-2xl border border-[#E2DAD5] bg-[#FFFCF9] px-4 py-3 text-sm text-[#332C28] outline-none focus:border-[#E85D70] dark:border-white/10 dark:bg-white/5 dark:text-white" /><div className="mt-3 flex items-center justify-between gap-3"><div className="text-xs text-[#A8998E]">Posts created today stay in this browser during the community beta.</div><button onClick={publish} disabled={draft.trim().length < 8} className="rounded-xl bg-[#E85D70] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Post to Commons</button></div></div></div>
            </div>
            <div className="relative"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A8998E]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search posts and topics" className="w-full rounded-2xl border border-[#E2DAD5] bg-white py-3 pl-11 pr-4 text-sm text-[#332C28] dark:border-white/10 dark:bg-[#211D1A] dark:text-white" /></div>
            {visible.map((post) => <article key={post.id} className="rounded-[26px] border border-[#F2EDEA] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#211D1A]"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-[#332C28] dark:text-white">{post.author}</span><span className="rounded-full bg-[#E8F5EE] px-2 py-1 text-[10px] font-bold text-[#4B8C69]">{post.badge}</span></div><div className="mt-1 text-xs text-[#A8998E]">{post.forum}</div></div><button onClick={() => setSaved((s) => s.includes(post.id) ? s.filter((id) => id !== post.id) : [...s, post.id])} className={saved.includes(post.id) ? 'text-[#E85D70]' : 'text-[#A8998E]'} aria-label="Save discussion"><Bookmark size={18} fill={saved.includes(post.id) ? 'currentColor' : 'none'} /></button></div><h2 className="mt-4 font-serif text-xl font-semibold text-[#332C28] dark:text-white">{post.title}</h2><p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">{post.body}</p><div className="mt-4 flex gap-4 text-xs font-semibold text-[#8B7C73]"><span className="flex items-center gap-1.5"><Heart size={15} /> {post.likes}</span><span className="flex items-center gap-1.5"><MessageCircle size={15} /> {post.replies} replies</span></div></article>)}
          </main>

          <aside className="space-y-4">
            <div className="rounded-[26px] bg-[#332C28] p-5 text-white dark:bg-[#211D1A] dark:ring-1 dark:ring-white/10"><div className="flex items-center gap-2 text-sm font-bold text-[#F4C895]"><Sparkles size={16} /> Match me</div><h3 className="mt-2 font-serif text-xl font-semibold">Find your study people.</h3><p className="mt-2 text-sm leading-6 text-white/65">Save your exam date, availability, and focus so matching is ready when the shared community network is enabled.</p><button onClick={() => setShowMatcher(true)} className="mt-4 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#332C28]">Set matching profile</button></div>
            <div className="rounded-[26px] border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A]"><div className="flex items-center gap-2 text-sm font-bold text-[#4D423C] dark:text-white"><CalendarDays size={16} className="text-[#D4A574]" /> Upcoming ideas</div><div className="mt-4 space-y-2"><Event title="Exam-date cohort study sprint" meta="Virtual study format" onOpen={() => setEventDetail({ title: 'Exam-date cohort study sprint', meta: 'A suggested virtual study session format. Live scheduling is not connected yet.' })} /><Event title="Fieldwork documentation Q&A" meta="Supervisor discussion format" onOpen={() => setEventDetail({ title: 'Fieldwork documentation Q&A', meta: 'A suggested Commons event. Shared event registration is not connected yet.' })} /><Event title="Ethics scenario roundtable" meta="45-minute format" onOpen={() => setEventDetail({ title: 'Ethics scenario roundtable', meta: 'A suggested de-identified ethics discussion format. Live event registration is not connected yet.' })} /></div></div>
          </aside>
        </div>
      </div>

      {showNotifications && <Modal title="Commons notifications" onClose={() => setShowNotifications(false)}>{notifications.map((item) => <div key={item} className="rounded-xl bg-[#FAF8F6] p-3 text-sm text-[#6B5D54] dark:bg-white/5 dark:text-[#CFC4BE]">{item}</div>)}</Modal>}

      {showMatcher && <Modal title="Study-partner matching profile" onClose={() => setShowMatcher(false)}>
        <p className="text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">This saves your matching criteria locally today. It does not invent other members or pretend the shared network is live.</p>
        <label className="mt-4 block text-xs font-semibold text-[#7B6B62] dark:text-[#CFC4BE]">Target exam date<input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="field-input" /></label>
        <label className="mt-3 block text-xs font-semibold text-[#7B6B62] dark:text-[#CFC4BE]">Primary focus<select value={focus} onChange={(e) => setFocus(e.target.value)} className="field-input bg-white dark:bg-[#171412]"><option>Exam preparation</option><option>Fieldwork accountability</option><option>Ethics discussions</option><option>Study consistency</option></select></label>
        <label className="mt-3 block text-xs font-semibold text-[#7B6B62] dark:text-[#CFC4BE]">Availability<input value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="Example: weeknights after 7 PM" className="field-input" /></label>
        <button onClick={saveMatch} className="mt-4 w-full rounded-xl bg-[#E85D70] px-4 py-3 text-sm font-bold text-white">Save matching profile</button>
        {matchSaved && <div className="mt-3 rounded-xl bg-[#E8F5EE] p-3 text-sm font-semibold text-[#4B8C69]">Matching profile saved on this device.</div>}
      </Modal>}

      {eventDetail && <Modal title={eventDetail.title} onClose={() => setEventDetail(null)}><p className="text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">{eventDetail.meta}</p></Modal>}
    </div>
  );
}

function Event({ title, meta, onOpen }: { title: string; meta: string; onOpen: () => void }) {
  return <button onClick={onOpen} className="w-full rounded-xl border border-[#F2EDEA] p-3 text-left transition hover:border-[#F0C0CA] dark:border-white/10"><div className="font-semibold text-[#4D423C] dark:text-[#E7DED9]">{title}</div><div className="mt-1 text-xs text-[#A8998E]">{meta}</div></button>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-[28px] border border-[#F2EDEA] bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#211D1A]"><div className="flex items-center justify-between gap-3"><h2 className="font-serif text-2xl font-semibold text-[#332C28] dark:text-white">{title}</h2><button onClick={onClose} className="rounded-xl p-2 text-[#A8998E] hover:bg-black/5 dark:hover:bg-white/5" aria-label="Close"><X size={19} /></button></div><div className="mt-4 space-y-3">{children}</div></div></div>;
}
