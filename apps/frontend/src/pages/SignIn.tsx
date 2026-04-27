import { useEffect, useState, FormEvent } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { useSchools } from '../data/schools';
import { isValidJoinCode, normalizeJoinCode } from '../lib/joinCode';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT_ERROR_CLASS = 'border-terracotta-500 focus:border-terracotta-500 focus:shadow-[0_0_0_3px_rgba(197,106,74,0.12)]';

type FormField =
  | 'firstName'
  | 'lastName'
  | 'school'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'inviteCode'
  | 'acceptedPolicies';

function isStrongPassword(value: string): boolean {
  return STRONG_PASSWORD_REGEX.test(value);
}

export default function SignIn({ mode: initialMode }: { mode?: 'signin' | 'signup' }) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode ?? 'signin');
  const [role, setRole] = useState<'student' | 'counselor'>('student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [school, setSchool] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [activePolicy, setActivePolicy] = useState<'terms' | 'privacy' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const { signIn, signUp } = useAuth();
  const { schools, loadingSchools } = useSchools();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setMode('signup');
      setRole('student');
      setInviteCode(codeParam.toUpperCase());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setErr(null);
    setFieldErrors({});
  }, [mode, role]);

  function clearFieldError(field: FormField) {
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function markFieldErrors(fields: FormField[]) {
    if (fields.length === 0) return;
    setFieldErrors(prev => {
      const next = { ...prev };
      for (const field of fields) next[field] = true;
      return next;
    });
  }

  function setFormError(message: string, fields: FormField[] = []) {
    setErr(message);
    markFieldErrors(fields);
  }

  function inputAttrs(field: FormField) {
    return {
      className: `input ${fieldErrors[field] ? INPUT_ERROR_CLASS : ''}`,
      'aria-required': 'true' as const,
      'aria-invalid': (fieldErrors[field] ? 'true' : undefined) as 'true' | undefined,
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setFieldErrors({});

    const emailValue = email.trim();
    const invite = normalizeJoinCode(inviteCode);

    if (!emailValue) {
      setFormError('Email is required.', ['email']);
      return;
    }
    if (!EMAIL_REGEX.test(emailValue)) {
      setFormError('Please enter a valid school email.', ['email']);
      return;
    }
    if (!password) {
      setFormError('Password is required.', ['password']);
      return;
    }

    if (mode === 'signup') {
      if (!firstName.trim()) {
        setFormError('First name is required.', ['firstName']);
        return;
      }
      if (!lastName.trim()) {
        setFormError('Last name is required.', ['lastName']);
        return;
      }
      if (role === 'counselor' && !school) {
        setFormError('School is required for counselor sign up.', ['school']);
        return;
      }
      if (!isStrongPassword(password)) {
        setFormError('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.', ['password']);
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Confirm password must match your password.', ['password', 'confirmPassword']);
        return;
      }
      if (!acceptedPolicies) {
        setFormError('Please agree to the Terms and Privacy Policy to continue.', ['acceptedPolicies']);
        return;
      }
      if (role === 'student') {
        if (!invite) {
          setFormError('Department invitation code is required to create a student account.', ['inviteCode']);
          return;
        }
        if (!isValidJoinCode(invite)) {
          setFormError('Invitation code must be 6 characters (letters and numbers only).', ['inviteCode']);
          return;
        }
      }
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const result = await signUp({
          firstName,
          lastName,
          email: emailValue,
          password,
          role,
          school: role === 'counselor' ? school : undefined,
          inviteCode: role === 'student' ? invite : undefined,
          acceptedPolicies
        });
        navigate(`/check-your-email?email=${encodeURIComponent(result.email)}`, {
          replace: true,
          state: { verifyUrl: result.verifyUrl, emailDelivered: result.emailDelivered ?? true }
        });
        return;
      }

      const user = await signIn(emailValue, password, role);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      if (user.role === 'counselor') {
        navigate(from?.startsWith('/portal/counselor') ? from : '/portal/counselor', { replace: true });
      } else if (user.onboarded) {
        navigate(from?.startsWith('/portal/student') ? from : '/portal/student/dashboard', { replace: true });
      } else if (!user.basicsCompleted) {
        navigate('/profile/basics');
      } else {
        navigate('/start-evaluation');
      }
    } catch (e: any) {
      // Unverified-account path: server returns 403 with a string about verification.
      // Ship them to /check-your-email so they can resend the link.
      if (e instanceof ApiError && e.status === 403 && /verify/i.test(String(e?.message || ''))) {
        navigate(`/check-your-email?email=${encodeURIComponent(emailValue)}`, { replace: true });
        return;
      }
      const message = e?.message || 'Something went wrong.';
      setErr(message);

      const mapped = new Set<FormField>();
      const text = String(message).toLowerCase();
      if (text.includes('email') && text.includes('password')) {
        mapped.add('email');
        mapped.add('password');
      }
      if (text.includes('email')) mapped.add('email');
      if (text.includes('password')) mapped.add('password');
      if (text.includes('first') || text.includes('last')) {
        mapped.add('firstName');
        mapped.add('lastName');
      }
      if (text.includes('school')) mapped.add('school');
      if (text.includes('invitation') || text.includes('invite')) mapped.add('inviteCode');
      if (text.includes('confirm')) mapped.add('confirmPassword');
      if (text.includes('terms') || text.includes('privacy')) mapped.add('acceptedPolicies');
      if (mode === 'signup' && text.includes('already exists')) mapped.add('email');
      if (mode === 'signin' && mapped.size === 0) {
        mapped.add('email');
        mapped.add('password');
      }

      markFieldErrors(Array.from(mapped));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr]">
      {/* Editorial panel */}
      <aside className="grain bg-forest-700 text-cream-50 p-8 sm:p-12 relative overflow-hidden flex flex-col justify-between min-h-[280px] lg:min-h-screen">
        <div className="absolute -top-36 -right-36 w-[500px] h-[500px] border border-dashed border-cream-100/15 rounded-full pointer-events-none" />
        <div className="absolute -bottom-80 -left-52 w-[600px] h-[600px] border border-cream-100/5 rounded-full pointer-events-none" />

        <header className="relative z-10">
          <Logo invert />
        </header>

        <div className="relative z-10 max-w-[460px] hidden lg:block">
          <span className="eyebrow !text-terracotta-400 block mb-6">Welcome</span>
          <h2 className="!text-cream-50 text-5xl mb-6 leading-[1.1]">
            The right path<br />begins with the right<br />
            <span className="italic-serif !text-terracotta-400">questions.</span>
          </h2>
          <p className="text-cream-200 text-[17px] leading-[1.7] mb-10">
            Your assessment, your results, and your conversations with CareerLinkAI are always here when you're ready to think about what comes next.
          </p>
          <div className="border-l-2 border-terracotta-400 pl-6 py-2">
            <p className="font-display italic text-lg text-cream-50 mb-3 leading-snug">
              "I went in expecting a quiz. I left with a clearer sense of what I actually want from college than I'd had in two years."
            </p>
            <span className="text-[13px] text-cream-200 font-mono tracking-wide">— ANGELI R., GRADE 12 STEM</span>
          </div>
        </div>

        <footer className="relative z-10 text-[13px] text-cream-200 font-mono tracking-wide hidden lg:block">
          CAREERLINKAI / 2026 / EST. CEBU
        </footer>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[440px]">
          <div className="grid grid-cols-2 bg-cream-200 p-1 rounded-lg mb-10">
            {(['student', 'counselor'] as const).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`py-2.5 px-4 text-sm font-medium rounded-md transition ${role === r ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}
              >
                I'm a {r}
              </button>
            ))}
          </div>

          <div className="mb-10">
            <span className="eyebrow block mb-3">{mode === 'signin' ? 'Sign in' : 'Create account'}</span>
            <h1 className="text-4xl mb-2 leading-tight">
              {mode === 'signin' ? (
                <>Welcome <span className="italic-serif">back.</span></>
              ) : (
                <>Begin your <span className="italic-serif">journey.</span></>
              )}
            </h1>
            <p className="text-ink-500 text-[15px]">
              {mode === 'signin' ? 'Continue where you left off.' : 'A few details to get started.'}
            </p>
          </div>

          {role === 'counselor' && mode === 'signup' && (
            <div className="bg-terracotta-100 border border-terracotta-400 rounded-lg px-4 py-3.5 mb-6 text-[13px] text-terracotta-800 leading-snug">
              Counselor accounts are created with a verification step after sign-up. Use your official school email.
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {mode === 'signup' && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="signin-firstName" className="block text-[13px] font-medium mb-2">First name</label>
                  <input
                    id="signin-firstName"
                    {...inputAttrs('firstName')}
                    required
                    value={firstName}
                    onChange={e => { setFirstName(e.target.value); clearFieldError('firstName'); }}
                    placeholder="First name"
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label htmlFor="signin-lastName" className="block text-[13px] font-medium mb-2">Last name</label>
                  <input
                    id="signin-lastName"
                    {...inputAttrs('lastName')}
                    required
                    value={lastName}
                    onChange={e => { setLastName(e.target.value); clearFieldError('lastName'); }}
                    placeholder="Last name"
                    autoComplete="family-name"
                  />
                </div>
              </div>
            )}
            {mode === 'signup' && role === 'counselor' && (
              <div>
                <label htmlFor="signin-school" className="block text-[13px] font-medium mb-2">School</label>
                <select
                  id="signin-school"
                  {...inputAttrs('school')}
                  required
                  value={school}
                  disabled={loadingSchools}
                  onChange={e => { setSchool(e.target.value); clearFieldError('school'); }}
                >
                  <option value="">{loadingSchools ? 'Loading…' : 'Choose your school'}</option>
                  {schools.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="signin-email" className="block text-[13px] font-medium mb-2">School email</label>
              <input
                id="signin-email"
                {...inputAttrs('email')}
                type="email"
                required
                value={email}
                onChange={e => { setEmail(e.target.value); clearFieldError('email'); }}
                placeholder="you@school.edu.ph"
                autoComplete="email"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="signin-password" className="block text-[13px] font-medium">Password</label>
                {mode === 'signin' && (
                  <Link
                    to="/forgot-password"
                    className="text-[12px] text-forest-700 hover:text-forest-900 underline-offset-2 hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <input
                id="signin-password"
                {...inputAttrs('password')}
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => { setPassword(e.target.value); clearFieldError('password'); }}
                placeholder={mode === 'signup' ? '8+ chars with upper/lower/number/special' : 'Enter your password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
              {mode === 'signup' && (
                <p className="mt-2 text-xs text-ink-500">Must include uppercase, lowercase, number, and special character.</p>
              )}
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="signin-confirmPassword" className="block text-[13px] font-medium mb-2">Confirm password</label>
                <input
                  id="signin-confirmPassword"
                  {...inputAttrs('confirmPassword')}
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
                  placeholder="Retype your password"
                  autoComplete="new-password"
                />
              </div>
            )}

            {role === 'student' && mode === 'signup' && (
              <div>
                <div>
                  <label htmlFor="signin-inviteCode" className="block text-[13px] font-medium mb-2">
                    Department invitation code or ID
                  </label>
                  <input
                    id="signin-inviteCode"
                    {...inputAttrs('inviteCode')}
                    required
                    value={inviteCode}
                    onChange={e => { setInviteCode(e.target.value); clearFieldError('inviteCode'); }}
                    placeholder="Enter code from your counselor"
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div className={`bg-cream-50 border rounded-lg px-4 py-3.5 ${fieldErrors.acceptedPolicies ? 'border-terracotta-500 bg-terracotta-100/40' : 'border-cream-300'}`}>
                <label className="flex items-start gap-3 text-sm text-ink-700 leading-relaxed">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={acceptedPolicies}
                    onChange={e => {
                      setAcceptedPolicies(e.target.checked);
                      clearFieldError('acceptedPolicies');
                    }}
                  />
                  <span>
                    I agree to the{' '}
                    <button type="button" className="text-forest-700 font-medium hover:underline" onClick={() => setActivePolicy('terms')}>
                      Terms and Conditions
                    </button>
                    {' '}and{' '}
                    <button type="button" className="text-forest-700 font-medium hover:underline" onClick={() => setActivePolicy('privacy')}>
                      Privacy Policy
                    </button>
                    .
                  </span>
                </label>
                <p className="mt-2 text-xs text-ink-500">Required to create an account.</p>
              </div>
            )}

            {err && (
              <div className="text-sm text-terracotta-800 bg-terracotta-100 border border-terracotta-400 rounded px-3 py-2">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-forest-700 hover:bg-forest-600 text-cream-50 py-4 rounded-lg font-medium text-[15px] transition disabled:opacity-60"
            >
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in to CareerLinkAI' : 'Create my account'}
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-ink-500">
            {mode === 'signin' ? 'New to CareerLinkAI?' : 'Already have an account?'}
            <button
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="ml-1 text-forest-700 font-medium hover:underline"
            >
              {mode === 'signin' ? 'Create an account' : 'Sign in instead'}
            </button>
          </p>

          <p className="text-center mt-4 text-sm">
            <Link to="/" className="text-ink-500 hover:text-ink-900">← Back to home</Link>
          </p>
        </div>
      </main>

      {activePolicy && (
        <div className="fixed inset-0 z-50 bg-ink-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="policy-dialog-title">
          <div className="w-full max-w-2xl bg-white border border-cream-300 rounded-lg shadow-xl">
            <div className="px-6 py-4 border-b border-cream-300 flex items-center justify-between">
              <h3 id="policy-dialog-title" className="text-xl font-medium">
                {activePolicy === 'terms' ? 'Terms and Conditions' : 'Privacy Policy'}
              </h3>
              <button
                type="button"
                onClick={() => setActivePolicy(null)}
                className="text-sm text-ink-500 hover:text-ink-900"
              >
                Close
              </button>
            </div>
            <div className="px-6 py-5 space-y-3 text-sm text-ink-600 max-h-[65vh] overflow-y-auto leading-relaxed">
              {activePolicy === 'terms' ? (
                <>
                  <p>By creating a student account, you confirm that the information you provide is accurate and belongs to you.</p>
                  <p>Your account is linked to a counselor-issued invitation code and is intended only for school guidance and career-planning purposes.</p>
                  <p>Abuse of the platform, impersonation, or unauthorized sharing of access may result in account suspension by school administrators.</p>
                </>
              ) : (
                <>
                  <p>CareerLinkAI stores your profile details, assessments, and results so you and your school counselor can review your career guidance progress.</p>
                  <p>Your personal data is processed for education support only and is not sold to third parties.</p>
                  <p>You may request profile updates through your account settings, and your school can coordinate account-related concerns.</p>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-cream-300 flex justify-end">
              <button type="button" onClick={() => setActivePolicy(null)} className="btn btn-primary">I understand</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
