import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight, Check, Eye, EyeOff, Mail, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { accountRequest } from '@/lib/managedSession';
import PublicLandingMeasurement from '@/components/PublicLandingMeasurement';
import { accountEntryPath, safeReturnPath } from '@/lib/returnPath';
import { withAcquisitionQuery } from '@/lib/acquisitionFunnel';

function verificationCooldownEndsAt() {
  return Date.now() + 60000;
}

export default function SignUp() {
  const navigate = useNavigate(), location = useLocation();
  const { registerFree } = useAuth();
  const requested = new URLSearchParams(location.search).get('return');
  const returnTo = safeReturnPath(requested, '/upgrade');
  const publicLink = (path: string) => withAcquisitionQuery(path, location.search);
  const [firstName, setFirstName] = useState(''), [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false), [agreed, setAgreed] = useState(false);
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [verificationSent, setVerificationSent] = useState(false);
  const [resending, setResending] = useState(false), [resendNotice, setResendNotice] = useState(''), [resendAfter, setResendAfter] = useState(0);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (loading || verificationSent) return; setError('');
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!firstName.trim() || !lastName.trim()) return setError('Enter your first and last name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 8 || password.length > 1024) return setError('Use a password with 8–1,024 characters.');
    if (!agreed) return setError('Please agree to the Terms and Privacy Policy.');
    setLoading(true);
    try {
      const success = await registerFree(name, email, password);
      if (success === 'verify-email') { setPassword(''); setVerificationSent(true); setResendAfter(verificationCooldownEndsAt()); return; }
      if (!success) { setError('We could not create the account. Check your details, or sign in if you already have an account.'); return; }
      navigate(returnTo);
    } catch { setError('Account creation could not finish. Your information has not been cleared; please try again.'); }
    finally { setLoading(false); }
  };
  const resend = async () => {
    if (Date.now() < resendAfter) { setResendNotice('Please wait one minute before requesting another email.'); return; }
    setResending(true); setResendNotice('');
    try { const { response } = await accountRequest({ action: 'resend-verification', email }); if (!response.ok) throw new Error(); setResendNotice('If this account is awaiting confirmation, another verification email is on its way. Check spam too.'); setResendAfter(verificationCooldownEndsAt()); }
    catch { setResendNotice('The email could not be resent just now. Wait a moment, then try again.'); }
    finally { setResending(false); }
  };
  return (
    <div className="signup-page min-h-[calc(100dvh-72px)] bg-[#FFFCF9] px-4 py-6 text-[#332C28] dark:bg-[#171412] dark:text-white sm:py-10">
      <PublicLandingMeasurement path="/signup" />
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 max-w-3xl">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-[#D94D62] dark:text-[#FF8EA0]">For BCBA fieldwork candidates</div>
          <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-5xl">Track your fieldwork hours.<br className="hidden sm:block" /> Practice for your BCBA exam.</h1>
          <p className="mt-3 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">Log your sessions, review monthly progress and use a full-length practice simulation in one workspace. Individual membership is <strong>$16.99/month</strong>. Available in your mobile browser today.</p>
          <p className="mt-3 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]"><Link to={publicLink('/demo')} className="font-semibold text-[#D94D62] underline dark:text-[#FF8EA0]">Explore the free demo</Link> with fictional fieldwork records before creating an account. Saving real hours and using Exam Prep require a paid membership.</p>
        </header>
        <div className="grid items-start gap-5 lg:grid-cols-[.95fr_1.05fr]">
          <section aria-label="Create your Fieldwork account" className="rounded-3xl border border-[#F2EDEA] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#211D1A] sm:p-8">
            {verificationSent ? <div>
              <Mail size={28} className="text-[#E85D70]" />
              <h2 className="mt-3 font-serif text-2xl font-semibold">Check your email to continue.</h2>
              <p role="status" className="mt-3 break-words text-sm leading-6">We requested a verification email for <strong>{email}</strong>. Open the link to confirm your address, then sign in and choose your membership.</p>
              <p className="mt-3 text-sm text-[#6B5D54] dark:text-[#CFC4BE]">No payment has been taken. Check your spam or promotions folder if the message is missing.</p>
              <Link to={publicLink(accountEntryPath('/login', returnTo))} className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#E85D70] px-4 py-3 font-semibold text-white">I verified my email — sign in <ArrowRight size={16} /></Link>
              <button type="button" disabled={resending} onClick={() => void resend()} className="mt-4 min-h-11 text-sm font-semibold underline disabled:opacity-50">{resending ? 'Requesting email…' : 'Resend verification email'}</button>
              {resendNotice && <p role="status" className="mt-2 text-sm leading-6">{resendNotice}</p>}
              <p className="mt-4 text-xs leading-5 text-[#6B5D54] dark:text-[#CFC4BE]">Wrong address? <button type="button" onClick={() => { setVerificationSent(false); setResendNotice(''); }} className="font-semibold underline">Correct your email</button>.</p>
            </div> : <form onSubmit={submit}>
              <h2 className="font-serif text-2xl font-semibold">Create your account</h2>
              <p className="mb-5 mt-1 text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Create account → verify email → choose membership. No card required on this form.</p>
              {error && <div role="alert" className="mb-4 rounded-xl border border-[#E85D70]/40 bg-[#FFF5F7] p-3 text-sm text-[#A42F45] dark:bg-[#E85D70]/10 dark:text-[#FFAFBC]">{error}</div>}
              <div className="mb-4 grid grid-cols-2 gap-3">
                <label className="text-sm font-medium" htmlFor="signup-first">First name<Input id="signup-first" name="given-name" autoComplete="given-name" required maxLength={60} value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-1.5 h-11 rounded-xl" /></label>
                <label className="text-sm font-medium" htmlFor="signup-last">Last name<Input id="signup-last" name="family-name" autoComplete="family-name" required maxLength={60} value={lastName} onChange={e => setLastName(e.target.value)} className="mt-1.5 h-11 rounded-xl" /></label>
              </div>
              <label className="mb-4 block text-sm font-medium" htmlFor="signup-email">Email<Input id="signup-email" name="email" autoComplete="email" inputMode="email" type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 h-11 rounded-xl" placeholder="you@example.com" /></label>
              <label className="block text-sm font-medium" htmlFor="signup-password">Password</label>
              <div className="relative mt-1.5"><Input id="signup-password" name="new-password" autoComplete="new-password" required minLength={8} maxLength={1024} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="h-11 rounded-xl pr-12" placeholder="At least 8 characters" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#A8998E]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
              <label className="my-5 flex items-start gap-3 text-sm leading-6"><input type="checkbox" required checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" /><span>I agree to the <Link to={publicLink('/terms')} className="font-semibold underline">Terms</Link> and <Link to={publicLink('/privacy')} className="font-semibold underline">Privacy Policy</Link>.</span></label>
              <button disabled={loading} type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#E85D70] px-4 py-3 font-bold text-white disabled:opacity-50">{loading ? 'Creating your account…' : 'Create account'}{!loading && <ArrowRight size={17} />}</button>
              <p className="mt-3 text-xs leading-5 text-[#6B5D54] dark:text-[#CFC4BE]">Account creation is free. Saving real hours, importing records and using member tools require a paid plan. Individual $16.99/month; Professional $34.99/month. Professional Annual $349/year.</p>
              <p className="mt-4 text-center text-sm">Already have an account? <Link to={publicLink(accountEntryPath('/login', returnTo))} className="font-semibold text-[#D94D62] underline dark:text-[#FF8EA0]">Sign in</Link></p>
            </form>}
          </section>
          <aside className="space-y-4">
            <section className="rounded-3xl border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A] sm:p-7">
              <div className="flex items-center gap-2 text-sm font-bold text-[#D94D62] dark:text-[#FF8EA0]"><ShieldCheck size={18} /> Included with Individual membership</div>
              <h2 className="mt-3 font-serif text-2xl font-semibold">Your fieldwork and exam prep, together.</h2>
              <ul className="mt-4 space-y-3 text-sm">{[
                'Track dates, start and end times, restricted and unrestricted hours, and activity notes.',
                'Practice with a full-length 185-question, four-hour BCBA simulation, explanations and a weak-area study plan.',
                'Start with new entries or bring supported Ripley and CSV records with you.',
              ].map(item => <li className="flex gap-2 leading-6" key={item}><Check size={16} className="mt-1 shrink-0 text-[#5FA37E]" />{item}</li>)}</ul>
              <p className="mt-4 text-xs leading-5 text-[#6B5D54] dark:text-[#CFC4BE]">Original, unofficial practice material. Fieldwork by Baker is not affiliated with or endorsed by the BACB and does not guarantee a passing score.</p>
            </section>
            <details className="rounded-3xl border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A] sm:p-7">
              <summary className="cursor-pointer font-semibold">Already have Ripley hours? See how import works.</summary>
              <p className="mt-3 text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">Import is optional. Save every page of each supported detailed Ripley month report, select the PDFs together, then review the entries and totals before confirming. Summary-only PDFs cannot supply missing session details.</p>
              <div className="mt-4 rounded-2xl bg-[#FAF8F6] p-4 dark:bg-white/5" aria-label="Fictional example of imported sessions">
                <div className="mb-3 text-xs font-bold text-[#6B5D54] dark:text-[#CFC4BE]">ILLUSTRATION · FICTIONAL RECORDS</div>
                <div className="rounded-xl border border-[#E2DAD5] bg-white p-3 text-sm dark:border-white/10 dark:bg-[#171412]">Detailed month.pdf <span className="float-right font-semibold">2 sessions</span></div>
                <div className="py-2 text-center text-lg text-[#E85D70]" aria-hidden="true">↓</div>
                <div className="space-y-2 text-sm">
                  <div className="rounded-xl border border-[#E2DAD5] bg-white p-3 dark:border-white/10 dark:bg-[#171412]"><strong>8:30–10:15 · 1.75 hours</strong><div className="mt-1 text-xs">Unrestricted · Example Clinic · Supervisor A</div><p className="mt-2 text-xs leading-5">Reviewed de-identified sample data and prepared program recommendations.</p></div>
                  <div className="rounded-xl border border-[#E2DAD5] bg-white p-3 dark:border-white/10 dark:bg-[#171412]"><strong>10:30–10:55 · 0.42 hours</strong><div className="mt-1 text-xs">Supervised · Individual · Supervisor A</div><p className="mt-2 text-xs leading-5">Discussed a fictional assessment scenario and recorded supervisor feedback.</p></div>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-[#6B5D54] dark:text-[#CFC4BE]">Keep your original documents and check imported entries. Organized records do not guarantee audit acceptance. Supervisor review and re-approval are included with Professional.</p>
            </details>
          </aside>
        </div>
      </div>
    </div>
  );
}
