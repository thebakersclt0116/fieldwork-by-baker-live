import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import type { HourEntry } from '@/types';
import {
  EMILY_EMAIL,
  appendEntries,
  getCurrentUserEmail,
  hoursBetween,
  inferActivityType,
  inferCategory,
  inferFieldworkType,
  inferStatus,
  loadEntries,
  newId,
  normalizeDate,
  normalizeTime,
} from '@/lib/fieldworkStore';
import { evaluateCompliance } from '@/lib/compliance2027';
import { getStoredAccessToken } from '@/hooks/useAuth';

type AiImportEntry = {
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  fieldworkType: 'SUPERVISED' | 'CONCENTRATED';
  activityCategory: 'RESTRICTED' | 'UNRESTRICTED';
  activityType: HourEntry['activityType'];
  supervisorName: string;
  setting: string;
  notes: string;
  status: 'DRAFT' | 'PENDING' | 'VERIFIED';
  supervisionMinutes: number;
  observationMinutes: number;
  individualSupervisionMinutes: number;
  confidence: number;
  sourceLabel: string;
  summaryDerived: boolean;
};

type MigrationResponse = {
  detectedSource?: string;
  entries?: AiImportEntry[];
  warnings?: string[];
  error?: string;
};

function parseDelimited(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function valueFor(headers: string[], row: string[], aliases: string[]): string {
  for (let index = 0; index < headers.length; index += 1) {
    const header = normalizeHeader(headers[index]);
    const match = aliases.some((alias) => {
      const normalized = normalizeHeader(alias);
      return header === normalized || header.includes(normalized);
    });
    if (match) return String(row[index] || '').trim();
  }
  return '';
}

function numericValue(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildDelimitedEntry(headers: string[], row: string[], email: string, source: string): HourEntry | null {
  const date = normalizeDate(valueFor(headers, row, ['date', 'service date', 'activity date']));
  const startTime = normalizeTime(valueFor(headers, row, ['start time', 'start']));
  const endTime = normalizeTime(valueFor(headers, row, ['end time', 'end']));
  const hoursText = valueFor(headers, row, ['hours', 'duration', 'total hours', 'fieldwork hours']);
  const fieldworkTypeText = valueFor(headers, row, ['fieldwork type', 'type', 'experience']);
  const activity = valueFor(headers, row, ['activity', 'activity type', 'description', 'task']);
  const categoryText = valueFor(headers, row, ['category', 'activity category', 'restricted unrestricted']);
  const supervisor = valueFor(headers, row, ['supervisor', 'supervisor name', 'bcba']);
  const setting = valueFor(headers, row, ['setting', 'location', 'site', 'organization']);
  const notes = valueFor(headers, row, ['notes', 'comments']);
  const statusText = valueFor(headers, row, ['status', 'verification status', 'verified']);
  const supervisionText = valueFor(headers, row, ['supervision minutes', 'supervised minutes', 'supervision min']);
  const observationText = valueFor(headers, row, ['observation minutes', 'client observation minutes', 'observation min']);
  const individualText = valueFor(headers, row, ['individual supervision minutes', 'individual minutes']);

  const parsedHours = numericValue(hoursText);
  const duration = parsedHours > 0 ? Math.round(parsedHours * 100) / 100 : hoursBetween(startTime, endTime);
  if (!date || duration <= 0) return null;

  const activityCategory = inferCategory(categoryText, activity);
  const now = new Date().toISOString();
  return {
    id: newId('import'),
    userId: email,
    date,
    startTime: startTime || '00:00',
    endTime: endTime || '00:00',
    duration,
    fieldworkType: inferFieldworkType(fieldworkTypeText),
    activityType: inferActivityType(activity, activityCategory),
    activityCategory,
    supervisorId: supervisor ? `imported_${supervisor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'imported_unknown',
    supervisorName: supervisor || 'Not specified',
    setting,
    notes: notes || activity || undefined,
    status: inferStatus(statusText),
    createdAt: now,
    updatedAt: now,
    supervisionMinutes: Math.max(0, numericValue(supervisionText)) || undefined,
    observationMinutes: Math.max(0, numericValue(observationText)) || undefined,
    individualSupervisionMinutes: Math.max(0, numericValue(individualText)) || undefined,
    aiSourceText: source,
  };
}

function aiToHourEntry(entry: AiImportEntry, email: string, source: string): HourEntry {
  const now = new Date().toISOString();
  const supervisorName = entry.supervisorName || 'Not specified';
  return {
    id: newId('ai_import'),
    userId: email,
    date: entry.date,
    startTime: entry.startTime || '00:00',
    endTime: entry.endTime || '00:00',
    duration: entry.duration,
    fieldworkType: entry.fieldworkType,
    activityType: entry.activityType,
    activityCategory: entry.activityCategory,
    supervisorId: supervisorName === 'Not specified'
      ? 'imported_unknown'
      : `imported_${supervisorName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    supervisorName,
    setting: entry.setting || '',
    notes: entry.notes || undefined,
    status: entry.status,
    createdAt: now,
    updatedAt: now,
    supervisionMinutes: entry.supervisionMinutes || undefined,
    observationMinutes: entry.observationMinutes || undefined,
    individualSupervisionMinutes: entry.individualSupervisionMinutes || undefined,
    aiGenerated: true,
    aiConfidence: entry.confidence,
    aiRationale: entry.summaryDerived
      ? 'Baker AI extracted this as a monthly aggregate from the source document. Review before importing.'
      : 'Baker AI extracted this fieldwork record from the supplied migration source. Review before importing.',
    aiSourceText: entry.sourceLabel || source,
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function splitText(text: string, maxLength = 75_000): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    const window = remaining.slice(0, maxLength);
    const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'), Math.floor(maxLength * 0.8));
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining.trim()) chunks.push(remaining);
  return chunks;
}

function dedupeEntries(entries: HourEntry[]): HourEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const signature = [entry.date, entry.startTime, entry.endTime, entry.duration, entry.activityType, entry.supervisorName].join('|');
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function buildRipleyBookmarklet(targetOrigin: string): string {
  const script = `(async()=>{try{if(!/(^|\\.)ripleyfieldworktracker\\.com$/i.test(location.hostname)){alert('Baker Ripley Bridge only runs on Ripley Fieldwork Tracker.');return;}if(!window.opener){alert('Open Ripley from the Baker import page first, then run this bridge.');return;}const clean=(doc,url)=>{const root=doc.querySelector('main')||doc.querySelector('#content')||doc.body;const tables=[...doc.querySelectorAll('table')].map(t=>[...t.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('th,td')].map(c=>(c.innerText||'').replace(/\\s+/g,' ').trim()).join('\\t')).join('\\n')).join('\\n---TABLE---\\n');const text=(root?.innerText||'').replace(/\\n{4,}/g,'\\n\\n').slice(0,28000);return 'SOURCE '+url+'\\n'+tables+'\\n'+text;};const parts=[clean(document,location.href)];const links=[...document.querySelectorAll('a[href]')].map(a=>{try{return new URL(a.href,location.href)}catch{return null}}).filter(u=>u&&u.origin===location.origin&&/(hour|month|fieldwork|dashboard|summary|total|report|entr)/i.test(u.pathname+u.search)).slice(0,35);const seen=new Set([location.href]);for(const u of links){if(seen.has(u.href))continue;seen.add(u.href);try{const r=await fetch(u.href,{credentials:'include'});if(!r.ok)continue;const ct=r.headers.get('content-type')||'';if(!ct.includes('text/html'))continue;const html=await r.text();const doc=new DOMParser().parseFromString(html,'text/html');parts.push(clean(doc,u.href));if(parts.join('\\n').length>450000)break;}catch{}}window.opener.postMessage({type:'BAKER_RIPLEY_TRANSFER',payload:parts.join('\\n\\n===== NEXT RIPLEY PAGE =====\\n\\n'),pages:parts.length},'${targetOrigin}');alert('Baker received your Ripley fieldwork pages. Return to the Baker tab to review the migration.');}catch(e){alert('Baker could not read this Ripley page. You can always use PDF/CSV upload instead.');}})()`;
  return `javascript:${encodeURIComponent(script)}`;
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export default function EmilyImport() {
  const email = getCurrentUserEmail() || EMILY_EMAIL;
  const ripleyWindowRef = useRef<Window | null>(null);
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [batchSize, setBatchSize] = useState(100);
  const [progress, setProgress] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [ripleyConsent, setRipleyConsent] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState('Not connected');
  const [bookmarklet, setBookmarklet] = useState('');

  const selectedEntries = useMemo(() => entries.filter((entry) => selectedIds.has(entry.id)), [entries, selectedIds]);
  const totalHours = useMemo(() => selectedEntries.reduce((sum, entry) => sum + entry.duration, 0), [selectedEntries]);
  const batches = Math.max(1, Math.ceil(selectedEntries.length / batchSize));
  const completedCompliance = importedCount !== null ? evaluateCompliance(loadEntries(email)) : null;

  useEffect(() => {
    if (typeof window !== 'undefined') setBookmarklet(buildRipleyBookmarklet(window.location.origin));
  }, []);

  const callMigration = async (body: Record<string, unknown>): Promise<MigrationResponse> => {
    const token = getStoredAccessToken();
    if (!token) throw new Error('Your Baker session has expired. Sign in again.');
    const response = await fetch('/api/import-fieldwork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const payload = await response.json() as MigrationResponse;
    if (!response.ok) throw new Error(payload.error || 'Baker AI could not process this source.');
    return payload;
  };

  const addAiResults = (payload: MigrationResponse, source: string) => {
    const converted = (payload.entries || []).map((entry) => aiToHourEntry(entry, email, source));
    setEntries((current) => {
      const next = dedupeEntries([...current, ...converted]);
      setSelectedIds(new Set(next.map((entry) => entry.id)));
      return next;
    });
    if (payload.warnings?.length) setWarnings((current) => [...current, ...payload.warnings!]);
  };

  const processRawText = async (rawText: string, sourceHint: string) => {
    const chunks = splitText(rawText);
    for (let index = 0; index < chunks.length; index += 1) {
      const payload = await callMigration({
        rawText: chunks[index],
        fileName: `${sourceHint}-part-${index + 1}.txt`,
        sourceHint,
      });
      addAiResults(payload, payload.detectedSource || sourceHint);
      setProgress(Math.round(((index + 1) / chunks.length) * 100));
      await yieldToBrowser();
    }
  };

  useEffect(() => {
    const receiveBridge = (event: MessageEvent) => {
      if (!/^https:\/\/([a-z0-9-]+\.)?ripleyfieldworktracker\.com$/i.test(event.origin)) return;
      if (ripleyWindowRef.current && event.source !== ripleyWindowRef.current) return;
      if (event.data?.type !== 'BAKER_RIPLEY_TRANSFER' || typeof event.data.payload !== 'string') return;

      const rawText = String(event.data.payload);
      const pages = Number(event.data.pages || 1);
      setBridgeStatus(`Received ${pages} Ripley page${pages === 1 ? '' : 's'} — Baker AI is structuring the hours…`);
      setIsReading(true);
      setMessage('');
      setProgress(0);
      void processRawText(rawText, 'Ripley browser transfer')
        .then(() => {
          setBridgeStatus('Ripley transfer received. Review the proposed hours below.');
          setFileNames((current) => [...current, `Ripley browser transfer (${pages} pages)`]);
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Ripley transfer could not be processed.'))
        .finally(() => setIsReading(false));
    };
    window.addEventListener('message', receiveBridge);
    return () => window.removeEventListener('message', receiveBridge);
  }, []);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setMessage('');
    setWarnings([]);
    setImportedCount(null);
    setProgress(0);
    setIsReading(true);

    try {
      for (let index = 0; index < list.length; index += 1) {
        const file = list[index];
        const lower = file.name.toLowerCase();
        setFileNames((current) => [...current, file.name]);

        if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
          const parsedRows = parseDelimited(await file.text(), lower.endsWith('.tsv') ? '\t' : ',');
          if (parsedRows.length < 2) {
            setWarnings((current) => [...current, `${file.name}: no fieldwork rows found.`]);
            continue;
          }
          const [headers, ...dataRows] = parsedRows;
          const valid = dataRows
            .map((row) => buildDelimitedEntry(headers, row, email, file.name))
            .filter((entry): entry is HourEntry => Boolean(entry));
          setEntries((current) => {
            const next = dedupeEntries([...current, ...valid]);
            setSelectedIds(new Set(next.map((entry) => entry.id)));
            return next;
          });
          if (valid.length < dataRows.length) {
            setWarnings((current) => [...current, `${file.name}: ${dataRows.length - valid.length} rows were skipped because Baker could not find both a date and duration.`]);
          }
        } else if (lower.endsWith('.txt') || lower.endsWith('.json')) {
          await processRawText(await file.text(), file.name);
        } else {
          if (file.size > 2_250_000) {
            setWarnings((current) => [...current, `${file.name}: this file is larger than the secure direct-upload limit. Split the PDF into smaller files (monthly PDFs work well) and upload them together.`]);
            continue;
          }
          const payload = await callMigration({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileData: await fileToBase64(file),
            sourceHint: lower.includes('ripley') ? 'Ripley export' : 'fieldwork document',
          });
          addAiResults(payload, payload.detectedSource || file.name);
        }

        setProgress(Math.round(((index + 1) / list.length) * 100));
        await yieldToBrowser();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Baker could not read one of these files.');
    } finally {
      setIsReading(false);
    }
  };

  const toggleEntry = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importInBatches = async () => {
    if (selectedEntries.length === 0 || isImporting) return;
    setIsImporting(true);
    setMessage('');
    setProgress(0);
    const before = loadEntries(email).length;

    try {
      for (let start = 0; start < selectedEntries.length; start += batchSize) {
        const batch = selectedEntries.slice(start, start + batchSize);
        appendEntries(batch, email);
        setProgress(Math.min(100, Math.round(((start + batch.length) / selectedEntries.length) * 100)));
        await yieldToBrowser();
      }
      const after = loadEntries(email).length;
      setImportedCount(Math.max(0, after - before));
      setProgress(100);
    } finally {
      setIsImporting(false);
    }
  };

  const openRipley = () => {
    if (!ripleyConsent) return;
    const popup = window.open('https://ripleyfieldworktracker.com/login/', 'baker-ripley-import');
    ripleyWindowRef.current = popup;
    setBridgeStatus(popup ? 'Ripley opened. Log in there, navigate to your hours/history, then run the Baker Ripley Bridge bookmark.' : 'Popup blocked. Allow popups for Baker and try again.');
  };

  const copyBridge = async () => {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setBridgeStatus('Bridge code copied. Create a browser bookmark and paste it into the bookmark URL/location field.');
    } catch {
      setBridgeStatus('Drag the Baker Ripley Bridge button to your bookmarks bar instead.');
    }
  };

  if (importedCount !== null && completedCompliance) {
    return (
      <div className="min-h-[75vh] bg-[#FFFCF9] py-10 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-[#F2EDEA] p-8 lg:p-10 shadow-sm">
          <CheckCircle2 size={38} className="text-[#5FA37E] mb-4" />
          <h1 className="font-serif text-3xl font-semibold text-[#332C28] mb-2">Migration complete</h1>
          <p className="text-[#6B5D54] mb-6">{importedCount} new records were added. Duplicate entries were skipped automatically.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
            <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Actual hours</div><div className="font-mono text-2xl text-[#332C28] mt-1">{completedCompliance.actualHours}</div></div>
            <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Equivalent progress</div><div className="font-mono text-2xl text-[#332C28] mt-1">{completedCompliance.weightedEquivalentHours}</div></div>
            <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Unrestricted</div><div className="font-mono text-2xl text-[#5FA37E] mt-1">{(completedCompliance.unrestrictedRatio * 100).toFixed(1)}%</div></div>
            <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Baker score</div><div className="font-mono text-2xl text-[#E85D70] mt-1">{completedCompliance.bakerComplianceScore}</div></div>
          </div>
          <div className="flex flex-wrap gap-3"><Link to="/dashboard" className="btn-primary px-5 py-3 rounded-xl">Go to dashboard</Link><button onClick={() => { setImportedCount(null); setEntries([]); setSelectedIds(new Set()); setFileNames([]); setWarnings([]); }} className="px-5 py-3 rounded-xl border border-[#E2DAD5] text-sm font-semibold text-[#6B5D54]">Import more</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] py-8 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-sm font-semibold text-[#E85D70] mb-2">Paid migration concierge</div>
            <h1 className="font-serif text-4xl font-semibold text-[#332C28] mb-2">Switch to Baker without re-entering your hours</h1>
            <p className="text-[#6B5D54] max-w-3xl">Upload PDFs, CSVs, text exports, or transfer your own Ripley history from an already-signed-in browser session. Baker AI structures the records, shows confidence and warnings, then you choose what gets imported.</p>
          </div>
          <Link to="/dashboard" className="text-sm text-[#E85D70] font-medium">Back to dashboard</Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <section className="bg-white rounded-3xl border border-[#F2EDEA] p-7 shadow-sm">
            <div className="w-11 h-11 rounded-2xl bg-[#FFF5F7] text-[#E85D70] flex items-center justify-center mb-4"><FileText size={22} /></div>
            <h2 className="font-serif text-2xl font-semibold text-[#332C28]">Upload almost any fieldwork export</h2>
            <p className="text-sm text-[#6B5D54] mt-2 mb-5">Best for Ripley verification PDFs, tracker PDFs, CSV/TSV histories, text exports, and small office documents. Select multiple monthly PDFs at once.</p>
            <label className="block w-full cursor-pointer border-2 border-dashed border-[#E2DAD5] hover:border-[#E85D70] rounded-2xl p-8 text-center transition-colors">
              <input type="file" multiple accept=".pdf,.csv,.tsv,.txt,.json,.docx,.xlsx,application/pdf,text/csv,text/plain" className="hidden" onChange={(event) => { if (event.target.files) void handleFiles(event.target.files); event.currentTarget.value = ''; }} />
              <Upload size={28} className="mx-auto text-[#E85D70] mb-3" />
              <div className="font-semibold text-[#332C28]">Choose files</div>
              <div className="text-xs text-[#A8998E] mt-1">PDF • CSV • TSV • TXT • JSON • DOCX • XLSX</div>
            </label>
            <div className="mt-4 flex items-start gap-2 text-xs text-[#7B6B62]"><ShieldCheck size={16} className="text-[#5FA37E] shrink-0 mt-0.5" /><span>Nothing is saved until you review and click Import. AI-generated classifications are proposals, not supervisor verification.</span></div>
          </section>

          <section className="bg-white rounded-3xl border border-[#E9DED8] p-7 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 px-3 py-1.5 rounded-bl-xl bg-[#332C28] text-white text-[10px] font-semibold tracking-wider uppercase">Beta</div>
            <div className="w-11 h-11 rounded-2xl bg-[#F3F7FF] text-[#5C70C4] flex items-center justify-center mb-4"><Bot size={22} /></div>
            <h2 className="font-serif text-2xl font-semibold text-[#332C28]">AI Ripley Transfer</h2>
            <p className="text-sm text-[#6B5D54] mt-2">Baker never asks for your Ripley password. You authorize a read-only transfer from the Ripley pages already available in your signed-in browser session.</p>
            <div className="mt-4 rounded-2xl bg-[#FAF8F6] p-4 text-xs text-[#6B5D54] space-y-2">
              <div><strong>Allowed:</strong> read hour/month/fieldwork/history pages and send the extracted fieldwork text back to this Baker tab.</div>
              <div><strong>Not allowed:</strong> change hours, delete anything, message anyone, access billing/profile data, or store your Ripley credentials.</div>
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm text-[#4D423C] cursor-pointer">
              <input type="checkbox" checked={ripleyConsent} onChange={(event) => setRipleyConsent(event.target.checked)} className="mt-1" />
              <span>I authorize Baker Migration Assistant to perform only this read-and-import task on fieldwork records in my Ripley session.</span>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={!ripleyConsent} onClick={openRipley} className="btn-primary px-4 py-2.5 rounded-xl disabled:opacity-50"><ExternalLink size={15} /> Open Ripley</button>
              <a href={bookmarklet} onClick={(event) => { if (!ripleyConsent) event.preventDefault(); }} className={`px-4 py-2.5 rounded-xl border text-sm font-semibold ${ripleyConsent ? 'border-[#5C70C4] text-[#4B5EA8]' : 'border-[#E2DAD5] text-[#B7AAA2] pointer-events-none'}`} title="Drag this button to your bookmarks bar, then click it while viewing your Ripley hours">Baker Ripley Bridge</a>
              <button disabled={!ripleyConsent} onClick={() => void copyBridge()} className="px-3 py-2.5 rounded-xl border border-[#E2DAD5] text-[#6B5D54] disabled:opacity-50" title="Copy bookmarklet"><Copy size={15} /></button>
            </div>
            <p className="mt-3 text-xs text-[#A8998E]">One-time setup: drag “Baker Ripley Bridge” to your browser bookmarks bar. Open Ripley from this card, sign in there, go to your hours/history view, then click the bookmark. Keep this Baker tab open.</p>
            <div className="mt-3 text-xs font-medium text-[#5C70C4]">{bridgeStatus}</div>
          </section>
        </div>

        {(isReading || fileNames.length > 0 || message || warnings.length > 0) && (
          <section className="bg-white rounded-3xl border border-[#F2EDEA] p-6 shadow-sm mb-6">
            <div className="flex items-center gap-3">
              {isReading ? <Loader2 size={20} className="animate-spin text-[#E85D70]" /> : <CheckCircle2 size={20} className="text-[#5FA37E]" />}
              <div><div className="font-semibold text-[#332C28]">{isReading ? 'Baker AI is reading your migration sources…' : 'Sources processed'}</div><div className="text-xs text-[#A8998E] mt-0.5">{fileNames.join(' • ') || 'Ripley browser transfer'}</div></div>
            </div>
            {(isReading || progress > 0) && <div className="mt-4 h-2 rounded-full bg-[#F2EDEA] overflow-hidden"><div className="h-full bg-[#E85D70] transition-all" style={{ width: `${Math.max(4, progress)}%` }} /></div>}
            {message && <div className="mt-4 rounded-xl bg-[#FFF5F7] px-4 py-3 text-sm text-[#C9445A] flex gap-2"><XCircle size={17} className="shrink-0 mt-0.5" />{message}</div>}
            {warnings.length > 0 && <div className="mt-4 rounded-xl bg-[#FFF9ED] px-4 py-3 text-sm text-[#806126]"><div className="font-semibold flex gap-2 items-center mb-1"><AlertTriangle size={16} />Review these import warnings</div>{warnings.slice(0, 8).map((warning, index) => <div key={`${warning}-${index}`} className="mt-1">• {warning}</div>)}</div>}
          </section>
        )}

        {entries.length > 0 && (
          <section className="bg-white rounded-3xl border border-[#F2EDEA] overflow-hidden shadow-sm">
            <div className="p-6 border-b border-[#F2EDEA] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><FileSpreadsheet size={18} className="text-[#D4A574]" /><h2 className="font-serif text-xl font-semibold text-[#332C28]">Review before import</h2></div>
                <p className="text-sm text-[#A8998E] mt-1">{selectedEntries.length} of {entries.length} selected • {totalHours.toFixed(2)} selected hours • duplicates will be skipped again at save time</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedIds(new Set(entries.map((entry) => entry.id)))} className="text-xs font-semibold text-[#5C70C4]">Select all</button>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs font-semibold text-[#A8998E]">Clear</button>
                <label className="text-xs text-[#A8998E]">Batch size<select value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))} className="ml-2 rounded-lg border border-[#E2DAD5] bg-white px-3 py-2 text-sm text-[#332C28]"><option value={50}>50</option><option value={100}>100</option><option value={250}>250</option></select></label>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 border-b border-[#F2EDEA]">
              <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Selected rows</div><div className="font-mono text-2xl">{selectedEntries.length}</div></div>
              <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Import batches</div><div className="font-mono text-2xl">{batches}</div></div>
              <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">Selected hours</div><div className="font-mono text-2xl">{totalHours.toFixed(1)}</div></div>
              <div className="rounded-xl bg-[#FAF8F6] p-4"><div className="text-xs text-[#A8998E]">AI extracted</div><div className="font-mono text-2xl">{entries.filter((entry) => entry.aiGenerated).length}</div></div>
            </div>

            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full min-w-[1040px] text-sm">
                <thead className="sticky top-0 bg-[#FAF8F6] text-left text-xs uppercase tracking-wider text-[#A8998E]"><tr><th className="p-4">Use</th><th className="p-4">Date</th><th className="p-4">Hours</th><th className="p-4">Type</th><th className="p-4">Category</th><th className="p-4">Supervisor</th><th className="p-4">Status</th><th className="p-4">AI confidence</th><th className="p-4">Source</th></tr></thead>
                <tbody>{entries.slice(0, 500).map((entry) => <tr key={entry.id} className="border-t border-[#F2EDEA]"><td className="p-4"><input type="checkbox" checked={selectedIds.has(entry.id)} onChange={() => toggleEntry(entry.id)} /></td><td className="p-4">{entry.date}</td><td className="p-4 font-mono">{entry.duration}</td><td className="p-4">{entry.fieldworkType}</td><td className="p-4">{entry.activityCategory}</td><td className="p-4">{entry.supervisorName}</td><td className="p-4">{entry.status}</td><td className="p-4">{entry.aiGenerated ? `${Math.round((entry.aiConfidence || 0) * 100)}%` : '—'}</td><td className="p-4 max-w-[240px] truncate" title={entry.aiSourceText}>{entry.aiSourceText || 'File import'}</td></tr>)}</tbody>
              </table>
            </div>

            <div className="p-6 border-t border-[#F2EDEA]">
              {(isImporting || progress > 0) && <div className="h-2 rounded-full bg-[#F2EDEA] overflow-hidden mb-4"><div className="h-full bg-[#5FA37E] transition-all" style={{ width: `${progress}%` }} /></div>}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-[#A8998E] max-w-2xl">By importing, you confirm you reviewed these proposed records against your source documents. Baker AI does not replace the trainee’s or supervisor’s documentation responsibilities.</div>
                <button disabled={selectedEntries.length === 0 || isImporting || isReading} onClick={() => void importInBatches()} className="btn-primary px-6 py-3 rounded-xl disabled:opacity-50 whitespace-nowrap">{isImporting ? 'Importing…' : `Import ${selectedEntries.length} records`}</button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
