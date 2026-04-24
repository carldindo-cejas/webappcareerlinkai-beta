// Seed corpus for the Vectorize knowledge base.
// Kept standalone (no frontend imports) so the worker remains independent.

import { LABELS } from './ml/predictorMap';
import { embedBatch, type AiBindings } from './ai';

export type KnowledgeDoc = { id: string; text: string; kind: string; sourceUrl?: string };

const STRANDS: Array<{ code: string; name: string; text: string }> = [
  {
    code: 'STEM',
    name: 'Science, Technology, Engineering & Math',
    text: 'The STEM strand (Science, Technology, Engineering & Math) is for senior high school students bound for science, computing, engineering, or health professions. It emphasizes advanced math, physics, biology, chemistry, and research methods and prepares students for BS Engineering, BS Nursing, BS Computer Science, and related courses.'
  },
  {
    code: 'ABM',
    name: 'Accountancy, Business & Management',
    text: 'The ABM strand (Accountancy, Business & Management) is designed for future entrepreneurs, accountants, marketers, and business leaders. It covers financial management, business ethics, marketing, and economics, and leads into BS Accountancy, BS Business Administration, and BS Entrepreneurship.'
  },
  {
    code: 'HUMSS',
    name: 'Humanities & Social Sciences',
    text: 'The HUMSS strand (Humanities & Social Sciences) prepares aspiring teachers, lawyers, journalists, psychologists, and public servants. It covers disciplines like philosophy, political science, communication, and social sciences, and leads into AB Psychology, AB Political Science, BS Education, and Law.'
  },
  {
    code: 'ICT',
    name: 'Information and Communications Technology',
    text: 'The ICT strand (Information and Communications Technology) is for students focused on programming, digital systems, networking, and tech support pathways. It builds hands-on skills in computer programming, web design, and technical support, and leads into BS Information Technology, BS Computer Science, and technical-vocational ICT certifications.'
  },
  {
    code: 'HE',
    name: 'Home Economics',
    text: 'The HE strand (Home Economics, under TVL) prepares students for hospitality, culinary, caregiving, and service-oriented careers. It develops practical skills in cooking, hotel and restaurant service, caregiving, dressmaking, and cosmetology, leading into BS Hospitality Management, BS Tourism, and TESDA-certified careers.'
  }
];

const RIASEC_DIMS: Array<{ code: string; name: string; text: string }> = [
  {
    code: 'R',
    name: 'Realistic',
    text: 'Realistic (R) people in the Holland/RIASEC model enjoy hands-on, practical work: fixing machines, building things, operating equipment, and outdoor technical work. They prefer tangible results over abstract theory. Matching careers include engineering, skilled trades, agriculture, and technical fields.'
  },
  {
    code: 'I',
    name: 'Investigative',
    text: 'Investigative (I) people enjoy analysis, research, and evidence-based thinking. They like asking why, solving logic problems, and exploring science, math, or systems. Matching careers include scientist, data analyst, researcher, doctor, and software developer.'
  },
  {
    code: 'A',
    name: 'Artistic',
    text: 'Artistic (A) people enjoy creativity, original expression, and flexible, unstructured work. They like design, writing, media, and presenting creative work. Matching careers include graphic designer, multimedia artist, writer, and performer.'
  },
  {
    code: 'S',
    name: 'Social',
    text: 'Social (S) people enjoy helping, teaching, mentoring, and working with others. They are patient listeners who value community and teamwork. Matching careers include teacher, counselor, nurse, social worker, and therapist.'
  },
  {
    code: 'E',
    name: 'Enterprising',
    text: 'Enterprising (E) people enjoy leadership, persuasion, and goal-driven work. They like initiating plans, managing teams, public speaking, and business. Matching careers include manager, entrepreneur, marketing lead, lawyer, and sales professional.'
  },
  {
    code: 'C',
    name: 'Conventional',
    text: 'Conventional (C) people enjoy organized, structured work with clear procedures. They value accuracy, documentation, and reliability. Matching careers include accountant, auditor, administrator, bookkeeper, and quality analyst.'
  }
];

const SCCT_CONSTRUCTS: Array<{ code: string; name: string; text: string }> = [
  {
    code: 'self_efficacy',
    name: 'Self-efficacy',
    text: 'Self-efficacy in SCCT (Social Cognitive Career Theory) is your belief in your own capacity to succeed in a chosen career path. Students with higher self-efficacy take on challenges, persist through difficulty, and believe they can learn new skills. Low self-efficacy can be strengthened through small wins, mentorship, and deliberate skill practice.'
  },
  {
    code: 'outcome_expectations',
    name: 'Outcome expectations',
    text: 'Outcome expectations in SCCT are what students believe will happen if they pursue a path: will it lead to good opportunities, meaningful work, and a better quality of life? Positive outcome expectations motivate effort. They are shaped by role models, family stories, and accurate information about careers.'
  },
  {
    code: 'perceived_barriers',
    name: 'Perceived barriers',
    text: 'Perceived barriers in SCCT are the obstacles a student believes stand between them and their desired career: financial limits, family pressure, lack of resources, or limited access to opportunities. Naming these barriers helps counselors recommend concrete supports like scholarships, TESDA certifications, or financial aid programs.'
  }
];

export const SCCT_QUESTIONS: Array<{ id: number; construct: string; prompt: string }> = [
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

const ABOUT_DOC = {
  id: 'about:careerlinkai',
  kind: 'about',
  text: 'CareerLinkAI is a career counseling tool for senior high school students in the Philippines. It uses the users academic profile (grades), senior-high strand (STEM, ABM, HUMSS, ICT/TVL, HE),  Holland/RIASEC personality model plus SCCT (Social Cognitive Career Theory) to recommend a college course, and a career path. An AI counselor answers follow-up questions about strand choice, college courses, Philippine universities, and study habits.',

};

const CUSTOM_KNOWLEDGE: KnowledgeDoc[] = [

];

const SCHOLARSHIP_PROVIDER_SOURCE_URLS: string[] = [
  'https://ched.gov.ph', 'https://unifast.gov.ph', 'https://sei.dost.gov.ph', 'https://owwa.gov.ph', 'https://gsis.gov.ph', 'https://doh.gov.ph', 'https://tesda.gov.ph', 'https://dswd.gov.ph', 'https://dar.gov.ph', 'https://afpslai.com.ph', 'https://sm-foundation.org', 'https://gokongweibrothersfoundation.org', 'https://ayalafoundation.org', 'https://mbfoundation.org.ph', 'https://aboitizfoundation.org', 'https://megaworldfoundation.com', 'https://bpifoundation.org', 'https://phinmafoundation.org', 'https://securitybank.com', 'https://landbank.com', 'https://foundation.jollibeegroup.com', 'https://pilipinasshellfoundation.org', 'https://mercurydrug.com', 'https://panasonic.com', 'https://vicsalfoundation.com', 'https://grab.com', 'https://pvao.gov.ph',
];

const SCHOOL_SOURCE_URLS: string[] = [
'https://up.edu.ph', 'https://pup.edu.ph', 'https://pnu.edu.ph', 'https://tup.edu.ph', 'https://mmsu.edu.ph', 'https://unp.edu.ph', 'https://dmmmsu.edu.ph', 'https://ispsc.edu.ph', 'https://psu.edu.ph', 'https://bsu.edu.ph', 'https://csu.edu.ph', 'https://isu.edu.ph', 'https://nvsu.edu.ph', 'https://qsu.edu.ph', 'https://bpsu.edu.ph', 'https://bulsu.edu.ph', 'https://clsu.edu.ph', 'https://dhvsu.edu.ph', 'https://neust.edu.ph', 'https://psau.edu.ph', 'https://prmsu.edu.ph', 'https://tau.edu.ph', 'https://tsu.edu.ph', 'https://batstate-u.edu.ph', 'https://cvsu.edu.ph', 'https://lspu.edu.ph', 'https://slsu.edu.ph', 'https://msc.edu.ph', 'https://omsc.edu.ph', 'https://palsu.edu.ph', 'https://rsu.edu.ph', 'https://wpu.edu.ph', 'https://bicol-u.edu.ph', 'https://cspc.edu.ph', 'https://parsu.edu.ph', 'https://sorsu.edu.ph', 'https://asu.edu.ph', 'https://capizsu.edu.ph', 'https://isat-u.edu.ph', 'https://wvsu.edu.ph', 'https://chmsu.edu.ph', 'https://bisu.edu.ph', 'https://cnu.edu.ph', 'https://ctu.edu.ph', 'https://norsu.edu.ph', 'https://essu.edu.ph', 'https://evsu.edu.ph', 'https://lnu.edu.ph', 'https://nsu.edu.ph', 'https://nwssu.edu.ph', 'https://vsu.edu.ph', 'https://ssu.edu.ph', 'https://uep.edu.ph', 'https://msu.edu.ph', 'https://msuiit.edu.ph', 'https://wmsu.edu.ph', 'https://cmu.edu.ph', 'https://ustp.edu.ph', 'https://dnsc.edu.ph', 'https://usep.edu.ph', 'https://sksu.edu.ph', 'https://usm.edu.ph', 'https://carsu.edu.ph', 'https://snsu.edu.ph', 'https://ifsu.edu.ph', 'https://ksu.edu.ph', 'https://mpspc.edu.ph', 'https://asc.edu.ph', 'https://plm.edu.ph', 'https://udm.edu.ph', 'https://qcu.edu.ph', 'https://ucc.edu.ph', 'https://pcc.edu.ph', 'https://ucu.edu.ph', 'https://bcc.edu.ph', 'https://ccc.edu.ph', 'https://www.ateneo.edu', 'https://www.dlsu.edu.ph', 'https://www.ust.edu.ph', 'https://www.feu.edu.ph', 'https://www.ue.edu.ph', 'https://www.mapua.edu.ph', 'https://www.adamson.edu.ph', 'https://www.ceu.edu.ph', 'https://www.lpu.edu.ph', 'https://www.sanbeda.edu.ph', 'https://www.addu.edu.ph', 'https://www.adzu.edu.ph', 'https://www.xu.edu.ph', 'https://www.silliman.edu.ph', 'https://www.usc.edu.ph', 'https://www.usls.edu.ph', 'https://www.cpu.edu.ph', 'https://www.uap.asia', 'https://www.mc.edu.ph', 'https://www.benilde.edu.ph', 'https://www.iacademy.edu.ph', 'https://www.enderuncolleges.com', 'https://www.southville.edu.ph', 'https://www.sti.edu', 'https://www.ama.edu.ph', 'https://www.nu.edu.ph', 'https://www.hau.edu.ph', 'https://www.auf.edu.ph', 'https://www.ubaguio.edu', 'https://www.slu.edu.ph', 'https://www.uic.edu.ph', 'https://www.umindanao.edu.ph', 'https://www.usjr.edu.ph', 'https://www.cit.edu', 'https://www.pwu.edu.ph', 'https://www.letran.edu.ph', 'https://www.jru.edu', 'https://www.arellano.edu.ph', 'https://www.stdominiccollege.edu.ph', 'https://www.lorma.edu', 'https://www.nwu.edu.ph', 'https://www.panpacificu.edu.ph', 'https://www.vmu.edu.ph', 'https://www.tua.edu.ph', 'https://www.spup.edu.ph', 'https://www.assumption.edu.ph', 'https://www.mcl.edu.ph', 'https://www.pcu.edu.ph', 'https://www.philska.edu.ph', 'https://www.pmma.edu.ph', 'https://www.maap.edu.ph', 'https://www.feati.edu.ph', 'https://www.tip.edu.ph', 'https://www.dlsud.edu.ph', 'https://www.uphsl.edu.ph', 'https://www.uphsd.edu.ph', 'https://www.ndu.edu.ph', 'https://www.dlsl.edu.ph', 'https://www.fatima.edu.ph', 'https://www.mcu.edu.ph', 'https://www.baliuagu.edu.ph', 'https://www.wesleyan.edu.ph', 'https://www.lcup.edu.ph', 'https://pma.edu.ph', 'https://pnpa.edu.ph', 'https://pmma.edu.ph', 'https://www.maap.edu.ph', 'https://pafffs.edu.ph', 'https://npc.edu.ph', 'https://www.ndcp.edu.ph', 'https://pamma.edu.ph', 'https://www.nykmf.com.ph', 'https://www.umtc.com.ph', 'https://www.magsaysaytraining.com', 'https://www.vma.edu.ph', 'https://www.pntc.edu.ph', 'https://www.aet-tankers.com', 'https://www.omniflyingacademy.com', 'https://www.airworksph.com', 'https://www.mastersflying.com', 'https://www.alphaviation.com', 'https://www.fast.com.ph',
];

const SOURCE_CHUNK_CHARS = 1200;
const SOURCE_MAX_CHUNKS_PER_URL = 8;
const SOURCE_MAX_TEXT_CHARS = SOURCE_CHUNK_CHARS * SOURCE_MAX_CHUNKS_PER_URL;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function htmlToText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return normalizeWhitespace(decodeHtmlEntities(stripped));
}

function normalizeSourceUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
      const u = new URL(candidate);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      const normalized = u.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    } catch {
      // Ignore invalid URLs.
    }
  }
  return out;
}

function chunkText(text: string, chunkChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > chunkChars && current) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

async function buildWebSourceDocs(urls: string[]): Promise<KnowledgeDoc[]> {
  const docs: KnowledgeDoc[] = [];

  for (const sourceUrl of urls) {
    try {
      const res = await fetch(sourceUrl, { redirect: 'follow' });
      if (!res.ok) {
        console.warn(`source fetch failed (${res.status})`, sourceUrl);
        continue;
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('text/html') && !contentType.startsWith('text/')) {
        console.warn('source content-type unsupported', sourceUrl, contentType);
        continue;
      }

      const body = await res.text();
      const extracted = contentType.includes('text/html') ? htmlToText(body) : normalizeWhitespace(body);
      if (!extracted) continue;

      const chunks = chunkText(extracted.slice(0, SOURCE_MAX_TEXT_CHARS), SOURCE_CHUNK_CHARS)
        .slice(0, SOURCE_MAX_CHUNKS_PER_URL);
      const sourceId = `${slug(sourceUrl)}-${hashString(sourceUrl)}`;

      for (let i = 0; i < chunks.length; i++) {
        docs.push({
          id: `source:${sourceId}:${i + 1}`,
          kind: 'source-web',
          sourceUrl,
          text: `Web source excerpt ${i + 1} from ${sourceUrl}: ${chunks[i]}`
        });
      }
    } catch (err) {
      console.warn('source fetch failed', sourceUrl, err);
    }
  }

  return docs;
}

export function buildKnowledgeCorpus(): KnowledgeDoc[] {
  const docs: KnowledgeDoc[] = [];

  docs.push(ABOUT_DOC);
  docs.push(...CUSTOM_KNOWLEDGE);

  for (const s of STRANDS) {
    docs.push({ id: `strand:${s.code}`, kind: 'strand', text: s.text });
  }
  for (const d of RIASEC_DIMS) {
    docs.push({ id: `riasec:${d.code}`, kind: 'riasec', text: d.text });
  }
  for (const c of SCCT_CONSTRUCTS) {
    docs.push({ id: `scct:${c.code}`, kind: 'scct', text: c.text });
  }

  for (const q of SCCT_QUESTIONS) {
    docs.push({
      id: `scct-question:${q.id}`,
      kind: 'scct-question',
      text: `SCCT question ${q.id} (${q.construct}): ${q.prompt}`
    });
  }

  const seenCourse = new Set<string>();
  const seenCareer = new Set<string>();
  for (const label of LABELS) {
    const courseKey = slug(label.course);
    if (!seenCourse.has(courseKey)) {
      seenCourse.add(courseKey);
      docs.push({
        id: `course:${courseKey}`,
        kind: 'course',
        text: `${label.course} is a college course commonly recommended in CareerLinkAI for students whose profile suggests ${label.career} as a top career. Study it if you are interested in the ${label.career} path.`
      });
    }
    const careerKey = slug(label.career);
    if (!seenCareer.has(careerKey)) {
      seenCareer.add(careerKey);
      docs.push({
        id: `career:${careerKey}`,
        kind: 'career',
        text: `${label.career} is a career commonly matched by CareerLinkAI to students who pursue ${label.course}. It fits students whose RIASEC profile and academic subjects align with this professional path.`
      });
    }
  }

  return docs;
}

export type SeedResult = {
  total: number;
  upserted: number;
  failedBatches: number;
  sourceUrls: number;
  sourceDocs: number;
};

export async function seedKnowledge(env: AiBindings, extraSourceUrls: string[] = []): Promise<SeedResult> {
  const baseDocs = buildKnowledgeCorpus();
  const defaultSourceUrls = [
    ...SCHOLARSHIP_PROVIDER_SOURCE_URLS,
    ...SCHOOL_SOURCE_URLS
  ];
  const sourceUrls = normalizeSourceUrls([...defaultSourceUrls, ...extraSourceUrls]);
  const webDocs = await buildWebSourceDocs(sourceUrls);
  const docs = [...baseDocs, ...webDocs];
  const BATCH = 16;
  let upserted = 0;
  let failedBatches = 0;

  for (let i = 0; i < docs.length; i += BATCH) {
    const chunk = docs.slice(i, i + BATCH);
    const vectors = await embedBatch(env, chunk.map(d => d.text));
    if (!vectors || vectors.length !== chunk.length) {
      failedBatches++;
      continue;
    }
    const payload = chunk.map((d, idx) => ({
      id: d.id,
      values: vectors[idx],
      metadata: {
        text: d.text,
        kind: d.kind,
        ...(d.sourceUrl ? { source_url: d.sourceUrl } : {})
      }
    }));
    try {
      await env.KNOWLEDGE.upsert(payload as any);
      upserted += payload.length;
    } catch (err) {
      console.warn('KNOWLEDGE.upsert batch failed', err);
      failedBatches++;
    }
  }

  return {
    total: docs.length,
    upserted,
    failedBatches,
    sourceUrls: sourceUrls.length,
    sourceDocs: webDocs.length
  };
}
