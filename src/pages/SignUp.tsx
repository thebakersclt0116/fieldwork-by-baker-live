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
      setError('Free account creation is temporarily unavailable. Please try again.');
      return;
    }
    navigate(returnTo);
  };

  return (
    <div className="min-h-[calc(100dvh-72px)] bg-[#FFFCF9] px-4 py-10 flex items-center">
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] bg-white rounded-3xl overflow-hidden border border-[#F2EDEA] shadow-[0_24px_80px_rgba(51,44,40,0.08)]">
        <div className="p-8 lg:p-12 bg-gradient-to-br from-[#FFF5F7] via-[#FFFCF9] to-[#FBF3EB]">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#E85D70] mb-7"><Check size={14} /> Free forever</div>
          <h1 className="font-serif text-4xl lg:text-5xl font-semibold text-[#332C28] leading-tight mb-5">Start tracking your BCBA fieldwork for $0.</h1>
          <p className="text-[#6B5D54] text-lg leading-relaxed max-w-xl mb-8">No credit card. No 14-day clock. Log your hours for as long as you need, then pay only if you want premium automation or official-form export convenience.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white/80 p-5"><Clock size={21} className="text-[#E85D70] mb-3" /><h3 className="font-semibold text-[#332C28] mb-1">Unlimited manual logging</h3><p className="text-sm text-[#7B6B62]">Track sessions and keep your underlying records on Free.</p></div>
            <div className="rounded-2xl bg-white/80 p-5"><BarChart3 size={21} className="text-[#D4A574] mb-3" /><h3 className="font-semibold text-[#332C28] mb-1">Dashboard + compliance basics</h3><p className="text-sm text-[#7B6B62]">See progress, unrestricted ratio, and recorded-rule alerts.</p></div>
            <div className="rounded-2xl bg-white/80 p-5"><ShieldCheck size={21} className="text-[#5FA37E] mb-3" /><h3 className="font-semibold text-[#332C28] mb-1">Your records remain visible</h3><p className="text-sm text-[#7B6B62]">Upgrading gates premium tools—not access to the data you entered.</p></div>
            <div className="rounded-2xl bg-[#332C28] p-5 text-white"><ArrowRight size={21} className="text-[#D4A574] mb-3" /><h3 className="font-semibold mb-1">Upgrade when it matters</h3><p className="text-sm text-white/70">$19 Export Pass, $12 Individual, or $24 Professional.</p></div>
          </div>
        </div>

        <div className="p-8 lg:p-12 flex items-center">
          <form onSubmit={submit} className="w-full max-w-md mx-auto">
            <h2 className="font-serif text-3xl font-semibold text-[#332C28] mb-2">Create your Free account</h2>
            <p className="text-sm text-[#A8998E] mb-7">Start tracking now. No payment information requested.</p>

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

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl disabled:opacity-50">{loading ? 'Creating Free account…' : 'Start Tracking Free'}{!loading && <ArrowRight size={16} />}</button>
            <p className="text-center text-sm text-[#A8998E] mt-5">Already have authorized beta access? <Link to="/login" className="text-[#E85D70] font-medium hover:underline">Sign in</Link></p>
          </form>
        </div>
      </div>
    </div>
  );
}
