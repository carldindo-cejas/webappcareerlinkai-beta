export const SCHOOLS = [
  'Calape National High School'
] as const;

export type School = (typeof SCHOOLS)[number];

export const GRADE_LEVELS_SHS = ['11', '12'] as const;

export const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' }
] as const;
