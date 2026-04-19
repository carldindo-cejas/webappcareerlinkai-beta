import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(
    import.meta.url)), '..');
const csvPath = path.resolve(ROOT, '..', 'predictor', 'career_suggestion.csv');
const outPath = path.resolve(ROOT, 'src', 'ml', 'predictorMap.ts');

const SUBJECTS = ['Math', 'Science', 'English'];
const STRANDS = ['STEM', 'ABM', 'HUMSS', 'ICT', 'HE'];
const TOP_K = 6;

function indexOfOrThrow(arr, value, label) {
    const idx = arr.indexOf(value);
    if (idx < 0) throw new Error(`Unknown ${label}: ${value}`);
    return idx;
}

const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.split(/\r?\n/).filter(Boolean);
if (lines.length < 2) throw new Error('CSV has no rows');

const header = lines[0].split(',');
const col = Object.fromEntries(header.map((h, i) => [h, i]));

for (const required of[
        'best_subject',
        'shs_strand',
        'holland_code',
        'scct_se',
        'scct_oe',
        'scct_b',
        'best_career',
        'best_course'
    ]) {
    if (!(required in col)) throw new Error(`Missing required column: ${required}`);
}

const hollandSet = new Set();
const labels = [];
const labelToId = new Map();
const rows = [];

for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length !== header.length) continue;

    const best_subject = parts[col.best_subject];
    const shs_strand = parts[col.shs_strand];
    const holland_code = parts[col.holland_code];
    const scct_se = Number(parts[col.scct_se]);
    const scct_oe = Number(parts[col.scct_oe]);
    const scct_b = Number(parts[col.scct_b]);
    const best_career = parts[col.best_career];
    const best_course = parts[col.best_course];

    hollandSet.add(holland_code);

    const labelKey = `${best_career}|||${best_course}`;
    let labelId = labelToId.get(labelKey);
    if (labelId === undefined) {
        labelId = labels.length;
        labels.push({ career: best_career, course: best_course });
        labelToId.set(labelKey, labelId);
    }

    rows.push({ best_subject, shs_strand, holland_code, scct_se, scct_oe, scct_b, labelId });
}

const HOLLAND_CODES = [...hollandSet].sort();
const TOTAL = SUBJECTS.length * STRANDS.length * HOLLAND_CODES.length * 5 * 5 * 5;
const classIds = new Uint16Array(TOTAL);
classIds.fill(65535);

const BASE_TOTAL = SUBJECTS.length * STRANDS.length * HOLLAND_CODES.length;
const baseTopLabelIds = new Uint16Array(BASE_TOTAL * TOP_K);
baseTopLabelIds.fill(65535);
const baseTopCounts = new Uint8Array(BASE_TOTAL * TOP_K);

const holIdx = Object.fromEntries(HOLLAND_CODES.map((c, i) => [c, i]));

function toIndex(subject, strand, holland, se, oe, b) {
    const s = indexOfOrThrow(SUBJECTS, subject, 'subject');
    const st = indexOfOrThrow(STRANDS, strand, 'strand');
    const h = holIdx[holland];
    if (h === undefined) throw new Error(`Unknown holland: ${holland}`);
    if (se < 1 || se > 5 || oe < 1 || oe > 5 || b < 1 || b > 5) {
        throw new Error('SCCT values must be in [1,5]');
    }
    return (((((s * STRANDS.length + st) * HOLLAND_CODES.length + h) * 5 + (se - 1)) * 5 + (oe - 1)) * 5 + (b - 1));
}

function toBaseIndex(subject, strand, holland) {
    const s = indexOfOrThrow(SUBJECTS, subject, 'subject');
    const st = indexOfOrThrow(STRANDS, strand, 'strand');
    const h = holIdx[holland];
    if (h === undefined) throw new Error(`Unknown holland: ${holland}`);
    return ((s * STRANDS.length + st) * HOLLAND_CODES.length + h);
}

for (const r of rows) {
    const idx = toIndex(r.best_subject, r.shs_strand, r.holland_code, r.scct_se, r.scct_oe, r.scct_b);
    classIds[idx] = r.labelId;
}

const baseCounts = new Map();
for (const r of rows) {
    const baseIndex = toBaseIndex(r.best_subject, r.shs_strand, r.holland_code);
    const key = `${baseIndex}:${r.labelId}`;
    const current = baseCounts.get(key);
    baseCounts.set(key, (current === undefined ? 0 : current) + 1);
}

for (let baseIndex = 0; baseIndex < BASE_TOTAL; baseIndex++) {
    const ranked = [];
    for (let labelId = 0; labelId < labels.length; labelId++) {
        const current = baseCounts.get(`${baseIndex}:${labelId}`);
        const count = current === undefined ? 0 : current;
        if (count > 0) ranked.push({ labelId, count });
    }
    ranked.sort((a, b) => b.count - a.count || a.labelId - b.labelId);

    for (let i = 0; i < TOP_K; i++) {
        const row = ranked[i];
        if (!row) break;
        const outIdx = baseIndex * TOP_K + i;
        baseTopLabelIds[outIdx] = row.labelId;
        baseTopCounts[outIdx] = row.count;
    }
}

let missing = 0;
for (let i = 0; i < classIds.length; i++) {
    if (classIds[i] === 65535) missing++;
}
if (missing > 0) {
    throw new Error(`Map has ${missing} missing combinations`);
}

const base64 = Buffer.from(classIds.buffer).toString('base64');
const baseTopLabelIdsBase64 = Buffer.from(baseTopLabelIds.buffer).toString('base64');
const baseTopCountsBase64 = Buffer.from(baseTopCounts.buffer).toString('base64');

const content = `/* AUTO-GENERATED by scripts/build-predictor-map.mjs. DO NOT EDIT. */
export const SUBJECTS = ${JSON.stringify(SUBJECTS)} as const;
export const STRANDS = ${JSON.stringify(STRANDS)} as const;
export const HOLLAND_CODES = ${JSON.stringify(HOLLAND_CODES)} as const;

export const LABELS = ${JSON.stringify(labels, null, 2)} as const;

export const CLASS_IDS_BASE64 = '${base64}';
export const TOP_K = ${TOP_K};
export const BASE_TOP_LABEL_IDS_BASE64 = '${baseTopLabelIdsBase64}';
export const BASE_TOP_COUNTS_BASE64 = '${baseTopCountsBase64}';
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log(`Wrote ${outPath}`);
console.log(`Rows parsed: ${rows.length}`);
console.log(`Unique labels: ${labels.length}`);
console.log(`Holland codes: ${HOLLAND_CODES.length}`);
console.log(`Map length: ${classIds.length}`);