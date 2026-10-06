import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, MailCheck, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { refreshSession } from '@/hooks/useAuth';
import { requestPasswordRecovery, resetAccountPassword } from '@/lib/authClient';

export default function AccountRecovery() {
  const location = useLocation();
  const navigate = useNavigate();
  const resetting = location.pathname === '/reset-password';
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const invalidToken = resetting && (!token || Boolean(params.get('error')));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (resetting) {
      if (!token || invalidToken) return setError('Request a new password reset link to continue.');
      if (password.length < 12 || password.length > 128) return setError('Use a password between 12 and 128 characters.');
      if (password !== confirmation) return setError('The passwords do not match. Please enter them again.');
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter the email address for your Fieldwork account.');

    setLoading(true);
    try {
      if (resetting && token) {
        await resetAccountPassword(token, password);
        setPassword('');
        setConfirmation('');
        await refreshSession();
        navigate('/login?reset=success', { replace: true });
      } else {
        await requestPasswordRecovery(email);
        setSent(true);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'We could not complete your request. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[calc(100dvh-72px)] bg-[#FFFCF9] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-[#F2EDEA] bg-white p-8 sm:p-10 shadow-[0_24px_80px_rgba(51,44,40,0.08)]">
        <Link to="/" className="inline-flex items-baseline gap-1 mb-9"><span className="font-serif text-2xl font-bold text-[#332C28]">Fieldwork</span><span className="text-sm font-medium text-[#E85D70]">by Baker</span></Link>
        <div className="w-12 h-12 rounded-2xl bg-[#FFF5F7] flex items-center justify-center text-[#E85D70] mb-5">{sent ? <MailCheck size={24} /> : <KeyRound size={24} />}</div>
        <h1 className="font-serif text-3xl font-semibold text-[#332C28] mb-3">{sent ? 'Check your inbox' : invalidToken ? 'Request a new link' : resetting ? 'Choose a new password' : 'Recover your account'}</h1>
        <p className="text-sm text-[#6B5D54] leading-relaxed mb-6">
          {sent ? `If there is an account for ${email.trim()}, a password reset link will arrive shortly. Check your inbox and spam folder.` : invalidToken ? 'This password reset link is missing, invalid, or expired. You can request a fresh link using your account email.' : resetting ? 'Choose a unique password to restore access to your Fieldwork workspace.' : 'Enter the email you use for Fieldwork. We’ll send a link to reset your password. Existing beta members can use the same account email.'}
        </p>

        {error && <div className="mb-5 rounded-xl bg-[#FFF5F7] border border-[#FFC1CC] px-4 py-3 text-sm text-[#C9445A]" role="alert">{error}</div>}

        {invalidToken ? (
          <Link to="/forgot-password" className="btn-primary w-full py-3 rounded-xl">Request New Link <ArrowRight size={16} /></Link>
        ) : sent ? (
          <div role="status">
            <p className="text-sm text-[#7B6B62] mb-5">Use the newest email if you requested more than one link. Your fieldwork records are unaffected by a password reset.</p>
            <Link to="/login" className="btn-primary w-full py-3 rounded-xl">Return to Sign In <ArrowRight size={16} /></Link>
            <button type="button" className="mt-5 text-sm text-[#E85D70] hover:underline" onClick={() => { setSent(false); setError(''); }}>Try another email</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {resetting ? (
              <>
                <div>
                  <label htmlFor="recovery-password" className="block text-sm font-medium text-[#4D423C] mb-2">New password</label>
                  <div className="relative"><Input id="recovery-password" autoComplete="new-password" type={showPassword ? 'text' : 'password'} required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 pr-11 rounded-xl" aria-describedby="recovery-password-help" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8998E]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                  <p id="recovery-password-help" className="text-xs text-[#A8998E] mt-2">Use between 12 and 128 characters.</p>
                </div>
                <label className="block text-sm font-medium text-[#4D423C]">Confirm password<Input autoComplete="new-password" type={showPassword ? 'text' : 'password'} required minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-12 mt-2 rounded-xl" /></label>
              </>
            ) : (
              <label className="block text-sm font-medium text-[#4D423C]">Account email<Input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 mt-2 rounded-xl" placeholder="you@example.com" /></label>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl disabled:opacity-60">{loading ? 'Please wait…' : resetting ? 'Update Password' : 'Send Reset Link'}{!loading && <ArrowRight size={16} />}</button>
          </form>
        )}
        <div className="mt-7 pt-6 border-t border-[#F2EDEA]">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-[#7B6B62] hover:text-[#E85D70]"><ArrowLeft size={15} /> Back to sign in</Link>
          <p className="mt-4 flex items-start gap-2 text-xs text-[#A8998E]"><ShieldCheck size={15} className="text-[#5FA37E] shrink-0" /> Password recovery keeps your account and fieldwork records together.</p>
        </div>
      </div>
    </div>
  );
}
