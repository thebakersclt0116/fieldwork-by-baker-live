import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight, Crown, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const params = new URLSearchParams(location.search);
  const returnTo = safeReturnPath(params.get('return'));
  const sessionRefresh = params.get('reason') === 'session-refresh';
  const [email, setEmail] = useState(() => {
    try { return window.sessionStorage.getItem('bakerRefreshEmail') || ''; } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your authorized beta email and password.');
      return;
    }

    setIsLoggingIn(true);
    const success = await login(email, password);
    setIsLoggingIn(false);
    if (!success) {
      setError('Access denied. This private beta is limited to authorized Baker accounts.');
      return;
    }

    try {
      window.sessionStorage.removeItem('bakerRefreshEmail');
      window.sessionStorage.removeItem('bakerReturnAfterLogin');
    } catch {
      // Navigation still proceeds when storage is unavailable.
    }
    navigate(returnTo, { replace: true });
  };

  return (
    <div className="min-h-[calc(100dvh-72px)] bg-[#FFFCF9] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-white rounded-3xl border border-[#F2EDEA] overflow-hidden shadow-[0_24px_80px_rgba(51,44,40,0.08)]">
        <div className="p-8 lg:p-12 bg-gradient-to-br from-[#FFF5F7] via-[#FFFCF9] to-[#FBF3EB] flex flex-col justify-between min-h-[420px]">
          <div>
            <Link to="/" className="inline-flex items-baseline gap-1 mb-12">
              <span className="font-serif text-2xl font-bold text-[#332C28]">Fieldwork</span>
              <span className="text-sm font-medium text-[#E85D70]">by Baker</span>
            </Link>
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#E85D70] shadow-sm mb-6">
              <Sparkles size={24} />
            </div>
            <h1 className="font-serif text-4xl font-semibold text-[#332C28] leading-tight mb-4">
              Baker AI private beta
            </h1>
            <p className="text-[#6B5D54] leading-relaxed max-w-md">
              Secure access for the platform owner, authorized paid users, Emily&apos;s beta account, and supervisors using a signed invite link.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#7B6B62] mt-10">
            <ShieldCheck size={17} className="text-[#5FA37E]" />
            Protected app routes require a server-issued session.
          </div>
        </div>

        <div className="p-8 lg:p-12 flex items-center">
          <div className="w-full max-w-sm mx-auto">
            <div className="flex items-center gap-2 mb-2 text-[#D4A574]">
              <Crown size={17} />
              <span className="text-xs uppercase tracking-[0.18em] font-semibold">Authorized access</span>
            </div>
            <h2 className="font-serif text-3xl font-semibold text-[#332C28] mb-2">Welcome back</h2>
            <p className="text-sm text-[#A8998E] mb-6">Sign in to your approved Fieldwork by Baker account.</p>

            {sessionRefresh && (
              <div className="mb-5 rounded-xl bg-[#F4F7FF] border border-[#CFD8F7] px-4 py-3 text-sm leading-relaxed text-[#4B5EA8]">
                <strong>Your Baker access is still active.</strong> We detected an older browser session and cleared it automatically. Sign in once and you&apos;ll return directly to Import with your full beta access restored.
              </div>
            )}

            {error && (
              <div className="mb-5 rounded-xl bg-[#FFF5F7] border border-[#FFC1CC] px-4 py-3 text-sm text-[#C9445A]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#4D423C] mb-2">Email</label>
                <div className="relative">
                  <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8998E]" />
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 pl-10 rounded-xl"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4D423C] mb-2">Password</label>
                <div className="relative">
                  <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8998E]" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 pl-10 pr-11 rounded-xl"
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#A8998E] hover:text-[#E85D70]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="btn-primary w-full py-3 rounded-xl disabled:opacity-60"
              >
                {isLoggingIn ? 'Refreshing secure access…' : sessionRefresh ? 'Refresh Access & Return to Import' : 'Sign In'}
                {!isLoggingIn && <ArrowRight size={16} />}
              </button>
            </form>

            <p className="mt-6 text-xs leading-relaxed text-[#A8998E] text-center">
              Supervisors do not sign in here. They use the private invite link issued by the supervisee or platform owner.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
