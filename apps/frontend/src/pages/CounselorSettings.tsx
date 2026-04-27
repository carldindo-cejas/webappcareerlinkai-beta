import { FormEvent, useEffect, useState } from 'react';
import PortalLayout from '../components/PortalLayout';
import { counselorNavItems } from '../lib/portalNav';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSchools } from '../data/schools';

type CounselorProfile = {
  firstName?: string;
  lastName?: string;
  school?: string;
  email?: string;
  name?: string;
};

type Tab = 'profile' | 'password';

export default function CounselorSettings() {
  const { user, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [school, setSchool] = useState('');
  const { schools, loadingSchools } = useSchools();
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
    api<CounselorProfile>('/counselor/profile')
      .then(p => {
        if (cancelled) return;
        setFirstName(p.firstName || '');
        setLastName(p.lastName || '');
        setSchool(p.school || '');
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadingProfile(false));
    return () => { cancelled = true; };
  }, []);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    if (!firstName.trim() || !lastName.trim() || !school) {
      setProfileMsg({ tone: 'err', text: 'Fill in first name, last name, and school.' });
      return;
    }
    setSavingProfile(true);
    try {
      await api('/counselor/profile', {
        method: 'PUT',
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), school })
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
      subtitle={`Manage your account, ${user?.name || 'Counselor'}`}
      navItems={counselorNavItems}
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
              {t === 'profile' ? 'Profile' : 'Change password'}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <form onSubmit={onSaveProfile} className="bg-white border border-cream-300 rounded-lg p-6 sm:p-8 space-y-6">
            {loadingProfile ? (
              <div className="text-ink-500">Loading…</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[13px] font-medium mb-2">First name</label>
                  <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium mb-2">Last name</label>
                  <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[13px] font-medium mb-2">School</label>
                  <select className="input" value={school} onChange={e => setSchool(e.target.value)} disabled={loadingSchools}>
                    <option value="">{loadingSchools ? 'Loading…' : 'Choose your school'}</option>
                    {schools.map((s: string) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}

            {profileMsg && (
              <div className={`text-sm rounded px-3 py-2 border ${profileMsg.tone === 'ok' ? 'bg-forest-50 border-forest-300 text-forest-700' : 'bg-terracotta-100 border-terracotta-400 text-terracotta-800'}`}>
                {profileMsg.text}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-cream-300">
              <button type="submit" disabled={savingProfile || loadingProfile} className="btn btn-primary">
                {savingProfile ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}

        {tab === 'password' && (
          <form onSubmit={onChangePassword} className="bg-white border border-cream-300 rounded-lg p-6 sm:p-8 space-y-6 max-w-xl">
            <div>
              <label className="block text-[13px] font-medium mb-2">Current password</label>
              <input type="password" className="input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-2">New password</label>
              <input type="password" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
              <p className="text-xs text-ink-500 mt-1">At least 8 characters.</p>
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-2">Confirm new password</label>
              <input type="password" className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
            </div>

            {passwordMsg && (
              <div className={`text-sm rounded px-3 py-2 border ${passwordMsg.tone === 'ok' ? 'bg-forest-50 border-forest-300 text-forest-700' : 'bg-terracotta-100 border-terracotta-400 text-terracotta-800'}`}>
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
