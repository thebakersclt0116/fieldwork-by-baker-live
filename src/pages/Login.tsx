import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight, Crown, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { AccountRequestError, safeReturnPath, sendVerificationEmail } from '@/lib/authClient';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, logout, user, isLoading, isAuthenticated, sessionError } = useAuth();
  const params = new URLSearchParams(location.search);
  const returnTo = safeReturnPath(params.get('return'));
  const sessionRefresh = params.get('reason') === 'session-refresh';
  const signOutIncomplete = params.get('reason') === 'signout-incomplete';
  const emailVerified = params.get('verified') === '1';
  const verificationError = Boolean(params.get('error'));
  const passwordReset = params.get('reset') === 'success';
  const [email, setEmail] = useState(() => {
    try {
      const hint = window.sessionStorage.getItem('bakerRefreshEmail');
      const raw = localStorage.getItem('authUser');
      const oldProfile = raw ? JSON.parse(raw) as { email?: unknown } : null;
      return hint || (typeof oldProfile?.email === 'string' ? oldProfile.email : '');
    } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const legacyAccount = (() => {
    try { return localStorage.getItem('bakerSessionUpgradeRequired') === '1'; } catch { return false; }
  })();

  useEffect(() => {
    if (emailVerified && !verificationError && !isLoading && isAuthenticated) navigate(returnTo, { replace: true });
  }, [emailVerified, verificationError, isLoading, isAuthenticated, navigate, returnTo]);

  const resendVerification = async () => {
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter your email address to request a verification link.');
    setSendingVerification(true);
    try {
      await sendVerificationEmail(email, returnTo);
      setVerificationSent(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'We could not request a verification email. Please try again.');
    } finally { setSendingVerification(false); }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setVerificationRequired(false);
    setVerificationSent(false);
    if (!email.trim() || !password) {
      setError('Enter your account email and password.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const success = await login(email, password);
      if (!success) return;
      setPassword('');
      try {
        window.sessionStorage.removeItem('bakerRefreshEmail');
        window.sessionStorage.removeItem('bakerReturnAfterLogin');
      } catch { /* Navigation still proceeds when storage is unavailable. */ }
      navigate(returnTo, { replace: true });
    } catch (failure) {
      setVerificationRequired(failure instanceof AccountRequestError && failure.code === 'EMAIL_NOT_VERIFIED');
      setError(failure instanceof Error ? failure.message : 'We could not sign you in. Please try again.');
    } finally { setIsLoggingIn(false); }
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
              Your BCBA journey, connected
            </h1>
            <p className="text-[#6B5D54] leading-relaxed max-w-md">
              Sign in to track fieldwork, study with Baker Brain, prepare in Exam Lab, and collaborate with your supervisor.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#7B6B62] mt-10">
            <ShieldCheck size={17} className="text-[#5FA37E]" />
            Your workspace is protected with secure, server-verified access.
          </div>
        </div>

        <div className="p-8 lg:p-12 flex items-center">
          <div className="w-full max-w-sm mx-auto">
            <div className="flex items-center gap-2 mb-2 text-[#D4A574]">
              <Crown size={17} />
              <span className="text-xs uppercase tracking-[0.18em] font-semibold">Secure account access</span>
            </div>
            <h2 className="font-serif text-3xl font-semibold text-[#332C28] mb-2">Welcome back</h2>
            <p className="text-sm text-[#A8998E] mb-6">Sign in to your Fieldwork by Baker account.</p>

            {sessionRefresh && (
              <div className="mb-5 rounded-xl bg-[#F4F7FF] border border-[#CFD8F7] px-4 py-3 text-sm leading-relaxed text-[#4B5EA8]">
                <strong>Sign in to refresh your access.</strong> Your saved fieldwork records are still in this browser. After signing in, you&apos;ll return to your workspace.
              </div>
            )}

            {legacyAccount && !sessionRefresh && (
              <div className="mb-5 rounded-xl bg-[#F4F7FF] border border-[#CFD8F7] px-4 py-3 text-sm leading-relaxed text-[#4B5EA8]">
                Your older browser account needs secure account verification. If you haven&apos;t created a verified account, <Link to={`/signup?return=${encodeURIComponent(returnTo)}`} className="font-semibold underline">create one with the same email</Link>. Your saved fieldwork records stay in this browser. Existing beta members can sign in below.
              </div>
            )}

            {signOutIncomplete && (
              <div className="mb-5 rounded-xl bg-[#FFF8ED] border border-[#EAD4AC] px-4 py-3 text-sm text-[#7A5A27]" role="alert">
                The server could not confirm sign-out. Your session may still be active. <button type="button" onClick={() => { void logout(); }} className="font-semibold underline">Try signing out again</button>.
              </div>
            )}

            {(passwordReset || (emailVerified && !verificationError)) && (
              <div className="mb-5 rounded-xl bg-[#F0F8F3] border border-[#C4DEC9] px-4 py-3 text-sm text-[#376B47]" role="status">
                {passwordReset ? 'Your password has been updated. Sign in with your new password.' : isLoading ? 'Verifying your account…' : 'Your email is verified. Sign in to open your workspace.'}
              </div>
            )}

            {verificationError && (
              <div className="mb-5 rounded-xl bg-[#FFF8ED] border border-[#EAD4AC] px-4 py-3 text-sm text-[#7A5A27]" role="alert">
                That verification link is invalid or has expired. Enter your email below and request a new verification email.
              </div>
            )}

            {isAuthenticated && !signOutIncomplete && !emailVerified && (
              <div className="mb-5 rounded-xl bg-[#F0F8F3] border border-[#C4DEC9] px-4 py-3 text-sm text-[#376B47]">
                You&apos;re signed in as {user?.email}. <Link to={returnTo} className="font-semibold underline">Open your workspace</Link> or <button type="button" onClick={() => { void logout(); }} className="font-semibold underline">sign out</button>.
              </div>
            )}

            {error && (
              <div className="mb-5 rounded-xl bg-[#FFF5F7] border border-[#FFC1CC] px-4 py-3 text-sm text-[#C9445A]" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-[#4D423C] mb-2">Email</label>
                <div className="relative">
                  <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8998E]" />
                  <Input
                    id="login-email"
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
                <div className="flex justify-between items-center gap-3 mb-2">
                  <label htmlFor="login-password" className="block text-sm font-medium text-[#4D423C]">Password</label>
                  <Link to="/forgot-password" className="text-xs font-medium text-[#E85D70] hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8998E]" />
                  <Input
                    id="login-password"
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
                {isLoggingIn ? 'Signing in…' : sessionRefresh ? 'Refresh Access' : 'Sign In'}
                {!isLoggingIn && <ArrowRight size={16} />}
              </button>
            </form>

            {(verificationRequired || verificationError || verificationSent) && (
              <div className="mt-5 text-sm text-[#7B6B62]">
                {verificationSent ? <p role="status">If this account needs verification, an email will arrive shortly. Check your inbox and spam folder.</p> : (
                  <button type="button" disabled={sendingVerification} onClick={() => { void resendVerification(); }} className="font-semibold text-[#E85D70] hover:underline disabled:opacity-50">
                    {sendingVerification ? 'Requesting email…' : 'Resend verification email'}
                  </button>
                )}
              </div>
            )}

            {!error && sessionError && !isLoggingIn && <p className="mt-4 text-xs text-[#A8998E]" role="status">{sessionError}</p>}

            <p className="mt-6 text-xs leading-relaxed text-[#A8998E] text-center">
              Supervisors do not sign in here. They use the private invite link issued by the supervisee or platform owner.
            </p>
            <p className="mt-3 text-sm text-center text-[#7B6B62]">
              New to Baker? <Link to="/signup" className="font-semibold text-[#E85D70] hover:underline">Start your 3-day free trial</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
