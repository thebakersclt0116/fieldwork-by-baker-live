import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle,
  BarChart3,
  Shield,
  Zap,
  Crown,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';

/* ------------------------------------------------------------------ */
/*  ANIMATION VARIANTS                                                 */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.12,
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ------------------------------------------------------------------ */
/*  STATS DATA                                                         */
/* ------------------------------------------------------------------ */

const stats = [
  { value: '10K+', label: 'BCBA Candidates Tracked', icon: <BarChart3 size={18} /> },
  { value: '99.9%', label: 'Uptime Guarantee', icon: <CheckCircle size={18} /> },
  { value: 'SOC 2', label: 'Security Certified', icon: <Shield size={18} /> },
];

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function Login() {
  const navigate = useNavigate();
  const { login, loginAsDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; auth?: string }>({});
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { email?: string; password?: string; auth?: string } = {};

    if (!email.trim()) newErrors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = 'Please enter a valid email.';

    if (!password) newErrors.password = 'Password is required.';

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      setIsLoggingIn(true);
      const success = login(email, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setErrors({ auth: 'Invalid email or password. Please try again.' });
        setIsLoggingIn(false);
      }
    }
  };

  const handleDemoLogin = () => {
    loginAsDemo();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-[100dvh] flex">
      {/* ============================================================ */}
      {/* LEFT PANEL — Brand & Stats                                    */}
      {/* ============================================================ */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, #FFF5F7 0%, #FFFCF9 40%, #FFF8F3 70%, #FBF3EB 100%)',
        }}
      >
        {/* Decorative glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute w-80 h-80 rounded-full opacity-20"
            style={{
              background:
                'radial-gradient(circle, rgba(233,93,112,0.2) 0%, transparent 70%)',
              top: '5%',
              right: '-10%',
            }}
          />
          <div
            className="absolute w-56 h-56 rounded-full opacity-15"
            style={{
              background:
                'radial-gradient(circle, rgba(212,165,116,0.25) 0%, transparent 70%)',
              bottom: '15%',
              left: '-8%',
            }}
          />
        </div>

        {/* Top: Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <Link to="/" className="flex items-baseline gap-1">
            <span className="font-serif text-2xl font-bold text-warm-gray-900">
              Fieldwork
            </span>
            <span className="text-sm font-medium text-rose-500">by Baker</span>
          </Link>
        </motion.div>

        {/* Center: Tagline + Stats */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="relative z-10"
        >
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="font-serif text-4xl font-semibold text-warm-gray-900 mb-4 leading-tight"
          >
            Track Smarter.
            <br />
            Stay Compliant.
          </motion.h2>

          <motion.p
            variants={fadeUp}
            custom={1}
            className="text-warm-gray-600 text-base mb-10 max-w-sm leading-relaxed"
          >
            The most beautiful, BACB 2027-compliant fieldwork tracker. Log
            hours, manage supervisors, and export official forms.
          </motion.p>

          {/* Stats */}
          <motion.div
            variants={fadeUp}
            custom={2}
            className="space-y-4"
          >
            {stats.map((stat, i) => (
              <div
                key={i}
                className="flex items-center gap-4 bg-white/60 backdrop-blur-sm rounded-xl px-5 py-3.5 max-w-xs"
              >
                <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                  {stat.icon}
                </div>
                <div>
                  <div className="text-lg font-semibold text-warm-gray-800 leading-tight">
                    {stat.value}
                  </div>
                  <div className="text-xs text-warm-gray-500">{stat.label}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Bottom: testimonial */}
        <motion.blockquote
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="relative z-10 text-sm text-warm-gray-600 leading-relaxed max-w-sm"
        >
          &ldquo;Fieldwork by Baker made tracking my hours effortless. The form
          export alone saved me hours every month.&rdquo;
          <footer className="mt-2 text-warm-gray-500">
            — Dr. Emily R., BCBA
          </footer>
        </motion.blockquote>
      </div>

      {/* ============================================================ */}
      {/* RIGHT PANEL — Login Form                                      */}
      {/* ============================================================ */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-12 lg:px-12">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <motion.div variants={fadeUp} custom={0} className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-baseline gap-1">
              <span className="font-serif text-xl font-bold text-warm-gray-900">
                Fieldwork
              </span>
              <span className="text-xs font-medium text-rose-500">by Baker</span>
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div variants={fadeUp} custom={1} className="mb-8">
            <h1 className="font-serif text-2xl font-semibold text-warm-gray-900 mb-1">
              Welcome Back
            </h1>
            <p className="text-sm text-warm-gray-400">
              Log in to your Fieldwork by Baker account
            </p>
          </motion.div>

          {/* Auth error */}
          {errors.auth && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl bg-error-light border border-error/20 text-error text-sm"
            >
              {errors.auth}
            </motion.div>
          )}

          {/* Owner Access Badge */}
          <motion.div
            variants={fadeUp}
            custom={1.5}
            className="mb-6 p-4 rounded-xl bg-[#FBF3EB] border border-[#D4A574]/30"
          >
            <div className="flex items-center gap-2 mb-1">
              <Crown size={16} className="text-[#D4A574]" />
              <span className="text-sm font-semibold text-[#8C7A70]">Owner Access</span>
            </div>
            <p className="text-xs text-[#A8998E]">
              Use your owner credentials for full admin access to all features and data.
            </p>
          </motion.div>

          {/* Form */}
          <motion.form
            variants={fadeUp}
            custom={2}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-warm-gray-400 pointer-events-none"
                />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((p) => ({ ...p, email: undefined, auth: undefined }));
                  }}
                  placeholder="your@email.com"
                  className={`h-12 pl-11 rounded-xl ${
                    errors.email ? 'border-error focus-visible:ring-error/20' : ''
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-error mt-1">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-warm-gray-400 pointer-events-none"
                />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((p) => ({ ...p, password: undefined, auth: undefined }));
                  }}
                  placeholder="Your password"
                  className={`h-12 pl-11 pr-10 rounded-xl ${
                    errors.password ? 'border-error focus-visible:ring-error/20' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-gray-400 hover:text-warm-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-error mt-1">{errors.password}</p>
              )}
            </div>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(v) => setRememberMe(!!v)}
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-warm-gray-500 cursor-pointer"
                >
                  Keep me logged in
                </label>
              </div>
              <Link
                to="/faq"
                className="text-sm text-rose-500 font-medium hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="btn-primary w-full py-3 rounded-xl disabled:opacity-60"
            >
              {isLoggingIn ? 'Signing in...' : 'Sign In'}
              <ArrowRight size={16} />
            </button>
          </motion.form>

          {/* Divider */}
          <motion.div
            variants={fadeUp}
            custom={3}
            className="relative my-6"
          >
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-warm-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-4 text-warm-gray-400">
                Or continue with
              </span>
            </div>
          </motion.div>

          {/* Social login */}
          <motion.div variants={fadeUp} custom={4} className="space-y-3">
            {/* Apple Sign-In */}
            <button className="w-full h-11 bg-black text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <svg
                width="16"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M17.72 9.73c-.04-1.54.63-2.71 1.96-3.57-.76-1.09-1.9-1.69-3.4-1.79-1.42-.1-2.99.84-3.56.84-.6 0-2.01-.8-3.14-.8C6.32 4.47 3.8 6.43 3.8 9.87c0 1.02.19 2.08.57 3.17.51 1.49 2.35 5.13 4.27 5.07 1.02-.02 1.74-.73 3.07-.73 1.29 0 1.94.73 3.08.7 1.27-.02 2.11-1.15 2.89-2.45.72-1.05 1.01-2.06 1.03-2.11-.02-.01-1.98-.76-1.99-3.79zM15.25 3.1c.74-.89 1.24-2.13 1.1-3.36-1.07.04-2.37.71-3.14 1.6-.68.79-1.28 2.05-1.12 3.26 1.19.09 2.4-.6 3.16-1.5z" />
              </svg>
              Sign in with Apple
            </button>

            {/* Google Sign-In */}
            <button className="w-full h-11 bg-white text-warm-gray-700 border border-warm-gray-200 rounded-lg text-sm font-semibold hover:bg-warm-gray-50 transition-colors flex items-center justify-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>
          </motion.div>

          {/* Demo login */}
          <motion.div variants={fadeUp} custom={5} className="mt-6">
            <button
              onClick={handleDemoLogin}
              className="w-full h-11 rounded-xl text-sm font-semibold border-2 border-dashed border-rose-300 text-rose-500 hover:bg-rose-50 hover:border-rose-400 transition-all flex items-center justify-center gap-2"
            >
              <Zap size={16} />
              Try Demo Mode — No Account Needed
            </button>
            <p className="text-center text-xs text-warm-gray-400 mt-2">
              Experience the full dashboard with sample data instantly
            </p>
          </motion.div>

          {/* Sign up prompt */}
          <motion.p
            variants={fadeUp}
            custom={6}
            className="text-center text-sm text-warm-gray-400 mt-6"
          >
            Don&apos;t have an account?{' '}
            <Link
              to="/signup"
              className="text-rose-500 font-medium hover:underline"
            >
              Sign up
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
