import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo';
import { ApiError, api } from '../lib/api';

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!token) return setErr('This reset link is missing its token. Please request a new one.');
    if (!password || !confirmPassword) return setErr('Please fill in both password fields.');
    if (password !== confirmPassword) return setErr('Passwords do not match.');
    if (!STRONG_PASSWORD.test(password)) {
      return setErr('Password must be 8+ characters with uppercase, lowercase, number, and special character.');
    }

    setSubmitting(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password })
      });
      setDone(true);
      setTimeout(() => nav('/signin'), 2500);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 429) {
        setErr('Too many requests. Try again later.');
      } else if (e instanceof ApiError && e.status === 400) {
        setErr(e.message || 'This reset link is invalid or has expired.');
      } else {
        setErr('Something went wrong. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-6">
      <div className="w-full max-w-[440px]">
        <div className="mb-10">
          <Logo />
        </div>

        {done ? (
          <div>
            <h1 className="font-display text-3xl text-forest-700 mb-3 leading-tight">Password updated.</h1>
            <p className="text-ink-500 text-[15px]">Redirecting you to sign in…</p>
          </div>
        ) : (
          <>
            <div className="mb-10">
              <span className="eyebrow block mb-3">Reset password</span>
              <h1 className="text-4xl mb-2 leading-tight font-display">Choose a new password.</h1>
              <p className="text-ink-500 text-[15px]">
                Make it strong — 8+ characters with uppercase, lowercase, number, and special character.
              </p>
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="new-password" className="block text-[13px] font-medium mb-2">New password</label>
                <input
                  id="new-password"
                  type="password"
                  required
                  aria-required="true"
                  minLength={8}
                  className="w-full px-4 py-3 rounded-lg border border-ink-100 bg-white text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-forest-400"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="8+ chars with upper/lower/number/special"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-[13px] font-medium mb-2">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  aria-required="true"
                  minLength={8}
                  className="w-full px-4 py-3 rounded-lg border border-ink-100 bg-white text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-forest-400"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Re-enter the new password"
                />
              </div>

              {err && (
                <div role="alert" className="bg-terracotta-100 border border-terracotta-400 rounded-lg px-4 py-3 text-[14px] text-terracotta-800">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-5 py-3 rounded-full bg-forest-700 text-cream-50 font-medium hover:bg-forest-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Updating…' : 'Update password'}
              </button>

              <p className="text-center text-[14px] text-ink-500">
                <Link to="/signin" className="text-forest-700 hover:text-forest-900 underline-offset-2 hover:underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
