import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo';
import { ApiError, api, setToken, setRefreshToken } from '../lib/api';
import { useAuth } from '../lib/auth';

type Status = 'verifying' | 'success' | 'invalid' | 'error';

type VerifyResponse = {
  token: string;
  refreshToken: string;
  user: { id: number; email: string; name: string; role: 'student' | 'counselor'; onboarded: boolean; basicsCompleted: boolean };
};

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'invalid');
  const ranRef = useRef(false);

  async function handleVerify() {
    setStatus('verifying');
    try {
      const res = await api<VerifyResponse>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token })
      });
      setToken(res.token);
      setRefreshToken(res.refreshToken);
      await refresh();
      setStatus('success');
      const dest = res.user.role === 'counselor' ? '/portal/counselor' : '/portal/student/dashboard';
      setTimeout(() => nav(dest, { replace: true }), 1200);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 400) {
        setStatus('invalid');
      } else {
        setStatus('error');
      }
    }
  }

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (!token) return;
    void handleVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-6">
      <div className="w-full max-w-[440px] text-center">
        <div className="mb-10 flex justify-center">
          <Logo />
        </div>

        {status === 'verifying' && (
          <>
            <h1 className="font-display text-3xl text-forest-700 mb-3">Verifying…</h1>
            <p className="text-ink-500 text-[15px]">One moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="font-display text-3xl text-forest-700 mb-3">Email verified.</h1>
            <p className="text-ink-500 text-[15px]">Signing you in…</p>
          </>
        )}

        {status === 'invalid' && (
          <>
            <h1 className="font-display text-3xl text-forest-700 mb-3">This link isn't valid.</h1>
            <p className="text-ink-500 text-[15px] mb-8">
              It may have expired (links last 24 hours) or already been used.
            </p>
            <Link
              to="/signin"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-forest-700 text-cream-50 font-medium hover:bg-forest-900 transition-colors"
            >
              Back to sign in
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="font-display text-3xl text-forest-700 mb-3">Something went wrong.</h1>
            <p className="text-ink-500 text-[15px] mb-8">Please try again, or contact support.</p>
            <button
              onClick={handleVerify}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-forest-700 text-cream-50 font-medium hover:bg-forest-900 transition-colors"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
