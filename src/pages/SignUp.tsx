import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowRight, BarChart3, Check, Clock, Eye, EyeOff, MailCheck, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { safeReturnPath, sendVerificationEmail } from '@/lib/authClient';

export default function SignUp() {
  const location = useLocation();
  const { registerFree } = useAuth();
  const returnTo = safeReturnPath(new URLSearchParams(location.search).get('return'));
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(() => {
    try { return sessionStorage.getItem('bakerRefreshEmail') || ''; } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [resent, setResent] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!firstName.trim() || !lastName.trim()) return setError('Enter your first and last name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 12 || password.length > 128) return setError('Use a password between 12 and 128 characters.');
    if (!agreed) return setError('Please agree to the Terms and Privacy Policy.');

    setLoading(true);
    try {
      await registerFree(name, email, password, returnTo);
      setPassword('');
      setPendingVerification(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Account creation is temporarily unavailable. Please try again.');
    } finally { setLoading(false); }
  };

  const resend = async () => {
    setError('');
    setLoading(true);
    try {
      await sendVerificationEmail(email, returnTo);
      setResent(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'We could not request another email. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[calc(100dvh-72px)] bg-[#FFFCF9] px-4 py-10 flex items-center">
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] bg-white rounded-3xl overflow-hidden border border-[#F2EDEA] shadow-[0_24px_80px_rgba(51,44,40,0.08)]">
        <div className="p-8 lg:p-12 bg-gradient-to-br from-[#FFF5F7] via-[#FFFCF9] to-[#FBF3EB]">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#E85D70] mb-7"><Check size={14} /> 3-day full-access trial</div>
          <h1 className="font-serif text-4xl lg:text-5xl font-semibold text-[#332C28] leading-tight mb-5">Try the complete BCBA workspace free for 3 days.</h1>
          <p className="text-[#6B5D54] text-lg leading-relaxed max-w-xl mb-8">Track fieldwork, study with Baker Brain and Exam Lab, use import tools, and organize supervisor workflows. Then choose Individual or Professional.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white/80 p-5"><Clock size={21} className="text-[#E85D70] mb-3" /><h3 className="font-semibold text-[#332C28] mb-1">Your fieldwork workspace</h3><p className="text-sm text-[#7B6B62]">Log sessions with start and end times, categories, supervisors, and organizations.</p></div>
            <div className="rounded-2xl bg-white/80 p-5"><BarChart3 size={21} className="text-[#D4A574] mb-3" /><h3 className="font-semibold text-[#332C28] mb-1">Baker Brain + Exam Lab</h3><p className="text-sm text-[#7B6B62]">Practice with BCBA study tools, mock exams, and your personalized weak-area plan.</p></div>
            <div className="rounded-2xl bg-white/80 p-5"><ShieldCheck size={21} className="text-[#5FA37E] mb-3" /><h3 className="font-semibold text-[#332C28] mb-1">Secure account access</h3><p className="text-sm text-[#7B6B62]">Verify your email and use account recovery whenever you need to reset your password.</p></div>
            <div className="rounded-2xl bg-[#332C28] p-5 text-white"><ArrowRight size={21} className="text-[#D4A574] mb-3" /><h3 className="font-semibold mb-1">Choose your plan</h3><p className="text-sm text-white/70">$16.99 Individual or $34.99 Professional after the 3-day trial.</p></div>
          </div>
        </div>

        <div className="p-8 lg:p-12 flex items-center">
          <div className="w-full max-w-md mx-auto">
            {pendingVerification ? (
              <div>
                <div className="w-14 h-14 rounded-2xl bg-[#F0F8F3] flex items-center justify-center text-[#5FA37E] mb-5"><MailCheck size={27} /></div>
                <h2 className="font-serif text-3xl font-semibold text-[#332C28] mb-3">Check your inbox</h2>
                <p className="text-sm text-[#6B5D54] leading-relaxed mb-4" role="status">If <strong className="break-all">{email.trim()}</strong> needs verification, you&apos;ll receive a link to confirm your email and open your workspace. Check your spam folder too.</p>
                <p className="text-sm text-[#7B6B62] leading-relaxed mb-6">Already have a verified account? Sign in or reset your password. Any fieldwork records saved in this browser will stay here while you set up access.</p>
                {error && <div className="mb-5 rounded-xl bg-[#FFF5F7] border border-[#FFC1CC] px-4 py-3 text-sm text-[#C9445A]" role="alert">{error}</div>}
                <Link to={`/login?return=${encodeURIComponent(returnTo)}`} className="btn-primary w-full py-3 rounded-xl">Return to sign in <ArrowRight size={16} /></Link>
                {resent ? <p className="mt-5 text-sm text-[#376B47]" role="status">Verification requested. Your email may take a few minutes to arrive.</p> : <button type="button" disabled={loading} onClick={() => { void resend(); }} className="mt-5 text-sm font-semibold text-[#E85D70] hover:underline disabled:opacity-50">{loading ? 'Requesting email…' : 'Resend verification email'}</button>}
                <div className="mt-4"><Link to="/forgot-password" className="text-sm text-[#7B6B62] hover:underline">Reset your password</Link></div>
                <button type="button" className="mt-4 text-xs text-[#A8998E] hover:underline" onClick={() => { setPendingVerification(false); setResent(false); setError(''); }}>Use a different email</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2 className="font-serif text-3xl font-semibold text-[#332C28] mb-2">Create your trial account</h2>
                <p className="text-sm text-[#A8998E] mb-7">Your trial starts when your account is created. Verify your email to open your workspace.</p>
                {error && <div className="mb-5 rounded-xl bg-[#FFF5F7] border border-[#FFC1CC] px-4 py-3 text-sm text-[#C9445A]" role="alert">{error}</div>}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <label className="text-sm font-medium text-[#4D423C]">First name<Input autoComplete="given-name" required maxLength={100} value={firstName} onChange={(event) => setFirstName(event.target.value)} className="mt-2 h-11 rounded-xl" placeholder="First name" /></label>
                  <label className="text-sm font-medium text-[#4D423C]">Last name<Input autoComplete="family-name" required maxLength={100} value={lastName} onChange={(event) => setLastName(event.target.value)} className="mt-2 h-11 rounded-xl" placeholder="Last name" /></label>
                </div>
                <label className="block text-sm font-medium text-[#4D423C] mb-4">Email<Input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 rounded-xl" placeholder="you@example.com" /></label>
                <label htmlFor="signup-password" className="block text-sm font-medium text-[#4D423C] mb-2">Password</label>
                <div className="relative mb-2"><Input id="signup-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-xl pr-10" placeholder="At least 12 characters" aria-describedby="signup-password-help" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8998E]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                <p id="signup-password-help" className="text-xs text-[#A8998E] mb-5">Use a unique password between 12 and 128 characters.</p>
                <label className="flex items-start gap-3 text-sm text-[#6B5D54] mb-6"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1" /><span>I agree to the <Link to="/terms" className="font-semibold text-[#E85D70] hover:underline">Terms of Service</Link> and <Link to="/privacy" className="font-semibold text-[#E85D70] hover:underline">Privacy Policy</Link>.</span></label>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl disabled:opacity-50">{loading ? 'Creating secure account…' : 'Create Account'}{!loading && <ArrowRight size={16} />}</button>
                <p className="text-center text-sm text-[#A8998E] mt-5">Already have an account or beta access? <Link to={`/login?return=${encodeURIComponent(returnTo)}`} className="text-[#E85D70] font-medium hover:underline">Sign in</Link></p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
