export type ScctConstruct = 'self_efficacy' | 'outcome_expectations' | 'perceived_barriers';

export type ScctItem = {
  id: number;
  construct: ScctConstruct;
  prompt: string;
};

export const SCCT_ITEMS: ScctItem[] = [
  { id: 1, construct: 'self_efficacy', prompt: 'I can succeed in my chosen career path.' },
  { id: 2, construct: 'self_efficacy', prompt: 'I can learn difficult skills needed for my future job.' },
  { id: 3, construct: 'self_efficacy', prompt: 'I can perform well in tasks related to my career goals.' },
  { id: 4, construct: 'self_efficacy', prompt: 'I can overcome challenges while pursuing my career.' },

  { id: 5, construct: 'outcome_expectations', prompt: 'My future career will provide good opportunities.' },
  { id: 6, construct: 'outcome_expectations', prompt: 'My effort in school will help me achieve career success.' },
  { id: 7, construct: 'outcome_expectations', prompt: 'A career aligned to my strengths will improve my quality of life.' },
  { id: 8, construct: 'outcome_expectations', prompt: 'My chosen course can lead to meaningful work.' },

  { id: 9, construct: 'perceived_barriers', prompt: 'Financial limitations may affect my career path.' },
  { id: 10, construct: 'perceived_barriers', prompt: 'Lack of resources may make my career goals difficult.' },
  { id: 11, construct: 'perceived_barriers', prompt: 'Family or social pressures may influence my career decision.' },
  { id: 12, construct: 'perceived_barriers', prompt: 'Limited access to opportunities may delay my plans.' }
];

export const SCCT_OPTIONS: { value: number; label: string; nuance: string }[] = [
  { value: 1, label: 'Strongly disagree', nuance: 'It feels uncertain or unlikely.' },
  { value: 2, label: 'Disagree', nuance: 'I lean against this, with some hesitation.' },
  { value: 3, label: 'Neutral', nuance: 'I am not sure either way.' },
  { value: 4, label: 'Agree', nuance: 'This feels mostly true for me.' },
  { value: 5, label: 'Strongly agree', nuance: 'This is clearly how I see it.' }
];

export const CONSTRUCT_META: Record<ScctConstruct, { title: string; italicTail: string; description: string }> = {
  self_efficacy: {
    title: 'Self',
    italicTail: 'efficacy.',
    description:
      'How much do you believe in your own capacity to pursue the direction you want? These four items look at confidence, agency, and your willingness to see yourself succeed.'
  },
  outcome_expectations: {
    title: 'Outcome',
    italicTail: 'expectations.',
    description:
      'RIASEC tells us what you would enjoy. This section asks something different — what you believe will happen if you pursue it. Your hopes, assumptions, and read on what the future might hold.'
  },
  perceived_barriers: {
    title: 'Perceived',
    italicTail: 'barriers.',
    description:
      'What stands between you and the path you want? Naming the obstacles — financial, academic, relational — helps us recommend support, not just direction.'
  }
};
