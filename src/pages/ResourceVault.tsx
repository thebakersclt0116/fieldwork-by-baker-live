import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Check, Copy, Download, FileText, Filter, Library, Search, Sparkles, X } from 'lucide-react';

type ResourceSection = { heading: string; body?: string; bullets?: string[] };
type Resource = {
  id: string;
  title: string;
  stage?: string;
  topic?: string;
  format?: string;
  difficulty?: string;
  time?: string;
  desc?: string;
  summary?: string;
  sections?: ResourceSection[] | string[];
};

const builtInResources: Resource[] = [
  {
    id: 'r1',
    title: 'Fieldwork Organization Checklist',
    stage: 'Fieldwork',
    topic: 'Documentation',
    format: 'Checklist',
    difficulty: 'Foundational',
    time: '8 min',
    desc: 'A clean checklist for organizing supervision, monthly forms, supporting notes, and audit-ready documentation.',
    sections: [
      { heading: 'Before the month begins', bullets: ['Confirm the responsible supervisor(s) and organization for the month.', 'Know whether your experience is Supervised Fieldwork or Concentrated Supervised Fieldwork.', 'Keep current supervision agreements and organization requirements accessible.', 'Choose one place to store your original fieldwork records and supporting documentation.'] },
      { heading: 'For every fieldwork entry', bullets: ['Record the date, start time, end time, and activity description.', 'Identify the responsible organization and supervisor.', 'Classify the activity as Restricted or Unrestricted based on your actual activity and supervisor guidance.', 'Identify whether the time was Independent or Supervisor-Present.', 'Record supervision and client-observation minutes when they occurred.', 'Keep descriptions de-identified and avoid unnecessary client information.'] },
      { heading: 'During monthly review', bullets: ['Compare recorded totals with your supervisor before finalizing monthly documentation.', 'Review supervision percentage, observation activity, and Restricted/Unrestricted distribution.', 'Resolve duplicate, missing, or misclassified entries while the month is still fresh.', 'Document the reason for any changes made after supervisor review.'] },
      { heading: 'Retention habit', bullets: ['Export or back up your records regularly.', 'Keep signed verification documents separately from your working tracker.', 'Do not rely on one browser, one device, or one software product as the only copy of required professional records.'] },
    ],
  },
  {
    id: 'r2',
    title: 'Restricted vs. Unrestricted Study Guide',
    stage: 'Fieldwork',
    topic: 'Fieldwork',
    format: 'Study guide',
    difficulty: 'Foundational',
    time: '12 min',
    desc: 'A plain-language review framework with examples, non-examples, and questions to take to your supervisor.',
    sections: [
      { heading: 'Core discrimination', body: 'Restricted activities are primarily the direct implementation of behavior-analytic services with a client. Unrestricted activities are behavior-analytic activities that develop the skills expected of a behavior analyst beyond direct implementation. The exact classification still depends on what you actually did and current official guidance.' },
      { heading: 'Common Restricted examples', bullets: ['Directly implementing a behavior-reduction or skill-acquisition procedure with a client.', 'Providing direct client services where the primary activity is implementation rather than analysis, design, or training.', 'Carrying out programmed procedures rather than designing, evaluating, or modifying them.'] },
      { heading: 'Common Unrestricted examples', bullets: ['Analyzing data and interpreting patterns.', 'Designing or revising behavior-analytic programs.', 'Conducting assessments or preparing assessment-related analysis.', 'Training caregivers or staff in behavior-analytic procedures when the activity develops analyst-level competencies.', 'Writing behavior-analytic reports or preparing treatment recommendations.', 'Researching behavior-analytic literature relevant to a case or program.'] },
      { heading: 'Ask yourself', bullets: ['Was I mainly implementing an existing procedure, or analyzing/designing/training/evaluating?', 'What behavior-analytic skill did this activity build?', 'Could I clearly explain the activity to my supervisor without relying on a vague label such as “paperwork”?', 'Would my supervisor classify it the same way after seeing exactly what I did?'] },
      { heading: 'Important', body: 'Use this as a study framework, not as an automatic eligibility decision. Your supervisor and current official BACB materials should be used for authoritative classification questions.' },
    ],
  },
  {
    id: 'r3',
    title: 'Ethics Scenario Workbook',
    stage: 'Exam prep',
    topic: 'Ethics',
    format: 'Worksheet',
    difficulty: 'Intermediate',
    time: '25 min',
    desc: 'Original practice scenarios designed to strengthen ethical reasoning without reproducing examination items.',
    sections: [
      { heading: 'Scenario 1 — Competing responsibilities', body: 'A supervisee notices that a workplace policy conflicts with what they believe is clinically appropriate. The supervisor is unavailable until the next day, but staff want an immediate answer.' },
      { heading: 'Work it through', bullets: ['List only the facts you actually know.', 'Identify whose rights, safety, confidentiality, and professional responsibilities may be affected.', 'Separate urgency from convenience.', 'Identify what additional information is needed before acting.', 'Identify appropriate consultation or escalation options.', 'State what should be documented.'] },
      { heading: 'Scenario 2 — Confidentiality pressure', body: 'A coworker who is not part of a client’s treatment team asks for details about a difficult incident because “everyone already knows what happened.”' },
      { heading: 'Work it through', bullets: ['What information is necessary to share, if any?', 'What makes the request different from a legitimate treatment-team communication?', 'How could you redirect the conversation while protecting confidentiality?', 'What organizational policy or supervisor guidance would you consult?'] },
      { heading: 'Scenario 3 — Dual-role concern', body: 'A family offers an expensive personal gift after a major treatment milestone and says refusing it would be culturally disrespectful.' },
      { heading: 'Work it through', bullets: ['Identify the ethical risk without assuming the family’s intent.', 'Consider value, timing, cultural variables, power differences, and future expectations.', 'Identify what consultation is appropriate.', 'Write a response that is respectful without making promises you cannot keep.'] },
    ],
  },
  {
    id: 'r4',
    title: 'BCBA Exam Week Planner',
    stage: 'Exam prep',
    topic: 'Study strategy',
    format: 'Schedule',
    difficulty: 'Foundational',
    time: '10 min',
    desc: 'Plan review blocks, recovery time, sleep, practice sets, and the final 72 hours before your test date.',
    sections: [
      { heading: '7–5 days before', bullets: ['Use mixed retrieval practice instead of rereading everything.', 'Review your highest-error content areas first.', 'Complete short timed sets and review why every missed option was wrong.', 'Keep normal sleep and meal routines.'] },
      { heading: '4–3 days before', bullets: ['Complete one realistic timed block or simulation if useful for pacing.', 'Build a “last look” sheet of concepts you repeatedly confuse.', 'Reduce new content and increase discrimination practice between similar concepts.', 'Confirm testing logistics, identification, route, arrival time, and allowed materials.'] },
      { heading: '48 hours before', bullets: ['Prioritize sleep and consistency over marathon studying.', 'Use short active-recall blocks.', 'Review formulas, measurement discriminations, ethics decision frameworks, and personally weak topics.', 'Stop studying at a predetermined time.'] },
      { heading: 'Day before', bullets: ['Do a light confidence review only.', 'Prepare clothes, identification, food, transportation, and alarms.', 'Avoid a full-length practice exam.', 'Protect sleep.'] },
      { heading: 'Exam morning', bullets: ['Eat and hydrate normally.', 'Arrive with time to spare.', 'Use your pacing strategy from practice.', 'If stuck, identify what the question is asking, eliminate clearly incompatible options, choose, and move on.'] },
    ],
  },
  {
    id: 'r5',
    title: 'Supervision Meeting Agenda',
    stage: 'Fieldwork',
    topic: 'Supervision',
    format: 'Template',
    difficulty: 'Foundational',
    time: '5 min',
    desc: 'A reusable agenda for questions, feedback, observation, next actions, and documentation follow-up.',
    sections: [
      { heading: '1. Opening check-in', bullets: ['What changed since the previous meeting?', 'Any urgent ethical, client-safety, documentation, or workplace concerns?', 'What is the top priority for today?'] },
      { heading: '2. Fieldwork review', bullets: ['Hours accumulated since last meeting.', 'Restricted vs. Unrestricted distribution.', 'Independent vs. supervisor-present activities.', 'Observation/contact requirements that need attention.', 'Entries that are unclear or need reclassification.'] },
      { heading: '3. Skill development', bullets: ['One competency to strengthen.', 'One example of successful application.', 'One error pattern or misconception to correct.', 'A practice or performance task for the next supervision period.'] },
      { heading: '4. Case or project discussion', bullets: ['Define the question before discussing solutions.', 'Review relevant data.', 'Separate facts from assumptions.', 'Identify next analytic or documentation steps.'] },
      { heading: '5. Close', bullets: ['Write the next three actions.', 'Assign responsibility and due dates.', 'Document any fieldwork corrections or follow-up needed.', 'Schedule the next supervision contact.'] },
    ],
  },
  {
    id: 'r6',
    title: 'Behavior-Analytic Interview Prep',
    stage: 'Career',
    topic: 'Career',
    format: 'Guide',
    difficulty: 'Intermediate',
    time: '20 min',
    desc: 'Prepare concise stories about collaboration, data, ethics, communication, supervision, and professional growth.',
    sections: [
      { heading: 'Prepare six stories', bullets: ['A time data changed your understanding of a situation.', 'A time you received corrective feedback and improved.', 'A time you explained a technical concept to a nontechnical person.', 'A time you handled disagreement professionally.', 'A time you protected confidentiality or raised an ethical concern.', 'A time you had to organize competing priorities.'] },
      { heading: 'Use a compact structure', bullets: ['Situation: enough context to understand the problem.', 'Responsibility: what you were expected to do.', 'Action: what you personally did and why.', 'Result: what changed, what the data showed, or what you learned.', 'Reflection: what you would repeat or improve next time.'] },
      { heading: 'Questions to ask the employer', bullets: ['How is supervision structured and protected from productivity pressure?', 'How are clinical decisions reviewed?', 'How are caseloads determined?', 'What data systems and documentation standards are used?', 'How is ongoing training handled?', 'What does excellent performance look like after 90 days?'] },
    ],
  },
  {
    id: 'r7',
    title: 'Measurement Flashcard Pack',
    stage: 'Exam prep',
    topic: 'Measurement',
    format: 'Flashcards',
    difficulty: 'Foundational',
    time: '15 min',
    desc: 'A focused review of common measurement dimensions, examples, and discriminations.',
    sections: [
      { heading: 'Frequency / Count', body: 'How many times a response occurred. Best when each response has a clear beginning and end and observation opportunities are comparable.' },
      { heading: 'Rate', body: 'Count divided by observation time. Useful when observation periods differ and responses can be counted.' },
      { heading: 'Duration', body: 'How long a behavior lasts from onset to offset.' },
      { heading: 'Latency', body: 'Time from a specified antecedent or opportunity to the beginning of the response.' },
      { heading: 'Interresponse time (IRT)', body: 'Time between the end of one response and the beginning of the next response.' },
      { heading: 'Permanent product', body: 'Measurement of a durable result of behavior rather than directly observing the behavior itself.' },
      { heading: 'Quick discrimination', bullets: ['“How many?” → count/frequency.', '“How many per unit of time?” → rate.', '“How long did it last?” → duration.', '“How long until it started?” → latency.', '“How long between responses?” → IRT.'] },
    ],
  },
  {
    id: 'r8',
    title: 'Research Reading Notes Template',
    stage: 'Coursework',
    topic: 'Research',
    format: 'Template',
    difficulty: 'Intermediate',
    time: '7 min',
    desc: 'Capture research questions, methods, findings, limitations, and how a paper connects to your coursework.',
    sections: [
      { heading: 'Citation', body: 'Author(s), year, title, journal/source, DOI or link.' },
      { heading: 'Question', body: 'What exact research question or clinical problem was the paper trying to answer?' },
      { heading: 'Participants / setting', body: 'Who participated and where did the study occur? What details matter for generality?' },
      { heading: 'Variables and measurement', body: 'What was manipulated or compared? What behavior or outcome was measured? How was it measured?' },
      { heading: 'Design / method', body: 'Identify the design and the features that support or limit experimental control.' },
      { heading: 'Main findings', body: 'State the main result in your own words without overstating what the data show.' },
      { heading: 'Limitations', body: 'What cannot be concluded from this study? What threats, restrictions, or unanswered questions remain?' },
      { heading: 'Application', body: 'How does this paper connect to coursework, fieldwork, supervision, or another concept you are learning?' },
      { heading: 'One-sentence teach-back', body: 'Explain the paper as if you had 30 seconds to teach its most important point to a classmate.' },
    ],
  },
];

function loadBrainResources(): Resource[] {
  try {
    const items = JSON.parse(localStorage.getItem('fieldworkByBaker:brainResources:v1') || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function resourceText(resource: Resource) {
  const lines = [resource.title, '', resource.desc || resource.summary || '', ''];
  (resource.sections || []).forEach((section: ResourceSection | string) => {
    if (typeof section === 'string') {
      lines.push(section, '');
      return;
    }
    lines.push(section.heading);
    if (section.body) lines.push(section.body);
    if (section.bullets) section.bullets.forEach((item) => lines.push('• ' + item));
    lines.push('');
  });
  return lines.join('\n').trim();
}

function downloadResource(resource: Resource) {
  const blob = new Blob([resourceText(resource)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = resource.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.txt';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function ResourceVault() {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('All stages');
  const [selected, setSelected] = useState<Resource | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('fieldworkByBaker:resourceSaves:v1') || '[]'); } catch { return []; }
  });

  const brainResources = useMemo(() => loadBrainResources(), []);
  const resources = useMemo(() => [...brainResources, ...builtInResources], [brainResources]);
  const stages = ['All stages', ...Array.from(new Set(resources.map((r) => r.stage || 'Exam prep')))];
  const visible = useMemo(
    () => resources.filter((r) => (stage === 'All stages' || (r.stage || 'Exam prep') === stage) && `${r.title} ${r.topic} ${r.format} ${r.desc || r.summary || ''}`.toLowerCase().includes(query.toLowerCase())),
    [query, stage, resources]
  );

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const toggle = (id: string) => {
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    setSaved(next);
    localStorage.setItem('fieldworkByBaker:resourceSaves:v1', JSON.stringify(next));
  };

  const copySelected = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(resourceText(selected));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const openResource = (resource: Resource) => {
    setCopied(false);
    setSelected(resource);
  };

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] px-4 py-8 dark:bg-[#171412]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-sm font-bold text-[#E85D70]"><Library size={17} /> Resource Vault</div>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-[#332C28] dark:text-white">Everything worth keeping, easy to find again.</h1>
          <p className="mt-2 max-w-3xl text-[#6B5D54] dark:text-[#CFC4BE]">Open complete study guides, flashcards, templates, checklists, ethics scenarios, career tools, research notes, and personalized materials created by Baker Brain.</p>
        </header>

        {brainResources.length > 0 && (
          <div className="mb-5 rounded-2xl border border-[#F0D5DA] bg-[#FFF7F8] px-4 py-3 text-sm text-[#7B6B62] dark:border-[#E85D70]/20 dark:bg-[#E85D70]/10 dark:text-[#CFC4BE]">
            <Sparkles size={15} className="mr-2 inline text-[#E85D70]" />{brainResources.length} personalized Baker Brain resource{brainResources.length === 1 ? '' : 's'} saved here.
          </div>
        )}

        <div className="mb-6 grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A8998E]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the vault" className="w-full rounded-2xl border border-[#E2DAD5] bg-white py-3 pl-11 pr-4 text-sm text-[#332C28] dark:border-white/10 dark:bg-[#211D1A] dark:text-white" />
          </div>
          <label className="relative">
            <Filter size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A8998E]" />
            <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full appearance-none rounded-2xl border border-[#E2DAD5] bg-white py-3 pl-11 pr-4 text-sm text-[#332C28] dark:border-white/10 dark:bg-[#211D1A] dark:text-white">
              {stages.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-[#FFF0F3] px-3 py-1.5 text-xs font-bold text-[#D94D62] dark:bg-[#E85D70]/10 dark:text-[#FF8EA0]">{visible.length} resources</span>
          <span className="rounded-full bg-[#FAF8F6] px-3 py-1.5 text-xs font-semibold text-[#6B5D54] dark:bg-white/5 dark:text-[#CFC4BE]">{saved.length} saved</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((resource) => {
            const isBrain = String(resource.id).startsWith('brain_');
            return (
              <article
                key={resource.id}
                role="button"
                tabIndex={0}
                onClick={() => openResource(resource)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openResource(resource); } }}
                className={`cursor-pointer rounded-[26px] border bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#E85D70]/40 dark:bg-[#211D1A] ${isBrain ? 'border-[#F0D5DA] dark:border-[#E85D70]/30' : 'border-[#F2EDEA] dark:border-white/10'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isBrain ? 'bg-[#E85D70] text-white' : 'bg-[#FFF0F3] text-[#E85D70] dark:bg-[#E85D70]/15'}`}>
                    {isBrain ? <Sparkles size={18} /> : <FileText size={18} />}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); toggle(resource.id); }}
                    className={saved.includes(resource.id) ? 'text-[#E85D70]' : 'text-[#A8998E]'}
                    aria-label={saved.includes(resource.id) ? 'Remove saved resource' : 'Save resource'}
                  >
                    <Bookmark size={19} fill={saved.includes(resource.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {isBrain && <span className="rounded-full bg-[#FFF0F3] px-2.5 py-1 text-[10px] font-bold text-[#D94D62] dark:bg-[#E85D70]/10 dark:text-[#FF8EA0]">BAKER BRAIN</span>}
                  <span className="rounded-full bg-[#FAF8F6] px-2.5 py-1 text-[10px] font-bold text-[#7B6B62] dark:bg-white/5 dark:text-[#CFC4BE]">{resource.stage || 'Exam prep'}</span>
                  <span className="rounded-full bg-[#FAF8F6] px-2.5 py-1 text-[10px] font-bold text-[#7B6B62] dark:bg-white/5 dark:text-[#CFC4BE]">{resource.format || 'Resource'}</span>
                  <span className="rounded-full bg-[#FAF8F6] px-2.5 py-1 text-[10px] font-bold text-[#7B6B62] dark:bg-white/5 dark:text-[#CFC4BE]">{resource.time || 'Custom'}</span>
                </div>

                <h2 className="mt-4 font-serif text-xl font-semibold text-[#332C28] dark:text-white">{resource.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">{resource.desc || resource.summary}</p>
                <div className="mt-5 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-[#A8998E]">{resource.topic || 'Personalized'} • {resource.difficulty || 'Custom'}</span>
                  <span className="rounded-lg bg-[#FFF0F3] px-3 py-1.5 font-bold text-[#E85D70] dark:bg-[#E85D70]/10">{isBrain ? 'Open personalized resource' : 'Open resource'}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[140] overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <div className="mx-auto my-4 w-full max-w-3xl overflow-hidden rounded-[30px] border border-[#F2EDEA] bg-[#FFFCF9] shadow-2xl dark:border-white/10 dark:bg-[#171412] sm:my-8">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#F2EDEA] bg-white/95 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-[#211D1A]/95 sm:px-7">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#E85D70]">
                  {String(selected.id).startsWith('brain_') ? <Sparkles size={15} /> : <FileText size={15} />}
                  {selected.format || 'Resource'} • {selected.time || 'Custom'}
                </div>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-[#332C28] dark:text-white sm:text-3xl">{selected.title}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl p-2 text-[#A8998E] transition hover:bg-black/5 dark:hover:bg-white/5" aria-label="Close resource"><X size={21} /></button>
            </div>

            <div className="p-5 sm:p-7">
              {(selected.desc || selected.summary) && <p className="mb-6 text-sm leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">{selected.desc || selected.summary}</p>}

              <div className="space-y-4">
                {(selected.sections || []).map((section, index) => {
                  if (typeof section === 'string') {
                    return <div key={index} className="rounded-[20px] border border-[#F2EDEA] bg-white p-5 text-sm leading-7 text-[#5F5149] dark:border-white/10 dark:bg-[#211D1A] dark:text-[#CFC4BE]">{section}</div>;
                  }
                  return (
                    <section key={section.heading + index} className="rounded-[22px] border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A]">
                      <h3 className="font-serif text-xl font-semibold text-[#332C28] dark:text-white">{section.heading}</h3>
                      {section.body && <p className="mt-2 text-sm leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">{section.body}</p>}
                      {section.bullets && (
                        <ul className="mt-3 space-y-2">
                          {section.bullets.map((item) => <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]"><Check size={15} className="mt-1 shrink-0 text-[#5FA37E]" />{item}</li>)}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>

              {(!selected.sections || selected.sections.length === 0) && (
                <div className="rounded-2xl border border-[#F1D8B9] bg-[#FFF9F2] p-5 text-sm leading-7 text-[#8A5D36] dark:border-[#D4A574]/20 dark:bg-[#D4A574]/10 dark:text-[#E4BE8E]">
                  This personalized resource does not contain expanded sections yet. Open Baker Brain and ask it to regenerate this resource with a detailed lesson, examples, and practice items.
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 border-t border-[#F2EDEA] pt-5 dark:border-white/10 sm:flex-row">
                <button type="button" onClick={() => toggle(selected.id)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E2DAD5] bg-white px-4 py-3 text-sm font-bold text-[#5F5149] dark:border-white/10 dark:bg-white/5 dark:text-white">
                  <Bookmark size={16} fill={saved.includes(selected.id) ? 'currentColor' : 'none'} className={saved.includes(selected.id) ? 'text-[#E85D70]' : ''} />
                  {saved.includes(selected.id) ? 'Saved' : 'Save resource'}
                </button>
                <button type="button" onClick={() => void copySelected()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E2DAD5] bg-white px-4 py-3 text-sm font-bold text-[#5F5149] dark:border-white/10 dark:bg-white/5 dark:text-white">
                  {copied ? <Check size={16} className="text-[#5FA37E]" /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button type="button" onClick={() => downloadResource(selected)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#332C28] px-4 py-3 text-sm font-bold text-white dark:bg-[#E85D70]">
                  <Download size={16} /> Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
