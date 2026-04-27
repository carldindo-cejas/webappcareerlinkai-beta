import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const FALLBACK_SCHOOLS = ['Calape National High School'];

export const GRADE_LEVELS_SHS = ['11', '12'] as const;

export const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' }
] as const;

// Module-level cache so multiple components don't duplicate the request.
let _cache: string[] | null = null;
let _inflight: Promise<string[]> | null = null;

async function loadSchools(): Promise<string[]> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = api<{ schools: string[] }>('/schools')
    .then(d => { _cache = d.schools; _inflight = null; return _cache; })
    .catch(() => { _inflight = null; return FALLBACK_SCHOOLS; });
  return _inflight;
}

export function useSchools(): { schools: string[]; loadingSchools: boolean } {
  const [schools, setSchools] = useState<string[]>(_cache ?? []);
  const [loadingSchools, setLoadingSchools] = useState(!_cache);

  useEffect(() => {
    if (_cache) { setSchools(_cache); setLoadingSchools(false); return; }
    loadSchools().then(s => { setSchools(s); setLoadingSchools(false); });
  }, []);

  return { schools, loadingSchools };
}
