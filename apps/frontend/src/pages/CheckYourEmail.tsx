import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo';
import { ApiError, api } from '../lib/api';

type LocationState = { verifyUrl?: string; emailDelivered?: boolean } | null;

export default function CheckYourEmail() {
  const [params] = useSearchParams();
  const location = useLocation();
  const email = params.get('email') || '';
  const initialState = (location.state as LocationState) || null;

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(initialState?.verifyUrl || null);
  const [emailDelivered, setEmailDelivered] = useState<boolean>(initialState?.emailDelivered ?? true);

  async function onResend() {
    if (!email) return;
    setErr(null);
    setResending(true);
    try {
      const res = await api<{ ok: true; verifyUrl?: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      if (res.verifyUrl) {
        setFallbackUrl(res.verifyUrl);
        setEmailDelivered(false);
      } else {
        setResent(true);
      }
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 429) {
        setErr('Too many resend requests. Try again in an hour.');
      } else {
        setErr('Could not resend. Try again.');
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-6">
      <div className="w-full max-w-[440px]">
        <div className="mb-10">
          <Logo />
        </div>

        <span className="eyebrow block mb-3">Verify email</span>
        <h1 className="font-display text-4xl text-forest-700 mb-3 leading-tight">Check your email.</h1>
        <p className="text-ink-500 text-[15px] mb-2">
          {email ? (
            <>We sent a verification link to <span className="text-forest-700 font-medium">{email}</span>. Click it to finish creating your account.</>
          ) : (
            <>We sent a verification link to your email. Click it to finish creating your account.</>
          )}
        </p>
        <p className="text-ink-500 text-[14px] mb-8">
          The link expires in 24 hours. Don't see it? Check spam or junk.
        </p>

        {!emailDelivered && fallbackUrl && (
          <div role="alert" className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mb-5 text-[13px] text-ink-900">
            <p className="font-medium mb-1.5 text-amber-900">Email could not be delivered</p>
            <p className="mb-3 text-ink-500">
              Our test sender ({`onboarding@resend.dev`}) can only deliver to the developer's inbox.
              You can finish verifying your account using the direct link below:
            </p>
            <a
              href={fallbackUrl}
              className="inline-block px-4 py-2 rounded-full bg-forest-700 text-cream-50 font-medium text-[13px] hover:bg-forest-900 transition-colors"
            >
              Verify my account
            </a>
          </div>
        )}

        {err && (
          <div role="alert" className="bg-terracotta-100 border border-terracotta-400 rounded-lg px-4 py-3 mb-5 text-[14px] text-terracotta-800">
            {err}
          </div>
        )}
        {resent && (
          <div role="status" className="bg-forest-100 border border-forest-400 rounded-lg px-4 py-3 mb-5 text-[14px] text-forest-700">
            We sent a fresh verification link.
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onResend}
            disabled={resending || !email}
            className="px-5 py-3 rounded-full bg-forest-700 text-cream-50 font-medium hover:bg-forest-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {resending ? 'Resending…' : 'Resend verification email'}
          </button>
          <Link
            to="/signin"
            className="text-center px-5 py-3 rounded-full border border-ink-100 text-forest-700 font-medium hover:bg-cream-100 transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
