export type Strand = {
  code: 'STEM' | 'ABM' | 'HUMSS' | 'ICT' | 'HE';
  name: string;
  desc: string;
};

export const STRANDS: Strand[] = [
  {
    code: 'STEM',
    name: 'Science, Technology, Engineering & Math',
    desc: 'For students bound for science, computing, engineering, or health professions.'
  },
  {
    code: 'ABM',
    name: 'Accountancy, Business & Management',
    desc: 'For future entrepreneurs, accountants, marketers, and business leaders.'
  },
  {
    code: 'HUMSS',
    name: 'Humanities & Social Sciences',
    desc: 'For aspiring teachers, lawyers, journalists, psychologists, and public servants.'
  },
  {
    code: 'ICT',
    name: 'Information and Communications Technology',
    desc: 'For students focused on programming, digital systems, networking, and tech support pathways.'
  },
  {
    code: 'HE',
    name: 'Home Economics',
    desc: 'For students preparing for hospitality, culinary, caregiving, and service-oriented careers.'
  }
];

export const SUBJECTS = [
  'Math',
  'English',
  'Science'
] as const;

export const GRADE_LEVELS = [7, 8, 9, 10] as const;
