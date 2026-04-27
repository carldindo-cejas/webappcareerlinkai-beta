import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { ApiError, api } from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.trim()) return setErr('Please enter your email.');
    setSubmitting(true);
    try {
      const res = await api<{ ok: true; resetUrl?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() })
      });
      if (res.resetUrl) setFallbackUrl(res.resetUrl);
      setSubmitted(true);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 429) {
        setErr('Too many requests. Try again in a few minutes.');
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

        {submitted ? (
          <div>
            <h1 className="font-display text-3xl text-forest-700 mb-3 leading-tight">Check your email.</h1>
            <p className="text-ink-500 text-[15px] mb-6 leading-relaxed">
              If an account exists for <span className="text-forest-700 font-medium">{email}</span>, we've sent a password reset link. The link expires in 1 hour.
            </p>
            <p className="text-ink-500 text-[14px] mb-8">
              Didn't get it? Check your spam folder, or try again in a few minutes.
            </p>
            {fallbackUrl && (
              <div role="alert" className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mb-8 text-[13px] text-ink-900">
                <p className="font-medium mb-1.5 text-amber-900">Email could not be delivered</p>
                <p className="mb-3 text-ink-500">
                  Test sender restriction. You can reset your password directly using the link below:
                </p>
                <a
                  href={fallbackUrl}
                  className="inline-block px-4 py-2 rounded-full bg-forest-700 text-cream-50 font-medium text-[13px] hover:bg-forest-900 transition-colors"
                >
                  Reset my password
                </a>
              </div>
            )}
            <Link
              to="/signin"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-forest-700 text-cream-50 font-medium hover:bg-forest-900 transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-10">
              <span className="eyebrow block mb-3">Reset password</span>
              <h1 className="text-4xl mb-2 leading-tight font-display">Forgot password?</h1>
              <p className="text-ink-500 text-[15px]">
                Enter the email you signed up with and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium mb-2">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  aria-required="true"
                  className="w-full px-4 py-3 rounded-lg border border-ink-100 bg-white text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-forest-400"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@school.edu.ph"
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
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>

              <p className="text-center text-[14px] text-ink-500">
                Remembered it?{' '}
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
