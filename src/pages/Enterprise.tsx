import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Building2, CheckCircle2, FileDown, Mail, ShieldCheck, Upload, Users } from 'lucide-react';

export default function Enterprise() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [candidates, setCandidates] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');

  const requestDemo = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()) || !organization.trim()) {
      setStatus('Enter your name, work email, and organization.');
      return;
    }
    const subject = 'Fieldwork by Baker Enterprise demo request';
    const body = [
      'Name: ' + name.trim(),
      'Email: ' + email.trim(),
      'Organization: ' + organization.trim(),
      'Candidate count: ' + (candidates || 'Not specified'),
      '',
      message.trim() || 'I would like to discuss Fieldwork by Baker for my organization.',
    ].join('\n');
    setStatus('Opening a pre-addressed email to the Baker sales team.');
    window.location.href = 'mailto:sales@fieldworkbybaker.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  };

  const capabilities = [
    { icon: Users, title: 'Candidate & supervisor workflows', text: 'Organize fieldwork records by candidate, supervisor, organization, review status, and revision history.' },
    { icon: Upload, title: 'Migration support', text: 'Move supported fieldwork exports into Baker without asking candidates to rebuild every month by hand.' },
    { icon: FileDown, title: 'Documentation workflows', text: 'Centralize review and export workflows while keeping supervisors responsible for final professional verification.' },
    { icon: ShieldCheck, title: 'Privacy-first product design', text: 'Signed access, protected premium routes, and clear reminders not to enter unnecessary client-identifying information.' },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] dark:bg-[#171412]">
      <section className="relative overflow-hidden bg-[#1A1518] px-4 py-24 text-white sm:py-28">
        <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-[#E85D70]/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 h-96 w-96 rounded-full bg-[#D4A574]/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[#F4C895]"><Building2 size={14} /> Enterprise conversations now open</div>
            <h1 className="mt-5 max-w-3xl font-serif text-5xl font-semibold leading-tight sm:text-6xl">A cleaner fieldwork operating system for programs managing multiple candidates.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">Bring candidate tracking, supervisor review, imports, documentation, and compliance visibility into one workspace. Enterprise capabilities are scoped with each organization instead of pretending every integration is already turnkey.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#demo-request" className="inline-flex items-center gap-2 rounded-2xl bg-[#E85D70] px-6 py-3.5 text-sm font-bold text-white">Request a demo <ArrowRight size={16} /></a>
              <Link to="/contact" className="rounded-2xl border border-white/15 px-6 py-3.5 text-sm font-bold text-white/85">Contact sales</Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-4 text-xs text-white/55">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-[#8FD0AD]" /> Signed access controls</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-[#8FD0AD]" /> Supervisor review workflows</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-[#8FD0AD]" /> Integration scoping available</span>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/[.055] p-6 backdrop-blur-xl">
            <div className="text-xs font-bold uppercase tracking-[.18em] text-[#F4C895]">Production trust note</div>
            <h2 className="mt-2 font-serif text-2xl font-semibold">No placeholder compliance badges.</h2>
            <p className="mt-3 text-sm leading-7 text-white/65">We do not claim HIPAA compliance, SOC 2 certification, SSO availability, or other third-party certifications until those capabilities are formally established and documented. Security and integration requirements are reviewed during enterprise discovery.</p>
            <Link to="/security" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#FF91A0]">Read Security & Trust <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center"><div className="text-sm font-bold text-[#E85D70]">ENTERPRISE DIRECTION</div><h2 className="mt-2 font-serif text-4xl font-semibold text-[#332C28] dark:text-white">Start with workflows that are real today.</h2><p className="mt-3 text-[#6B5D54] dark:text-[#CFC4BE]">Then scope persistence, SSO, reporting, or custom integrations around the actual organization rather than advertising imaginary customer deployments.</p></div>
          <div className="mt-9 grid gap-4 md:grid-cols-2">
            {capabilities.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-[28px] border border-[#F2EDEA] bg-white p-6 dark:border-white/10 dark:bg-[#211D1A]"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0F3] text-[#E85D70] dark:bg-[#E85D70]/15"><Icon size={20} /></div><h3 className="mt-4 font-serif text-2xl font-semibold text-[#332C28] dark:text-white">{title}</h3><p className="mt-2 text-sm leading-7 text-[#6B5D54] dark:text-[#CFC4BE]">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section id="demo-request" className="bg-[#1A1518] px-4 py-20">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div className="text-white">
            <div className="text-sm font-bold text-[#F4C895]">REQUEST A DEMO</div>
            <h2 className="mt-2 font-serif text-4xl font-semibold">Tell us what your organization actually needs.</h2>
            <p className="mt-4 text-sm leading-7 text-white/60">Submitting this form opens a real email request to the Baker sales team. No decorative form, fake confirmation, or lost lead.</p>
            <a href="mailto:sales@fieldworkbybaker.com" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#FF91A0]"><Mail size={15} /> sales@fieldworkbybaker.com</a>
          </div>
          <form onSubmit={requestDemo} className="rounded-[28px] border border-white/10 bg-white/[.055] p-6 backdrop-blur-xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <DarkField label="Name *"><input value={name} onChange={(e) => setName(e.target.value)} className="field-input" placeholder="Your name" /></DarkField>
              <DarkField label="Work email *"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field-input" placeholder="work@organization.com" /></DarkField>
              <DarkField label="Organization *"><input value={organization} onChange={(e) => setOrganization(e.target.value)} className="field-input" placeholder="Organization name" /></DarkField>
              <DarkField label="Approx. candidates"><select value={candidates} onChange={(e) => setCandidates(e.target.value)} className="field-input bg-white dark:bg-[#171412]"><option value="">Select range</option><option>10–50</option><option>51–100</option><option>101–250</option><option>251–500</option><option>500+</option></select></DarkField>
            </div>
            <div className="mt-4"><DarkField label="What do you need?"><textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="field-input resize-none" placeholder="Tell us about your current workflow, systems, and goals." /></DarkField></div>
            {status && <div className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm text-white/75">{status}</div>}
            <button type="submit" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E85D70] px-5 py-3.5 text-sm font-bold text-white">Create demo request <ArrowRight size={16} /></button>
          </form>
        </div>
      </section>
    </div>
  );
}

function DarkField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-white/70">{label}<div className="mt-2">{children}</div></label>;
}
