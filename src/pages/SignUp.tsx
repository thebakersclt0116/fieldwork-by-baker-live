import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight, BarChart3, Check, Clock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { registerFree } = useAuth();
  const params = new URLSearchParams(location.search);
  const requestedReturn = params.get('return');
  const returnTo = requestedReturn && requestedReturn.startsWith('/') && !requestedReturn.startsWith('//') ? requestedReturn : '/dashboard';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!firstName.trim() || !lastName.trim()) return setError('Enter your first and last name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Use a password with at least 8 characters.');
    if (!agreed) return setError('Please agree to the Terms and Privacy Policy.');

    setLoading(true);
    const success = await registerFree(name, email, password);
    setLoading(false);
    if (!success) {
      setError('Trial account creation is temporarily unavailable. Please try again.');
      return;
    }
    navigate(returnTo);
  };

  return (
    <div className="min-h-[calc(100dvh-72px)] bg-[#FFFCF9] px-4 py-10 flex items-center">
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] bg-white rounded-3xl overflow-hidden border border-[#F2EDEA] shadow-[0_24px_80px_rgba(51,44,40,0.08)]">
        <div className="p-8 lg:p-12 bg-gradient-to-br from-[#FFF5F7] via-[#FFFCF9] to-[#FBF3EB]">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#E85D70] mb-7"><Check size={14} /> 3-day full-access trial</div>
          <h1 className="font-serif text-4xl lg:text-5xl font-semibold text-[#332C28] leading-tight mb-5">Try the complete BCBA workspace free for 3 days.</h1>
          <p className="text-[#6B5D54] text-lg leading-relaxed max-w-xl mb-8">Use the actual product for 3 days: fieldwork tracking, Baker Brain, Exam Lab, resources, import tools, and supervisor workflows. Then choose Individual or Professional.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white/80 p-5"><Clock size={21} className="text-[#E85D70] mb-3" /><h3 className="font-semibold text-[#332C28] mb-1">Full fieldwork workspace</h3><p className="text-sm text-[#7B6B62]">Log real sessions with start/end times, decimals, categories, supervisors, and organizations.</p></div>
            <div className="rounded-2xl bg-white/80 p-5"><BarChart3 size={21} className="text-[#D4A574] mb-3" /><h3 className="font-semibold text-[#332C28] mb-1">Baker Brain + Exam Lab</h3><p className="text-sm text-[#7B6B62]">Use the BCBA AI, full mock exam, and personalized weak-area plan during your trial.</p></div>
            <div className="rounded-2xl bg-white/80 p-5"><ShieldCheck size={21} className="text-[#5FA37E] mb-3" /><h3 className="font-semibold text-[#332C28] mb-1">Supervisor workflow</h3><p className="text-sm text-[#7B6B62]">Try supervisor review, revision, and re-approval workflows before choosing a plan.</p></div>
            <div className="rounded-2xl bg-[#332C28] p-5 text-white"><ArrowRight size={21} className="text-[#D4A574] mb-3" /><h3 className="font-semibold mb-1">Pick your plan after day 3</h3><p className="text-sm text-white/70">$16.99 Individual or $34.99 Professional after the 3-day trial.</p></div>
          </div>
        </div>

        <div className="p-8 lg:p-12 flex items-center">
          <form onSubmit={submit} className="w-full max-w-md mx-auto">
            <h2 className="font-serif text-3xl font-semibold text-[#332C28] mb-2">Create your trial account</h2>
            <p className="text-sm text-[#A8998E] mb-7">Your 3-day full-access trial starts when this account is created.</p>

            {error && <div className="mb-5 rounded-xl bg-[#FFF5F7] border border-[#FFC1CC] px-4 py-3 text-sm text-[#C9445A]">{error}</div>}

            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="text-sm font-medium text-[#4D423C]">First name<Input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="mt-2 h-11 rounded-xl" placeholder="Emily" /></label>
              <label className="text-sm font-medium text-[#4D423C]">Last name<Input value={lastName} onChange={(event) => setLastName(event.target.value)} className="mt-2 h-11 rounded-xl" placeholder="Ayala" /></label>
            </div>
            <label className="block text-sm font-medium text-[#4D423C] mb-4">Email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 rounded-xl" placeholder="you@example.com" /></label>
            <label className="block text-sm font-medium text-[#4D423C] mb-4">Password
              <div className="relative mt-2"><Input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-xl pr-10" placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8998E]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            </label>

            <label className="flex items-start gap-3 text-sm text-[#6B5D54] mb-6"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1" /><span>I agree to the <Link to="/terms" className="font-semibold text-[#E85D70] hover:underline">Terms of Service</Link> and <Link to="/privacy" className="font-semibold text-[#E85D70] hover:underline">Privacy Policy</Link>.</span></label>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl disabled:opacity-50">{loading ? 'Starting your trial…' : 'Start 3-Day Free Trial'}{!loading && <ArrowRight size={16} />}</button>
            <p className="text-center text-sm text-[#A8998E] mt-5">Already have authorized beta access? <Link to="/login" className="text-[#E85D70] font-medium hover:underline">Sign in</Link></p>
          </form>
        </div>
      </div>
    </div>
  );
}
