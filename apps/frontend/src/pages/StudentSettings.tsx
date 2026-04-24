import { FormEvent, useEffect, useState } from 'react';
import PortalLayout from '../components/PortalLayout';
import { studentNavItems } from '../lib/portalNav';
import { GENDERS, GRADE_LEVELS_SHS, SCHOOLS } from '../data/schools';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

type ProfileResponse = {
  school?: string | null;
  gradeLevel?: string | null;
  gender?: string | null;
  birthdate?: string | null;
};

type Tab = 'profile' | 'password';

export default function StudentSettings() {
  const { user, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  const [school, setSchool] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [gender, setGender] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingProfile(true);
    api<ProfileResponse>('/profile')
      .then(p => {
        if (cancelled) return;
        setSchool(p.school || '');
        setGradeLevel(p.gradeLevel || '');
        setGender(p.gender || '');
        setBirthdate(p.birthdate || '');
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadingProfile(false));
    return () => { cancelled = true; };
  }, []);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    if (!school || !gradeLevel || !gender || !birthdate) {
      setProfileMsg({ tone: 'err', text: 'Please fill in every field.' });
      return;
    }
    setSavingProfile(true);
    try {
      await api('/profile/basics', {
        method: 'PUT',
        body: JSON.stringify({ school, gradeLevel, gender, birthdate })
      });
      await refresh();
      setProfileMsg({ tone: 'ok', text: 'Profile updated.' });
    } catch (err: any) {
      setProfileMsg({ tone: 'err', text: err?.message || 'Could not save profile.' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({ tone: 'err', text: 'Fill out every field.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ tone: 'err', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ tone: 'err', text: 'New password and confirmation do not match.' });
      return;
    }
    setSavingPassword(true);
    try {
      await api('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({ tone: 'ok', text: 'Password updated.' });
    } catch (err: any) {
      setPasswordMsg({ tone: 'err', text: err?.message || 'Could not change password.' });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <PortalLayout
      title="Settings"
      subtitle={`Manage your account, ${user?.name || 'Student'}`}
      navItems={studentNavItems}
    >
      <div className="max-w-3xl">
        <div className="flex gap-2 mb-6 border-b border-cream-300">
          {(['profile', 'password'] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition ${
                tab === t
                  ? 'border-forest-700 text-forest-700'
                  : 'border-transparent text-ink-500 hover:text-ink-900'
              }`}
            >
              {t === 'profile' ? 'Profile basics' : 'Change password'}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="space-y-6">
            <form
              onSubmit={onSaveProfile}
              className="bg-white border border-cream-300 rounded-lg p-6 sm:p-8 space-y-6"
            >
              {loadingProfile ? (
                <div className="text-ink-500">Loading…</div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[13px] font-medium mb-2">School</label>
                    <select className="input" value={school} onChange={e => setSchool(e.target.value)}>
                      <option value="">Choose your school</option>
                      {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium mb-2">Grade level</label>
                    <select className="input" value={gradeLevel} onChange={e => setGradeLevel(e.target.value)}>
                      <option value="">Choose grade level</option>
                      {GRADE_LEVELS_SHS.map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium mb-2">Gender</label>
                    <select className="input" value={gender} onChange={e => setGender(e.target.value)}>
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
                    />
                  </div>
                </div>
              )}

              {profileMsg && (
                <div
                  className={`text-sm rounded px-3 py-2 border ${
                    profileMsg.tone === 'ok'
                      ? 'bg-forest-50 border-forest-300 text-forest-700'
                      : 'bg-terracotta-100 border-terracotta-400 text-terracotta-800'
                  }`}
                >
                  {profileMsg.text}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-cream-300">
                <button
                  type="submit"
                  disabled={savingProfile || loadingProfile}
                  className="btn btn-primary"
                >
                  {savingProfile ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {tab === 'password' && (
          <form
            onSubmit={onChangePassword}
            className="bg-white border border-cream-300 rounded-lg p-6 sm:p-8 space-y-6 max-w-xl"
          >
            <div>
              <label className="block text-[13px] font-medium mb-2">Current password</label>
              <input
                type="password"
                className="input"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-2">New password</label>
              <input
                type="password"
                className="input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-ink-500 mt-1">At least 8 characters.</p>
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-2">Confirm new password</label>
              <input
                type="password"
                className="input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {passwordMsg && (
              <div
                className={`text-sm rounded px-3 py-2 border ${
                  passwordMsg.tone === 'ok'
                    ? 'bg-forest-50 border-forest-300 text-forest-700'
                    : 'bg-terracotta-100 border-terracotta-400 text-terracotta-800'
                }`}
              >
                {passwordMsg.text}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-cream-300">
              <button type="submit" disabled={savingPassword} className="btn btn-primary">
                {savingPassword ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </PortalLayout>
  );
}
