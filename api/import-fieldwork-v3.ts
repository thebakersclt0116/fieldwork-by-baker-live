import { extractText, extractTextItems, getDocumentProxy } from 'unpdf';
import { canUsePaidTools, requireSession } from './_auth.js';
import v2Handler from './import-fieldwork-v2.js';

const VERSION = 'ripley-monthly-v4-2026-09-13';
const MAX_BASE64_LENGTH = 3_150_000;
const MAX_PDF_PAGES = 25;
const TIMEOUT_MS = 12_000;
const MONTH_NUMBER: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';

type Candidate = { minutes: number; position: number };

type ParsedMonthly = {
  detectedSource: string;
  entries: Array<Record<string, unknown>>;
  warnings: string[];
  provider: string;
  ingestion: string;
  version: string;
};

function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function rawBase64(fileData: string): string {
  const trimmed = fileData.trim();
  if (trimmed.startsWith('data:')) {
    const comma = trimmed.indexOf(',');
    return (comma >= 0 ? trimmed.slice(comma + 1) : '').replace(/\s+/g, '');
  }
  return trimmed.replace(/\s+/g, '');
}

function hm(hours: string | number, minutes: string | number): number | null {
  const h = Number(hours);
  const m = Number(minutes);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 160 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function matchMinutes(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  return match ? hm(match[1], match[2]) : null;
}

function formatMinutes(value: number): string {
  const total = Math.max(0, Math.round(value));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}

function layoutText(pages: any[][]): string {
  return (pages || []).map((page) => {
    const items = (page || [])
      .filter((item: any) => String(item?.str || '').trim())
      .map((item: any) => ({ str: String(item.str).trim(), x: Number(item.x || 0), y: Number(item.y || 0), fontSize: Math.max(1, Number(item.fontSize || 8)) }))
      .sort((a: any, b: any) => (b.y - a.y) || (a.x - b.x));
    const rows: Array<{ y: number; items: typeof items }> = [];
    for (const item of items) {
      const tolerance = Math.max(2.5, Math.min(5, item.fontSize * 0.38));
      let row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
      if (!row) {
        row = { y: item.y, items: [] };
        rows.push(row);
      }
      row.items.push(item);
      row.y = row.items.reduce((sum, value) => sum + value.y, 0) / row.items.length;
    }
    return rows.sort((a, b) => b.y - a.y)
      .map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.str).join(' '))
      .join('\n');
  }).join('\n\n');
}

async function extractPdf(fileData: string): Promise<{ plain: string; layout: string }> {
  const bytes = Buffer.from(rawBase64(fileData), 'base64');
  if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('INVALID_PDF');
  const pdf = await getDocumentProxy(new Uint8Array(bytes), { maxImageSize: 16_777_216 });
  try {
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error('PDF_PAGE_LIMIT');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('PDF_TIMEOUT')), TIMEOUT_MS); });
    const extraction = Promise.all([extractText(pdf, { mergePages: true }), extractTextItems(pdf)]).then(([plainResult, itemResult]) => ({
      plain: (typeof plainResult.text === 'string' ? plainResult.text : plainResult.text.join('\n\n')).replace(/\u0000/g, '').trim(),
      layout: layoutText(itemResult.items as any[][]).replace(/\u0000/g, '').trim(),
    }));
    return await Promise.race([extraction, timeout]).finally(() => { if (timer) clearTimeout(timer); });
  } finally {
    try { await pdf.destroy(); } catch { /* cleanup only */ }
  }
}

function collectCandidates(text: string): Candidate[] {
  const candidates: Candidate[] = [];
  for (const match of text.matchAll(/(\d{1,3})\s*hh\s*(\d{1,2})\s*mm/gi)) {
    const minutes = hm(match[1], match[2]);
    if (minutes !== null) candidates.push({ minutes, position: match.index || 0 });
  }
  const cert = text.match(/\b\d-\d{2}-\d{4}\b/);
  const offset = cert?.index !== undefined ? cert.index + cert[0].length : 0;
  const tail = text.slice(offset);
  for (const match of tail.matchAll(/(?<![\d/-])(\d{1,3})\s+(\d{1,2})(?![\d/-])/g)) {
    const minutes = hm(match[1], match[2]);
    if (minutes !== null) candidates.push({ minutes, position: offset + (match.index || 0) });
  }
  const deduped: Candidate[] = [];
  for (const candidate of candidates.sort((a, b) => a.position - b.position)) {
    if (!deduped.some((existing) => existing.minutes === candidate.minutes)) deduped.push(candidate);
  }
  return deduped;
}

function ratioPair(candidates: Candidate[], percentage: number | null): { total: number | null; supervised: number | null } {
  if (percentage === null) return { total: null, supervised: null };
  let best: { error: number; total: number; supervised: number } | null = null;
  for (const total of candidates) {
    if (total.minutes < 20 * 60 || total.minutes > 160 * 60) continue;
    for (const supervised of candidates) {
      if (supervised.minutes <= 0 || supervised.minutes >= total.minutes) continue;
      const error = Math.abs(supervised.minutes / total.minutes * 100 - percentage);
      if (!best || error < best.error) best = { error, total: total.minutes, supervised: supervised.minutes };
    }
  }
  return best && best.error <= 0.35 ? { total: best.total, supervised: best.supervised } : { total: null, supervised: null };
}

function findSupervisor(layout: string, plain: string, normalized: string): string {
  const direct = normalized.match(/(?:Responsible )?Supervisor Name:\s*([A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){1,3}?)(?=\s+Certification\s*#|\s+\d-\d{2}-\d{4}\b)/i)?.[1];
  if (direct) return direct.trim().slice(0, 120);
  for (const text of [layout, plain]) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const certIndex = lines.findIndex((line) => /\b\d-\d{2}-\d{4}\b/.test(line));
    for (let index = certIndex - 1; certIndex > 0 && index >= Math.max(0, certIndex - 3); index -= 1) {
      const line = lines[index].replace(/^(?:Responsible )?Supervisor Name:\s*/i, '').trim();
      if (/^[A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){1,3}$/.test(line) && !/Certification|United States|North Carolina/i.test(line)) return line.slice(0, 120);
    }
  }
  return 'Not specified';
}

function parseMonthly(source: { plain: string; layout: string }, fileName: string): ParsedMonthly | null {
  const combined = `${source.layout}\n${source.plain}`.replace(/\u00a0/g, ' ');
  const normalized = combined.replace(/\s+/g, ' ').trim();
  if (!/Monthly\s*(?:\||-)?.{0,30}Fieldwork Verification Form/i.test(normalized)) return null;

  const month = normalized.match(new RegExp(`Month\\/Year:\\s*(${MONTHS})\\s+(20\\d{2})`, 'i'))
    || normalized.match(new RegExp(`\\b(${MONTHS})\\s+(20\\d{2})\\b`, 'i'));
  if (!month) return null;
  const monthNumber = MONTH_NUMBER[month[1].toLowerCase()];
  if (!monthNumber) return null;

  const percentMatch = normalized.match(/Percentage of Hours Supervised\s*([0-9]+(?:\.[0-9]+)?)%/i)
    || normalized.match(/([0-9]+(?:\.[0-9]+)?)%/);
  const percentage = percentMatch ? Number(percentMatch[1]) : null;
  const candidates = collectCandidates(combined);
  const pair = ratioPair(candidates, percentage);

  let total = matchMinutes(normalized, /Total Fieldwork Hours\s*(\d{1,3})\s*hh\s*(\d{1,2})\s*mm/i) ?? pair.total;
  let supervised = matchMinutes(normalized, /B\. Supervised Hours \(supervisor present\):\s*(\d{1,3})\s*hh\s*(\d{1,2})\s*mm/i) ?? pair.supervised;
  let independent = matchMinutes(normalized, /A\. Independent Hours \(supervisor not present\):\s*(\d{1,3})\s*hh\s*(\d{1,2})\s*mm/i);
  let observation = matchMinutes(normalized, /These fieldwork hours include\s*(\d{1,3})\s*hh\s*(\d{1,2})\s*mm\s*of observation/i);

  if (total === null && candidates.length) total = Math.max(...candidates.map((candidate) => candidate.minutes));
  if (total === null || total <= 0 || total > 160 * 60) return null;

  if (supervised === null && percentage !== null) {
    const expected = total * percentage / 100;
    const close = candidates.filter((candidate) => candidate.minutes > 0 && candidate.minutes < total)
      .sort((a, b) => Math.abs(a.minutes - expected) - Math.abs(b.minutes - expected))[0];
    if (close && Math.abs(close.minutes - expected) <= 5) supervised = close.minutes;
  }
  if (independent === null && supervised !== null) {
    const expected = total - supervised;
    const close = candidates.filter((candidate) => candidate.minutes !== total && candidate.minutes !== supervised)
      .sort((a, b) => Math.abs(a.minutes - expected) - Math.abs(b.minutes - expected))[0];
    independent = close && Math.abs(close.minutes - expected) <= 5 ? close.minutes : Math.max(0, Math.round(expected));
  }
  if (observation === null) {
    const used = new Set([total, supervised, independent].filter((value): value is number => value !== null));
    observation = candidates.map((candidate) => candidate.minutes)
      .filter((minutes) => !used.has(minutes) && minutes >= 0 && minutes <= Math.min(600, supervised ?? 600))
      .sort((a, b) => a - b)[0] ?? 0;
  }

  const supervisorName = findSupervisor(source.layout, source.plain, normalized);
  const fieldworkType = /Concentrated Supervised Fieldwork/i.test(normalized) ? 'CONCENTRATED' : 'SUPERVISED';
  const date = `${month[2]}-${monthNumber}-01`;
  const warnings = [
    `${fileName}: monthly aggregate imported without inventing session-level restricted/unrestricted detail; category is Unknown until detailed history is available.`,
    `${fileName}: kept Pending because signatures cannot be reliably verified from the PDF text layer alone.`,
  ];
  if (!/Concentrated Supervised Fieldwork|\bSupervised Fieldwork\b/i.test(normalized)) warnings.push(`${fileName}: fieldwork type is not explicit on the form; Baker used Supervised Fieldwork as the conservative default.`);
  if (independent !== null && supervised !== null) {
    const delta = Math.abs(independent + supervised - total);
    if (delta >= 1) warnings.push(`${fileName}: independent + supervisor-present time differs from the stated total by ${delta} minute(s); source values were preserved.`);
  }

  const notes = [
    'Monthly aggregate imported from source document — not an individual session date.',
    `Source month: ${month[1]} ${month[2]}.`,
    `Total fieldwork: ${formatMinutes(total)}.`,
    independent !== null ? `Independent: ${formatMinutes(independent)}.` : '',
    supervised !== null ? `Supervisor present: ${formatMinutes(supervised)}.` : '',
    `Observation: ${formatMinutes(observation)}.`,
    percentage !== null ? `Source supervision percentage: ${percentage}%.` : '',
    'Restricted/unrestricted activity breakdown is not stated on this monthly verification form.',
  ].filter(Boolean).join(' ');

  return {
    detectedSource: 'BACB Monthly Fieldwork Verification Form (Ripley PDF)',
    entries: [{
      date, startTime: '00:00', endTime: '00:00', duration: Math.round(total / 60 * 10000) / 10000,
      fieldworkType, activityCategory: 'UNKNOWN', activityType: 'UNRESTRICTED_OTHER', supervisorName, setting: '', notes,
      status: 'PENDING', supervisionMinutes: supervised ?? 0, observationMinutes: observation, individualSupervisionMinutes: 0,
      confidence: 0.995, sourceLabel: 'BACB Monthly Fieldwork Verification Form (Ripley PDF)', summaryDerived: true,
    }],
    warnings,
    provider: 'baker-deterministic-form-parser-v4',
    ingestion: 'pdf-positioned-monthly-verification',
    version: VERSION,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') return send(res, 200, { service: 'Baker AI Migration Assistant', status: 'ready', model: 'openai/gpt-5.6-sol', version: VERSION, ripleyMonthlyParser: true, positionalPdfExtraction: true });
  if (req.method !== 'POST') return v2Handler(req, res);

  const session = requireSession(req);
  if (!session) return send(res, 401, { code: 'SESSION_REFRESH_REQUIRED', error: 'Your secure Baker session needs to be refreshed. Sign in again, then retry this import.', version: VERSION });
  if (!canUsePaidTools(session)) return send(res, 403, { code: 'PAID_REQUIRED', error: 'A paid Baker account is required for AI migration.', version: VERSION });

  const fileName = String(req.body?.fileName || 'fieldwork-records').trim().slice(0, 180);
  const fileData = String(req.body?.fileData || '');
  const mimeType = String(req.body?.mimeType || '').toLowerCase().split(';')[0];
  const isPdf = Boolean(fileData) && (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf'));
  if (!isPdf) return v2Handler(req, res);
  if (fileData.length > MAX_BASE64_LENGTH) return send(res, 413, { code: 'FILE_TOO_LARGE', error: 'This PDF is too large for direct import.', version: VERSION });

  try {
    const source = await extractPdf(fileData);
    const parsed = parseMonthly(source, fileName);
    if (parsed) {
      console.info('Baker Ripley monthly v4 parsed', { fileName, version: VERSION, totalHours: parsed.entries[0]?.duration, supervisor: parsed.entries[0]?.supervisorName });
      return send(res, 200, parsed);
    }
    console.warn('Baker Ripley monthly v4 did not match; delegating to general importer', { fileName, version: VERSION, plainChars: source.plain.length, layoutChars: source.layout.length });
    req.body = { ...req.body, rawText: `${source.layout}\n\n${source.plain}`.slice(0, 120_000), fileData: '' };
    return v2Handler(req, res);
  } catch (error) {
    console.warn('Baker Ripley monthly v4 extraction failed; delegating to general importer', { fileName, version: VERSION, error: error instanceof Error ? error.message : 'unknown' });
    return v2Handler(req, res);
  }
}
