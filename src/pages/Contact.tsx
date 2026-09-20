import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Bug, Building2, Lightbulb, Mail, MessageSquare } from 'lucide-react';

const recipients = {
  'General Question': 'support@fieldworkbybaker.com',
  'Account Support': 'support@fieldworkbybaker.com',
  'Sales / Enterprise': 'sales@fieldworkbybaker.com',
  'Feature Request': 'feedback@fieldworkbybaker.com',
  'Bug Report': 'feedback@fieldworkbybaker.com',
  'Other': 'support@fieldworkbybaker.com',
} as const;

type Topic = keyof typeof recipients;

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<Topic>('General Question');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');

  const send = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !/^\\S+@\\S+\\.\\S+$/.test(email.trim()) || message.trim().length < 5) {
      setStatus('Enter your name, a valid email, and a short message.');
      return;
    }
    const recipient = recipients[topic];
    const subject = '[Fieldwork by Baker] ' + topic;
    const body = [
      'Name: ' + name.trim(),
      'Email: ' + email.trim(),
      'Topic: ' + topic,
      '',
      message.trim(),
    ].join('\\n');
    setStatus('Opening an email draft to ' + recipient + '.');
    window.location.href = 'mailto:' + recipient + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  };

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] px-4 py-12 dark:bg-[#171412]">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <div className="flex items-center gap-2 text-sm font-bold text-[#E85D70]"><MessageSquare size={17} /> Contact Fieldwork by Baker</div>
          <h1 className="mt-3 font-serif text-5xl font-semibold leading-tight text-[#332C28] dark:text-white">Questions, bugs, ideas, or enterprise needs—send them somewhere real.</h1>
          <p className="mt-4 text-lg leading-8 text-[#6B5D54] dark:text-[#CFC4BE]">The current beta uses email-based support so requests do not disappear into a decorative form. Choose a topic and your device will open a pre-addressed email draft.</p>
        </header>

        <div className="mt-9 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <aside className="space-y-3">
            <ContactCard icon={Mail} title="General & account support" email="support@fieldworkbybaker.com" />
            <ContactCard icon={Building2} title="Sales & enterprise" email="sales@fieldworkbybaker.com" />
            <ContactCard icon={Lightbulb} title="Ideas & feature requests" email="feedback@fieldworkbybaker.com" />
            <div className="rounded-[24px] border border-[#F0D5DA] bg-[#FFF7F8] p-5 dark:border-[#E85D70]/20 dark:bg-[#E85D70]/10">
              <div className="flex items-center gap-2 text-sm font-bold text-[#D94D62] dark:text-[#FF8EA0]"><Bug size={16} /> Reporting a bug?</div>
              <p className="mt-2 text-xs leading-6 text-[#7B6B62] dark:text-[#CFC4BE]">Include what you clicked, what you expected, what happened instead, and a screenshot if helpful. Do not include client-identifying or protected health information.</p>
            </div>
          </aside>

          <form onSubmit={send} className="rounded-[30px] border border-[#F2EDEA] bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#211D1A] sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className="field-input" placeholder="Your name" /></Field>
              <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field-input" placeholder="you@example.com" /></Field>
            </div>
            <div className="mt-4"><Field label="Topic"><select value={topic} onChange={(e) => setTopic(e.target.value as Topic)} className="field-input bg-white dark:bg-[#171412]">{Object.keys(recipients).map((item) => <option key={item} value={item}>{item}</option>)}</select></Field></div>
            <div className="mt-4"><Field label="Message"><textarea rows={7} value={message} onChange={(e) => setMessage(e.target.value)} className="field-input resize-none" placeholder="How can we help?" /></Field></div>
            {status && <div className="mt-4 rounded-xl bg-[#FAF8F6] px-4 py-3 text-sm text-[#6B5D54] dark:bg-white/5 dark:text-[#CFC4BE]">{status}</div>}
            <button type="submit" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E85D70] px-5 py-3.5 text-sm font-bold text-white">Create email request <ArrowRight size={16} /></button>
            <p className="mt-3 text-center text-xs text-[#A8998E]">If your device does not open a mail app, copy the relevant address from the left.</p>
          </form>
        </div>

        <div className="mt-10 text-center">
          <Link to="/faq" className="text-sm font-semibold text-[#E85D70] hover:underline">Check the FAQ first →</Link>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-[#5F5149] dark:text-[#E7DED9]">{label}<div className="mt-2">{children}</div></label>;
}

function ContactCard({ icon: Icon, title, email }: { icon: typeof Mail; title: string; email: string }) {
  return (
    <a href={'mailto:' + email} className="flex items-center gap-4 rounded-[24px] border border-[#F2EDEA] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#F0C0CA] dark:border-white/10 dark:bg-[#211D1A]">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0F3] text-[#E85D70] dark:bg-[#E85D70]/15"><Icon size={20} /></div>
      <div><div className="font-semibold text-[#332C28] dark:text-white">{title}</div><div className="mt-1 text-sm text-[#A8998E]">{email}</div></div>
    </a>
  );
}
