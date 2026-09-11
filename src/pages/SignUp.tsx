import { useState, useCallback } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  UserCheck,
  Users,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type Role = 'supervisee' | 'supervisor' | 'orgAdmin' | '';

interface FormData {
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  heardAbout: string;
  // Supervisee fields
  fieldworkType: string;
  startDate: string;
  expectedCompletion: string;
  // Supervisor fields
  bacbaNumber: string;
  yearsCertified: string;
  trainingCompleted: boolean;
  // Org Admin fields
  orgName: string;
  numCandidates: string;
  orgPhone: string;
  // Plan
  plan: string;
  billingCycle: 'monthly' | 'annual';
  // Terms
  agreedToTerms: boolean;
}

/* ------------------------------------------------------------------ */
/*  ANIMATION                                                          */
/* ------------------------------------------------------------------ */

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  }),
};



/* ------------------------------------------------------------------ */
/*  PASSWORD STRENGTH                                                  */
/* ------------------------------------------------------------------ */

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-error' };
  if (score === 2) return { score, label: 'Fair', color: 'bg-warning' };
  if (score === 3) return { score, label: 'Good', color: 'bg-info' };
  return { score, label: 'Strong', color: 'bg-success' };
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                     */
/* ------------------------------------------------------------------ */

export default function SignUp() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const [form, setForm] = useState<FormData>({
    role: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    heardAbout: '',
    fieldworkType: '',
    startDate: '',
    expectedCompletion: '',
    bacbaNumber: '',
    yearsCertified: '',
    trainingCompleted: false,
    orgName: '',
    numCandidates: '',
    orgPhone: '',
    plan: '',
    billingCycle: 'monthly',
    agreedToTerms: false,
  });

  const update = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const goNext = () => {
    if (!validateStep()) return;
    setDirection(1);
    setStep((s) => Math.min(s + 1, 4));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  };

  /* ── validation ── */
  const validateStep = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (step === 1) {
      if (!form.role) newErrors.role = 'Please select a role to continue.';
    }

    if (step === 2) {
      if (!form.firstName.trim()) newErrors.firstName = 'First name is required.';
      if (!form.lastName.trim()) newErrors.lastName = 'Last name is required.';
      if (!form.email.trim()) newErrors.email = 'Email is required.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        newErrors.email = 'Please enter a valid email.';
      if (!form.password) newErrors.password = 'Password is required.';
      else if (form.password.length < 8)
        newErrors.password = 'Password must be at least 8 characters.';
      if (form.password !== form.confirmPassword)
        newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (step === 3) {
      if (form.role === 'supervisee') {
        if (!form.fieldworkType) newErrors.fieldworkType = 'Please select a fieldwork type.';
        if (!form.startDate) newErrors.startDate = 'Start date is required.';
      }
      if (form.role === 'supervisor') {
        if (!form.bacbaNumber.trim()) newErrors.bacbaNumber = 'BACB number is required.';
        if (!form.yearsCertified.trim()) newErrors.yearsCertified = 'Years certified is required.';
      }
      if (form.role === 'orgAdmin') {
        if (!form.orgName.trim()) newErrors.orgName = 'Organization name is required.';
        if (!form.numCandidates) newErrors.numCandidates = 'Please select expected user count.';
      }
    }

    if (step === 4) {
      if (!form.plan) newErrors.plan = 'Please select a plan.';
      if (!form.agreedToTerms) newErrors.agreedToTerms = 'You must agree to the terms.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const pwStrength = passwordStrength(form.password);
  const progressValue = step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100;

  /* ── step 1: role options ── */
  const roleOptions: {
    value: Role;
    label: string;
    description: string;
    icon: React.ReactNode;
    borderColor: string;
    bgSelected: string;
    borderSelected: string;
    iconColor: string;
  }[] = [
    {
      value: 'supervisee',
      label: 'BCBA Candidate',
      description: "I'm tracking my fieldwork hours toward BCBA certification.",
      icon: <Clock size={28} />,
      borderColor: 'border-transparent',
      bgSelected: 'bg-rose-50',
      borderSelected: 'border-rose-500',
      iconColor: 'text-rose-500',
    },
    {
      value: 'supervisor',
      label: 'BCBA Supervisor',
      description: "I'm supervising BCBA candidates and verifying their hours.",
      icon: <UserCheck size={28} />,
      borderColor: 'border-transparent',
      bgSelected: 'bg-[#EBF4FA]',
      borderSelected: 'border-[#6BA3D6]',
      iconColor: 'text-[#6BA3D6]',
    },
    {
      value: 'orgAdmin',
      label: 'Organization Admin',
      description: "I'm managing a team of candidates for my organization.",
      icon: <Users size={28} />,
      borderColor: 'border-transparent',
      bgSelected: 'bg-[#FBF3EB]',
      borderSelected: 'border-[#D4A574]',
      iconColor: 'text-[#D4A574]',
    },
  ];

  /* ── step 4: plans ── */
  const plans = [
    {
      id: 'individual',
      name: 'Individual',
      price: { monthly: 12, annual: 9 },
      description: 'Perfect for solo BCBA candidates.',
      features: ['Unlimited hour logging', '1 supervisor', 'Basic analytics', 'BACB form export'],
      cta: 'Get Started',
      popular: false,
    },
    {
      id: 'professional',
      name: 'Professional',
      price: { monthly: 24, annual: 19 },
      description: 'For serious candidates and supervisors.',
      features: [
        'Everything in Individual',
        'Unlimited supervisors',
        'Advanced analytics',
        'Priority support',
        'Custom reports',
      ],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: { monthly: 0, annual: 0 },
      description: 'For organizations managing multiple candidates.',
      features: [
        'Everything in Professional',
        'Organization dashboard',
        'Bulk user import',
        'API access',
        'Custom branding',
        'Dedicated support',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  /* ── step label ── */
  const stepTitle =
    step === 1
      ? "Let's Get Started"
      : step === 2
        ? 'Create Your Account'
        : step === 3
          ? 'Set Up Your Profile'
          : 'Choose Your Plan';

  const stepSubtitle =
    step === 1
      ? 'Which best describes you?'
      : step === 2
        ? 'Step 2 of 4'
        : step === 3
          ? 'Step 3 of 4'
          : 'Step 4 of 4';

  return (
    <div className="min-h-[100dvh] flex">
      {/* ============================================================ */}
      {/* LEFT PANEL — Visual                                           */}
      {/* ============================================================ */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, #FFF5F7 0%, #FFFCF9 40%, #FFF8F3 70%, #FBF3EB 100%)',
        }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute w-72 h-72 rounded-full opacity-20"
            style={{
              background: 'radial-gradient(circle, rgba(233,93,112,0.2) 0%, transparent 70%)',
              top: '10%',
              right: '-10%',
            }}
          />
          <div
            className="absolute w-48 h-48 rounded-full opacity-15"
            style={{
              background: 'radial-gradient(circle, rgba(212,165,116,0.25) 0%, transparent 70%)',
              bottom: '20%',
              left: '-5%',
            }}
          />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <Link to="/" className="flex items-baseline gap-1">
            <span className="font-serif text-2xl font-bold text-warm-gray-900">
              Fieldwork
            </span>
            <span className="text-sm font-medium text-rose-500">by Baker</span>
          </Link>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="font-serif text-3xl font-semibold text-warm-gray-900 mb-8"
          >
            Your BCBA journey starts here.
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-4 mb-12"
          >
            {[
              '14-day free trial, no credit card',
              'BACB 2027 compliant',
              'Cancel anytime',
            ].map((point, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                  <Check size={14} className="text-success" />
                </div>
                <span className="text-warm-gray-700 font-medium text-sm">
                  {point}
                </span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Testimonial */}
        <motion.blockquote
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="relative z-10 text-sm text-warm-gray-600 leading-relaxed max-w-sm"
        >
          &ldquo;This tracker changed my entire BCBA experience. Beautiful, easy,
          and the form export is a game-changer.&rdquo;
          <footer className="mt-2 text-warm-gray-500">
            — Sarah M., BCBA Candidate
          </footer>
        </motion.blockquote>
      </div>

      {/* ============================================================ */}
      {/* RIGHT PANEL — Form                                            */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12 lg:px-12 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-baseline gap-1">
              <span className="font-serif text-xl font-bold text-warm-gray-900">
                Fieldwork
              </span>
              <span className="text-xs font-medium text-rose-500">by Baker</span>
            </Link>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                    s < step
                      ? 'bg-success'
                      : s === step
                        ? 'bg-rose-500'
                        : 'bg-warm-gray-200'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-warm-gray-400">
              <span>
                Step {step} of 4
              </span>
              <span className="text-rose-500 font-medium">{progressValue}%</span>
            </div>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="font-serif text-2xl font-semibold text-warm-gray-900 mb-1">
              {stepTitle}
            </h1>
            <p className="text-sm text-warm-gray-400">{stepSubtitle}</p>
          </div>

          {/* Form steps */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="min-h-[360px]"
            >
              {/* ── STEP 1: Role Selection ── */}
              {step === 1 && (
                <div className="space-y-4">
                  {roleOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update('role', opt.value)}
                      className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200 ${
                        form.role === opt.value
                          ? `${opt.bgSelected} ${opt.borderSelected}`
                          : 'bg-cream-50 border-transparent hover:border-warm-gray-200'
                      }`}
                    >
                      <div className={`mt-0.5 ${opt.iconColor}`}>{opt.icon}</div>
                      <div>
                        <div className="font-semibold text-warm-gray-800 text-sm">
                          {opt.label}
                        </div>
                        <div className="text-xs text-warm-gray-400 mt-1 leading-relaxed">
                          {opt.description}
                        </div>
                      </div>
                    </button>
                  ))}
                  {errors.role && (
                    <p className="text-xs text-error mt-2">{errors.role}</p>
                  )}
                </div>
              )}

              {/* ── STEP 2: Account Info ── */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                        First Name
                      </label>
                      <Input
                        value={form.firstName}
                        onChange={(e) => update('firstName', e.target.value)}
                        placeholder="Jane"
                        className={`h-11 rounded-xl ${errors.firstName ? 'border-error focus-visible:ring-error/20' : ''}`}
                      />
                      {errors.firstName && (
                        <p className="text-xs text-error mt-1">{errors.firstName}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                        Last Name
                      </label>
                      <Input
                        value={form.lastName}
                        onChange={(e) => update('lastName', e.target.value)}
                        placeholder="Doe"
                        className={`h-11 rounded-xl ${errors.lastName ? 'border-error focus-visible:ring-error/20' : ''}`}
                      />
                      {errors.lastName && (
                        <p className="text-xs text-error mt-1">{errors.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      placeholder="jane@email.com"
                      className={`h-11 rounded-xl ${errors.email ? 'border-error focus-visible:ring-error/20' : ''}`}
                    />
                    {errors.email && (
                      <p className="text-xs text-error mt-1">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => update('password', e.target.value)}
                        placeholder="At least 8 characters"
                        className={`h-11 rounded-xl pr-10 ${errors.password ? 'border-error focus-visible:ring-error/20' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-gray-400 hover:text-warm-gray-600"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {form.password && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-warm-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${pwStrength.color} transition-all duration-300 rounded-full`}
                            style={{ width: `${(pwStrength.score / 4) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-warm-gray-400">
                          {pwStrength.label}
                        </span>
                      </div>
                    )}
                    {errors.password && (
                      <p className="text-xs text-error mt-1">{errors.password}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                      Confirm Password
                    </label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={form.confirmPassword}
                      onChange={(e) => update('confirmPassword', e.target.value)}
                      placeholder="Re-enter your password"
                      className={`h-11 rounded-xl ${errors.confirmPassword ? 'border-error focus-visible:ring-error/20' : ''}`}
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs text-error mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── STEP 3: Profile Setup ── */}
              {step === 3 && form.role === 'supervisee' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                      Fieldwork Type
                    </label>
                    <select
                      value={form.fieldworkType}
                      onChange={(e) => update('fieldworkType', e.target.value)}
                      className={`w-full h-11 px-3 rounded-xl border bg-transparent text-sm text-warm-gray-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/10 transition-all ${
                        errors.fieldworkType ? 'border-error' : 'border-warm-gray-200'
                      }`}
                    >
                      <option value="">Select fieldwork type</option>
                      <option value="supervised">Supervised (2,000 hrs)</option>
                      <option value="concentrated">Concentrated (1,500 hrs)</option>
                      <option value="both">Both / Undecided</option>
                    </select>
                    {errors.fieldworkType && (
                      <p className="text-xs text-error mt-1">{errors.fieldworkType}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => update('startDate', e.target.value)}
                      className={`h-11 rounded-xl ${errors.startDate ? 'border-error' : ''}`}
                    />
                    {errors.startDate && (
                      <p className="text-xs text-error mt-1">{errors.startDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                      Expected Completion (optional)
                    </label>
                    <Input
                      type="date"
                      value={form.expectedCompletion}
                      onChange={(e) => update('expectedCompletion', e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              )}

              {step === 3 && form.role === 'supervisor' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                      BACB Certification Number
                    </label>
                    <Input
                      value={form.bacbaNumber}
                      onChange={(e) => update('bacbaNumber', e.target.value)}
                      placeholder="1-XX-XXXX"
                      className={`h-11 rounded-xl ${errors.bacbaNumber ? 'border-error' : ''}`}
                    />
                    {errors.bacbaNumber && (
                      <p className="text-xs text-error mt-1">{errors.bacbaNumber}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                      Years Certified
                    </label>
                    <Input
                      type="number"
                      value={form.yearsCertified}
                      onChange={(e) => update('yearsCertified', e.target.value)}
                      placeholder="e.g. 5"
                      className={`h-11 rounded-xl ${errors.yearsCertified ? 'border-error' : ''}`}
                    />
                    {errors.yearsCertified && (
                      <p className="text-xs text-error mt-1">{errors.yearsCertified}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-cream-50">
                    <Checkbox
                      id="training"
                      checked={form.trainingCompleted}
                      onCheckedChange={(v) => update('trainingCompleted', !!v)}
                    />
                    <label htmlFor="training" className="text-sm text-warm-gray-700 cursor-pointer">
                      I have completed the 8-hour supervisor training
                    </label>
                  </div>
                </div>
              )}

              {step === 3 && form.role === 'orgAdmin' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                      Organization Name
                    </label>
                    <Input
                      value={form.orgName}
                      onChange={(e) => update('orgName', e.target.value)}
                      placeholder="Your organization"
                      className={`h-11 rounded-xl ${errors.orgName ? 'border-error' : ''}`}
                    />
                    {errors.orgName && (
                      <p className="text-xs text-error mt-1">{errors.orgName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                      Number of Expected Users
                    </label>
                    <select
                      value={form.numCandidates}
                      onChange={(e) => update('numCandidates', e.target.value)}
                      className={`w-full h-11 px-3 rounded-xl border bg-transparent text-sm text-warm-gray-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/10 transition-all ${
                        errors.numCandidates ? 'border-error' : 'border-warm-gray-200'
                      }`}
                    >
                      <option value="">Select range</option>
                      <option value="1-10">1–10</option>
                      <option value="11-50">11–50</option>
                      <option value="51-100">51–100</option>
                      <option value="100+">100+</option>
                    </select>
                    {errors.numCandidates && (
                      <p className="text-xs text-error mt-1">{errors.numCandidates}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-warm-gray-700 mb-1.5">
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      value={form.orgPhone}
                      onChange={(e) => update('orgPhone', e.target.value)}
                      placeholder="(555) 123-4567"
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              )}

              {/* ── STEP 4: Plan Selection ── */}
              {step === 4 && (
                <div className="space-y-5">
                  {/* Billing cycle toggle */}
                  <div className="flex items-center justify-center bg-cream-50 rounded-xl p-1 gap-1">
                    <button
                      onClick={() => update('billingCycle', 'monthly')}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                        form.billingCycle === 'monthly'
                          ? 'bg-white text-warm-gray-800 shadow-sm'
                          : 'text-warm-gray-400 hover:text-warm-gray-600'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => update('billingCycle', 'annual')}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                        form.billingCycle === 'annual'
                          ? 'bg-white text-warm-gray-800 shadow-sm'
                          : 'text-warm-gray-400 hover:text-warm-gray-600'
                      }`}
                    >
                      Annual
                      <span className="ml-1.5 text-xs text-success font-semibold">
                        Save 20%
                      </span>
                    </button>
                  </div>

                  {/* Plan cards */}
                  <div className="space-y-3">
                    {plans.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => update('plan', plan.id)}
                        className={`w-full p-5 rounded-2xl border-2 text-left transition-all duration-200 ${
                          form.plan === plan.id
                            ? plan.id === 'professional'
                              ? 'border-rose-400 bg-rose-50'
                              : plan.id === 'enterprise'
                                ? 'border-gold bg-gold-light'
                                : 'border-rose-400 bg-rose-50'
                            : 'border-warm-gray-100 bg-white hover:border-warm-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-warm-gray-800">
                                {plan.name}
                              </span>
                              {plan.popular && (
                                <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-semibold rounded-full uppercase tracking-wide">
                                  Most Popular
                                </span>
                              )}
                              {plan.id === 'enterprise' && (
                                <span className="px-2 py-0.5 bg-gold text-white text-[10px] font-semibold rounded-full uppercase tracking-wide">
                                  Enterprise
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-warm-gray-400 mt-0.5">
                              {plan.description}
                            </p>
                          </div>
                          <div className="text-right">
                            {plan.id === 'enterprise' ? (
                              <span className="text-lg font-semibold text-warm-gray-800">
                                Custom
                              </span>
                            ) : (
                              <div>
                                <span className="text-xl font-semibold text-warm-gray-800">
                                  $
                                  {form.billingCycle === 'monthly'
                                    ? plan.price.monthly
                                    : plan.price.annual}
                                </span>
                                <span className="text-xs text-warm-gray-400">
                                  /mo
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <ul className="space-y-1 mt-3">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-2 text-xs text-warm-gray-500">
                              <Check size={12} className="text-success shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </button>
                    ))}
                  </div>
                  {errors.plan && (
                    <p className="text-xs text-error">{errors.plan}</p>
                  )}

                  {/* Apple Pay button */}
                  {form.plan && form.plan !== 'enterprise' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <button className="w-full h-12 bg-black text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                        <svg width="16" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.72 9.73c-.04-1.54.63-2.71 1.96-3.57-.76-1.09-1.9-1.69-3.4-1.79-1.42-.1-2.99.84-3.56.84-.6 0-2.01-.8-3.14-.8C6.32 4.47 3.8 6.43 3.8 9.87c0 1.02.19 2.08.57 3.17.51 1.49 2.35 5.13 4.27 5.07 1.02-.02 1.74-.73 3.07-.73 1.29 0 1.94.73 3.08.7 1.27-.02 2.11-1.15 2.89-2.45.72-1.05 1.01-2.06 1.03-2.11-.02-.01-1.98-.76-1.99-3.79zM15.25 3.1c.74-.89 1.24-2.13 1.1-3.36-1.07.04-2.37.71-3.14 1.6-.68.79-1.28 2.05-1.12 3.26 1.19.09 2.4-.6 3.16-1.5z" />
                        </svg>
                        Pay with Apple Pay
                      </button>
                      <div className="relative text-center">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-warm-gray-200" />
                        </div>
                        <span className="relative bg-white px-3 text-xs text-warm-gray-400">
                          Or pay with card
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-warm-gray-600 mb-1">
                            Card Number
                          </label>
                          <Input
                            placeholder="4242 4242 4242 4242"
                            className="h-10 rounded-lg text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-warm-gray-600 mb-1">
                              Expiry
                            </label>
                            <Input
                              placeholder="MM/YY"
                              className="h-10 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-warm-gray-600 mb-1">
                              CVC
                            </label>
                            <Input
                              placeholder="123"
                              className="h-10 rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Terms checkbox */}
                  <div className="flex items-start gap-3 pt-2">
                    <Checkbox
                      id="terms"
                      checked={form.agreedToTerms}
                      onCheckedChange={(v) => update('agreedToTerms', !!v)}
                      className={errors.agreedToTerms ? 'border-error' : ''}
                    />
                    <label htmlFor="terms" className="text-xs text-warm-gray-500 leading-relaxed cursor-pointer">
                      I agree to the{' '}
                      <Link to="/faq" className="text-rose-500 hover:underline">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link to="/faq" className="text-rose-500 hover:underline">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>
                  {errors.agreedToTerms && (
                    <p className="text-xs text-error">{errors.agreedToTerms}</p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="mt-8 space-y-4">
            <div className="flex gap-3">
              {step > 1 && (
                <button
                  onClick={goBack}
                  className="btn-secondary px-6 py-3 rounded-xl text-sm"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}
              <button
                onClick={goNext}
                className="btn-primary flex-1 py-3 rounded-xl text-sm"
              >
                {step === 4 ? 'Complete Sign Up' : 'Continue'}
                {step !== 4 && <ArrowRight size={16} />}
              </button>
            </div>

            {step === 1 && (
              <p className="text-center text-sm text-warm-gray-400">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-rose-500 font-medium hover:underline"
                >
                  Log in
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
