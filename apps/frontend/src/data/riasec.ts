export type RiasecDim = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';

export const RIASEC_LABELS: Record<RiasecDim, string> = {
  R: 'Realistic',
  I: 'Investigative',
  A: 'Artistic',
  S: 'Social',
  E: 'Enterprising',
  C: 'Conventional'
};

export type RiasecItem = { id: number; dim: RiasecDim; prompt: string; section: string };

// 48 items — 8 per dimension.
const BASE: Array<[RiasecDim, string]> = [
  ['R', 'I enjoy fixing machines or tools.'],
  ['R', 'I like building practical things with my hands.'],
  ['R', 'I prefer outdoor technical work over desk work.'],
  ['R', 'I am interested in operating equipment safely.'],
  ['R', 'I like solving physical or mechanical problems.'],
  ['R', 'I enjoy step-by-step work that produces visible results.'],
  ['R', 'I can focus on tasks that require precision and safety.'],
  ['R', 'I would enjoy a job involving tools, systems, or machinery.'],

  ['I', 'I like analyzing data to find patterns.'],
  ['I', 'I enjoy science and research activities.'],
  ['I', 'I like asking why things work the way they do.'],
  ['I', 'I enjoy reading about new discoveries and technologies.'],
  ['I', 'I like solving complex logic problems.'],
  ['I', 'I enjoy designing experiments or testing ideas.'],
  ['I', 'I am curious about math, systems, and evidence.'],
  ['I', 'I prefer evidence-based decisions over guesses.'],

  ['A', 'I enjoy creating designs, visuals, or original content.'],
  ['A', 'I like expressing ideas through art, writing, or media.'],
  ['A', 'I enjoy creative projects with flexible rules.'],
  ['A', 'I like brainstorming unique concepts.'],
  ['A', 'I enjoy improving the look and feel of products.'],
  ['A', 'I like combining imagination with communication.'],
  ['A', 'I am motivated by originality and innovation.'],
  ['A', 'I enjoy presenting creative work to others.'],

  ['S', 'I enjoy helping people solve personal or school problems.'],
  ['S', 'I like teaching or guiding others.'],
  ['S', 'I prefer work that contributes to community well-being.'],
  ['S', 'I am patient when listening to others.'],
  ['S', 'I enjoy teamwork and collaboration.'],
  ['S', 'I like mentoring younger students or peers.'],
  ['S', 'I feel fulfilled when I support others.'],
  ['S', 'I can communicate clearly in person.'],

  ['E', 'I like leading projects and making decisions.'],
  ['E', 'I enjoy persuading others to support ideas.'],
  ['E', 'I am motivated by goals, growth, and achievement.'],
  ['E', 'I like initiating plans and opportunities.'],
  ['E', 'I enjoy business or management topics.'],
  ['E', 'I am comfortable speaking in front of groups.'],
  ['E', 'I like taking responsibility for outcomes.'],
  ['E', 'I enjoy negotiating and strategic planning.'],

  ['C', 'I prefer organized tasks with clear procedures.'],
  ['C', 'I like checking details for accuracy.'],
  ['C', 'I enjoy working with records, numbers, or schedules.'],
  ['C', 'I like following systems and standards.'],
  ['C', 'I am reliable in completing tasks on time.'],
  ['C', 'I prefer structured environments over unpredictable ones.'],
  ['C', 'I enjoy planning and documenting work carefully.'],
  ['C', 'I am comfortable with administrative or clerical tasks.']
];

export const RIASEC_ITEMS: RiasecItem[] = BASE.map(([dim, prompt], i) => ({
  id: i + 1,
  dim,
  prompt,
  section:
    i < 16
      ? 'Section 1: Activities and tasks'
      : i < 32
      ? 'Section 2: Activities you might enjoy'
      : 'Section 3: Your working style'
}));
