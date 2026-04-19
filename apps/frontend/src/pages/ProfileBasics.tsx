import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav, { SaveStatus } from '../components/TopNav';
import Stepper from '../components/Stepper';
import { GENDERS, GRADE_LEVELS_SHS, SCHOOLS } from '../data/schools';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

type ProfileResponse = {
  school?: string | null;
  gradeLevel?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  basicsCompleted?: boolean;
};

export default function ProfileBasics() {
  const { refresh } = useAuth();
  const nav = useNavigate();

  const [school, setSchool] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [gender, setGender] = useState('');
  const [birthdate, setBirthdate] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<ProfileResponse>('/profile').then(p => {
      if (p.school) setSchool(p.school);
      if (p.gradeLevel) setGradeLevel(p.gradeLevel);
      if (p.gender) setGender(p.gender);
      if (p.birthdate) setBirthdate(p.birthdate);
    }).catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!school) return setErr('Please pick your school.');
    if (!gradeLevel) return setErr('Please pick your grade level.');
    if (!gender) return setErr('Please pick a gender option.');
    if (!birthdate) return setErr('Please enter your birthdate.');

    setSaving(true);
    try {
      await api('/profile/basics', {
        method: 'PUT',
        body: JSON.stringify({ school, gradeLevel, gender, birthdate })
      });
      setSaved(true);
      await refresh();
      nav('/start-evaluation');
    } catch (e: any) {
      setErr(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <TopNav right={<SaveStatus label={saved ? 'SAVED · JUST NOW' : 'UNSAVED CHANGES'} />} />
      <Stepper
        steps={[
          { name: 'Profile', status: 'active' },
          { name: 'Academic background', status: 'pending' },
          { name: 'RIASEC assessment', status: 'pending' },
          { name: 'SCCT reflection', status: 'pending' },
          { name: 'Your results', status: 'pending' }
        ]}
      />

      <main className="max-w-[760px] mx-auto px-4 sm:px-8 py-16 pb-24">
        <span className="eyebrow block mb-5">Step one of five · Profile</span>
        <h1 className="text-4xl sm:text-[2.75rem] leading-[1.1] mb-4">
          A few things <span className="italic-serif">about you.</span>
        </h1>
        <p className="text-[18px] text-ink-500 leading-relaxed mb-12 max-w-[580px]">
          We use these details to tailor your guidance and recommendations. Everything is private to you and your school.
        </p>

        <form onSubmit={onSubmit} className="bg-cream-50 border border-cream-300 rounded-lg p-6 sm:p-8 space-y-6">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[13px] font-medium mb-2">School</label>
              <select className="input" value={school} onChange={e => setSchool(e.target.value)} required>
                <option value="">Choose your school</option>
                {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-2">Grade level</label>
              <select className="input" value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} required>
                <option value="">Choose grade level</option>
                {GRADE_LEVELS_SHS.map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-2">Gender</label>
              <select className="input" value={gender} onChange={e => setGender(e.target.value)} required>
                <option value="">Choose one</option>
                {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-2">Birthdate</label>
              <input
                type="date"
                className="input"
                value={birthdate}
                onChange={e => setBirthdate(e.target.value)}
                required
              />
            </div>
          </div>

          {err && (
            <div className="text-sm text-terracotta-800 bg-terracotta-100 border border-terracotta-400 rounded px-3 py-2">
              {err}
            </div>
          )}

          <div className="flex flex-wrap justify-between items-center gap-4 pt-4 border-t border-cream-300">
            <span className="font-mono text-xs text-ink-300 tracking-[0.1em]">1 / 5 STEPS</span>
            <button
              type="submit"
              disabled={saving}
              className="bg-forest-700 hover:bg-forest-600 text-cream-50 py-3.5 px-8 rounded-lg font-medium inline-flex items-center gap-2.5 transition hover:-translate-y-0.5 hover:shadow disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Continue to academics'}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8m0 0L7 3m4 4L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
