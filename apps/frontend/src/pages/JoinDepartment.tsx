import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isValidJoinCode, normalizeJoinCode } from '../lib/joinCode';

type JoinState = 'idle' | 'joining' | 'joined' | 'error';

export default function JoinDepartment() {
  const { code } = useParams();
  const { user, loading } = useAuth();
  const [state, setState] = useState<JoinState>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (loading) return;
    const normalizedCode = normalizeJoinCode(code || '');

    if (!normalizedCode) {
      setState('error');
      setMessage('Join code is missing.');
      return;
    }
    if (!isValidJoinCode(normalizedCode)) {
      setState('error');
      setMessage('This invitation link is invalid. Please ask your counselor for a new one.');
      return;
    }
    if (!user) return;
    if (user.role !== 'student') {
      setState('error');
      setMessage('Only student accounts can join departments.');
      return;
    }

    let cancelled = false;
    async function runJoin() {
      setState('joining');
      try {
        const res = await api<{ alreadyJoined?: boolean }>(`/join/${encodeURIComponent(normalizedCode)}`, { method: 'POST' });
        if (cancelled) return;
        if (res.alreadyJoined) {
          setState('joined');
          setMessage('You are already a member of this department.');
        } else {
          setState('joined');
          setMessage('You have successfully joined the department.');
        }
      } catch (e) {
        if (cancelled) return;
        setState('error');
        const msg = e instanceof ApiError ? e.message : 'Could not join this department.';
        setMessage(msg);
      }
    }

    runJoin();
    return () => {
      cancelled = true;
    };
  }, [code, user, loading]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-ink-500">Loading…</div>;
  }

  if (!user) {
    const normalizedCode = normalizeJoinCode(code || '');
    return <Navigate to={`/signup?code=${encodeURIComponent(normalizedCode || code || '')}`} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-cream-300 rounded-lg p-6 text-center">
        <h1 className="text-2xl mb-2">Department invite</h1>
        {state === 'joining' && <p className="text-ink-500">Joining department…</p>}
        {state !== 'joining' && <p className="text-ink-500">{message}</p>}

        <div className="mt-6 flex justify-center gap-3">
          <Link to="/portal/student/dashboard" className="btn btn-primary">Go to my dashboard</Link>
          <Link to="/" className="btn btn-ghost">Home</Link>
        </div>
      </div>
    </div>
  );
}
