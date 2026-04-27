import { describe, expect, it } from 'vitest';
import { hollandCode, recommend, scoreRiasec, scoreScct } from './scoring';

describe('scoreRiasec', () => {
  it('returns zero for every dimension on empty input', () => {
    expect(scoreRiasec({})).toEqual({ R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 });
  });

  it('returns 3 for every dimension when all 48 answers are 3', () => {
    const answers: Record<number, number> = {};
    for (let i = 1; i <= 48; i++) answers[i] = 3;
    expect(scoreRiasec(answers)).toEqual({ R: 3, I: 3, A: 3, S: 3, E: 3, C: 3 });
  });

  it('isolates a single dimension when only its 8 items are answered', () => {
    const answers: Record<number, number> = {};
    for (let i = 1; i <= 8; i++) answers[i] = 5;
    const out = scoreRiasec(answers);
    expect(out.R).toBe(5);
    expect(out.I).toBe(0);
    expect(out.A).toBe(0);
    expect(out.S).toBe(0);
    expect(out.E).toBe(0);
    expect(out.C).toBe(0);
  });

  it('maps each block of 8 IDs to the correct dimension', () => {
    expect(scoreRiasec({ 9: 4 }).I).toBe(4);
    expect(scoreRiasec({ 17: 4 }).A).toBe(4);
    expect(scoreRiasec({ 25: 4 }).S).toBe(4);
    expect(scoreRiasec({ 33: 4 }).E).toBe(4);
    expect(scoreRiasec({ 41: 4 }).C).toBe(4);
  });

  it('ignores out-of-range item IDs', () => {
    expect(scoreRiasec({ 49: 5 })).toEqual({ R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 });
    expect(scoreRiasec({ 0: 5 })).toEqual({ R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 });
    expect(scoreRiasec({ 100: 5 })).toEqual({ R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 });
  });

  it('averages partial answers within a dimension', () => {
    expect(scoreRiasec({ 1: 5, 2: 5, 3: 5, 4: 5 }).R).toBe(5);
    expect(scoreRiasec({ 1: 5, 2: 1 }).R).toBe(3);
  });
});

describe('hollandCode', () => {
  it('returns the top 3 dimensions sorted by score descending', () => {
    expect(hollandCode({ R: 1, I: 5, A: 4, S: 3, E: 2, C: 0 })).toBe('IAS');
  });

  it('always returns exactly 3 letters', () => {
    expect(hollandCode({ R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 })).toHaveLength(3);
    expect(hollandCode({ R: 5, I: 5, A: 5, S: 5, E: 5, C: 5 })).toHaveLength(3);
  });

  it('only contains valid Holland letters', () => {
    const code = hollandCode({ R: 4, I: 2, A: 5, S: 3, E: 1, C: 0 });
    for (const letter of code) {
      expect('RIASEC').toContain(letter);
    }
  });
});

describe('scoreScct', () => {
  it('returns zero for every group on empty input', () => {
    expect(scoreScct({})).toEqual({
      self_efficacy: 0,
      outcome_expectations: 0,
      perceived_barriers: 0
    });
  });

  it('groups items 1-4 → self_efficacy, 5-8 → outcome_expectations, 9-12 → perceived_barriers', () => {
    const answers = {
      1: 4, 2: 4, 3: 4, 4: 4,
      5: 3, 6: 3, 7: 3, 8: 3,
      9: 2, 10: 2, 11: 2, 12: 2
    };
    expect(scoreScct(answers)).toEqual({
      self_efficacy: 4,
      outcome_expectations: 3,
      perceived_barriers: 2
    });
  });

  it('averages only items present in each group', () => {
    expect(scoreScct({ 1: 5 }).self_efficacy).toBe(5);
    expect(scoreScct({ 1: 5 }).outcome_expectations).toBe(0);
    expect(scoreScct({ 1: 5, 2: 1 }).self_efficacy).toBe(3);
  });
});

describe('recommend', () => {
  it('returns at most 6 courses and 6 careers', () => {
    const scores = { R: 3, I: 3, A: 3, S: 3, E: 3, C: 3 };
    const { courses, careers } = recommend(scores);
    expect(courses.length).toBeLessThanOrEqual(6);
    expect(careers.length).toBeLessThanOrEqual(6);
  });

  it('clamps every match score to 99 or below', () => {
    const scores = { R: 5, I: 5, A: 5, S: 5, E: 5, C: 5 };
    const { courses, careers } = recommend(scores);
    for (const c of courses) expect(c.match).toBeLessThanOrEqual(99);
    for (const c of careers) expect(c.match).toBeLessThanOrEqual(99);
  });

  it('sorts results by match score descending', () => {
    const scores = { R: 2, I: 5, A: 1, S: 3, E: 2, C: 1 };
    const { courses, careers } = recommend(scores);
    for (let i = 1; i < courses.length; i++) {
      expect(courses[i - 1].match).toBeGreaterThanOrEqual(courses[i].match);
    }
    for (let i = 1; i < careers.length; i++) {
      expect(careers[i - 1].match).toBeGreaterThanOrEqual(careers[i].match);
    }
  });

  it('puts an Investigative-leaning course at the top for an I-dominant profile', () => {
    const scores = { R: 1, I: 5, A: 1, S: 1, E: 1, C: 1 };
    expect(recommend(scores).courses[0].name).toBe('BS Computer Science');
  });

  it('puts an Investigative-leaning career at the top for an I-dominant profile', () => {
    const scores = { R: 1, I: 5, A: 1, S: 1, E: 1, C: 1 };
    const top = recommend(scores).careers[0].name;
    expect(['Software Engineer', 'Data Analyst']).toContain(top);
  });

  it('puts a Social-leaning career at the top for an S-dominant profile', () => {
    const scores = { R: 1, I: 1, A: 1, S: 5, E: 1, C: 1 };
    expect(recommend(scores).careers[0].name).toBe('Clinical Psychologist');
  });

  it('boosts STEM-aligned courses when the strand is STEM', () => {
    const baseline = { R: 3, I: 3, A: 3, S: 3, E: 3, C: 3 };
    const csNoStrand = recommend(baseline).courses.find(c => c.name === 'BS Computer Science');
    const csStem = recommend(baseline, 'STEM').courses.find(c => c.name === 'BS Computer Science');
    expect(csStem!.match).toBeGreaterThan(csNoStrand!.match);
  });

  it('does not boost when no strand is given', () => {
    const baseline = { R: 3, I: 3, A: 3, S: 3, E: 3, C: 3 };
    const noStrand = recommend(baseline).courses.find(c => c.name === 'BS Computer Science')!;
    const explicitNull = recommend(baseline, null).courses.find(c => c.name === 'BS Computer Science')!;
    expect(noStrand.match).toBe(explicitNull.match);
  });

  it('preserves the reason and note strings in the output', () => {
    const scores = { R: 3, I: 3, A: 3, S: 3, E: 3, C: 3 };
    const { courses, careers } = recommend(scores);
    expect(courses[0].reason).toBeTruthy();
    expect(careers[0].note).toBeTruthy();
  });
});
