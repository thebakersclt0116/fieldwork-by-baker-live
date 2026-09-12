import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
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
  newId,
  normalizeDate,
  normalizeTime,
} from '@/lib/fieldworkStore';
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

type ProcessingStage = 'idle' | 'receiving' | 'reading' | 'structuring' | 'checking' | 'ready' | 'error';

const STAGE_COPY: Record<ProcessingStage, { title: string; detail: string }> = {
  idle: { title: 'Ready when you are', detail: 'Nothing is being processed yet.' },
  receiving: { title: 'Ripley sent your fieldwork data', detail: 'Baker is securing the transfer and preparing it for review.' },
  reading: { title: 'Reading your fieldwork history', detail: 'Baker is separating dates, hours, supervision details, and statuses.' },
  structuring: { title: 'Baker AI is structuring your hours', detail: 'This can take a moment for a long history. Keep this tab open.' },
  checking: { title: 'Checking duplicates and preparing review', detail: 'Baker is making sure the proposed records are safe to review before import.' },
  ready: { title: 'Your migration is ready to review', detail: 'Nothing has been saved yet. Review the proposed entries below.' },
  error: { title: 'Baker needs your attention', detail: 'The transfer stopped before anything was saved.' },
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
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
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
  const activity = valueFor(headers, row, ['activity', 'activity type', 'description', 'task']);
  const categoryText = valueFor(headers, row, ['category', 'activity category', 'restricted unrestricted']);
  const supervisor = valueFor(headers, row, ['supervisor', 'supervisor name', 'bcba']);
  const fieldworkTypeText = valueFor(headers, row, ['fieldwork type', 'type', 'experience']);
  const statusText = valueFor(headers, row, ['status', 'verification status', 'verified']);
  const notes = valueFor(headers, row, ['notes', 'comments']);
  const setting = valueFor(headers, row, ['setting', 'location', 'site']);
  const supervisionText = valueFor(headers, row, ['supervision minutes', 'supervised minutes']);
  const observationText = valueFor(headers, row, ['observation minutes', 'client observation minutes']);
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
    supervisorId: supervisorName === 'Not specified' ? 'imported_unknown' : `imported_${supervisorName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
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
      : 'Baker AI extracted this record from your migration source. Review before importing.',
    aiSourceText: entry.sourceLabel || source,
  };
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

function splitText(text: string, maxLength = 60_000): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    const windowText = remaining.slice(0, maxLength);
    const paragraphCut = Math.max(windowText.lastIndexOf('\n\n'), windowText.lastIndexOf('\n'));
    const cut = paragraphCut > maxLength * 0.65 ? paragraphCut : maxLength;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining.trim()) chunks.push(remaining);
  return chunks;
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function shortYield(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read this file.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function buildRipleyBookmarklet(targetOrigin: string): string {
  const script = `(async()=>{const id='baker-transfer-overlay';const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));const show=(title,detail,done=false)=>{let o=document.getElementById(id);if(!o){o=document.createElement('div');o.id=id;o.style='position:fixed;inset:0;z-index:2147483647;background:rgba(28,24,22,.76);backdrop-filter:blur(9px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,system-ui,-apple-system,sans-serif';document.documentElement.appendChild(o);}o.innerHTML='<div style="width:min(520px,94vw);background:#fffaf7;border:1px solid #eadfd9;border-radius:28px;padding:34px;box-shadow:0 28px 90px rgba(0,0,0,.28);text-align:center"><div style="width:58px;height:58px;border-radius:18px;background:#fff0f3;color:#e85d70;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:27px">✦</div><div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#e85d70;margin-bottom:8px">Fieldwork by Baker</div><div style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#332c28;margin-bottom:10px">'+esc(title)+'</div><div style="font-size:14px;line-height:1.6;color:#76675f">'+esc(detail)+'</div>'+(done?'<button id="bakerBack" style="margin-top:22px;border:0;border-radius:13px;background:#332c28;color:white;padding:13px 18px;font-weight:800;cursor:pointer">Return to Fieldwork by Baker</button>':'<div style="width:34px;height:34px;border:4px solid #f0dfdf;border-top-color:#e85d70;border-radius:50%;margin:24px auto 0;animation:bakerSpin .8s linear infinite"></div>')+'</div><style>@keyframes bakerSpin{to{transform:rotate(360deg)}}</style>';if(done){const b=document.getElementById('bakerBack');if(b)b.onclick=()=>{try{window.opener.focus()}catch{}}}};try{show('Checking this Ripley page','Baker only transfers fieldwork data from your Total Hours / Hours History view.');if(!/(^|\\.)ripleyfieldworktracker\\.com$/i.test(location.hostname)){show('Open Ripley first','This bridge only runs on Ripley Fieldwork Tracker.',true);return;}if(!window.opener){show('Open Ripley from Baker','Return to the Baker import page, click Open Ripley, then use this bridge.',true);return;}const heading=((document.querySelector('h1,h2,h3')?.textContent||'')+' '+document.title+' '+location.pathname).toLowerCase();const tableText=[...document.querySelectorAll('table')].map(t=>t.innerText||'').join(' ').toLowerCase();const looksLikeHours=/(total\\s*hours|hours?\\s*history|fieldwork\\s*hours|hour\\s*entries|fieldwork\\s*history)/i.test(heading)||(/date/.test(tableText)&&/hour/.test(tableText));if(!looksLikeHours){show('Go to Total Hours first','Navigate to Ripley’s Total Hours / Hours History page, then click the Baker Ripley Bridge bookmark again. This keeps the transfer fast and limited to your fieldwork records.',true);return;}show('Uploading to Fieldwork by Baker','Reading your Total Hours / Hours History page. You can return to the Baker tab while this finishes.');const clean=(doc,url)=>{const tables=[...doc.querySelectorAll('table')].map(t=>[...t.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('th,td')].map(c=>(c.innerText||'').replace(/\\s+/g,' ').trim()).join('\\t')).join('\\n')).join('\\n---TABLE---\\n');const root=doc.querySelector('main')||doc.querySelector('#content')||doc.body;const text=(root?.innerText||'').replace(/\\n{4,}/g,'\\n\\n').slice(0,45000);return 'SOURCE '+url+'\\n'+tables+'\\n'+text;};const parts=[clean(document,location.href)];const currentPath=location.pathname;const pageLinks=[...document.querySelectorAll('a[href]')].map(a=>{try{return{u:new URL(a.href,location.href),label:(a.textContent||'').trim()}}catch{return null}}).filter(x=>x&&x.u.origin===location.origin&&x.u.pathname===currentPath&&(/(page|paged|offset|start)=/i.test(x.u.search)||/^(next|previous|prev|\\d+|›|»|‹|«)$/i.test(x.label))).slice(0,20);const seen=new Set([location.href]);for(const item of pageLinks){if(!item||seen.has(item.u.href))continue;seen.add(item.u.href);try{const r=await fetch(item.u.href,{credentials:'include'});if(!r.ok)continue;const ct=r.headers.get('content-type')||'';if(!ct.includes('text/html'))continue;const html=await r.text();const doc=new DOMParser().parseFromString(html,'text/html');parts.push(clean(doc,item.u.href));if(parts.join('\\n').length>190000)break;}catch{}}const payload=parts.join('\\n\\n===== NEXT RIPLEY PAGE =====\\n\\n');window.opener.postMessage({type:'BAKER_RIPLEY_TRANSFER',payload,pages:parts.length},'${targetOrigin}');show('Transfer sent to Fieldwork by Baker','Baker AI is structuring your hours now. You can return to the Baker tab and watch the migration progress.',true);try{window.opener.focus()}catch{}}catch(e){show('Transfer could not finish','Nothing was changed in Ripley. Return to Baker and use PDF/CSV upload if needed.',true);}})()`;
  return `javascript:${encodeURIComponent(script)}`;
}

export default function SmartImport() {
  const email = getCurrentUserEmail() || EMILY_EMAIL;
  const ripleyWindowRef = useRef<Window | null>(null);
  const reviewRef = useRef<HTMLDivElement | null>(null);
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [processingVisible, setProcessingVisible] = useState(false);
  const [ripleyConsent, setRipleyConsent] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState('Start by opening Ripley and navigating to Total Hours / Hours History.');
  const [bookmarklet, setBookmarklet] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const selectedEntries = useMemo(() => entries.filter((entry) => selectedIds.has(entry.id)), [entries, selectedIds]);
  const selectedHours = useMemo(() => selectedEntries.reduce((sum, entry) => sum + entry.duration, 0), [selectedEntries]);

  useEffect(() => {
    setBookmarklet(buildRipleyBookmarklet(window.location.origin));
  }, []);

  const callMigration = async (body: Record<string, unknown>): Promise<MigrationResponse> => {
    const token = getStoredAccessToken();
    if (!token) throw new Error('Your Baker session expired. Sign in again and restart the migration.');
    const response = await fetch('/api/import-fieldwork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const payload = await response.json() as MigrationResponse;
    if (!response.ok) throw new Error(payload.error || 'Baker AI could not process this migration source.');
    return payload;
  };

  const runTextMigration = async (rawText: string, sourceHint: string): Promise<void> => {
    setProcessingVisible(true);
    setStage('receiving');
    setProgress(8);
    setMessage('');
    await nextPaint();

    const chunks = splitText(rawText);
    const converted: HourEntry[] = [];
    const nextWarnings: string[] = [];

    setStage('reading');
    setProgress(16);
    await nextPaint();

    for (let index = 0; index < chunks.length; index += 1) {
      setStage('structuring');
      setProgress(20 + Math.round(((index + 0.25) / chunks.length) * 65));
      await shortYield();
      const payload = await callMigration({
        rawText: chunks[index],
        fileName: `${sourceHint}-part-${index + 1}.txt`,
        sourceHint,
      });
      converted.push(...(payload.entries || []).map((entry) => aiToHourEntry(entry, email, payload.detectedSource || sourceHint)));
      if (payload.warnings?.length) nextWarnings.push(...payload.warnings);
      setProgress(20 + Math.round(((index + 1) / chunks.length) * 65));
      await shortYield();
    }

    setStage('checking');
    setProgress(91);
    await nextPaint();

    const nextEntries = dedupeEntries([...entries, ...converted]);
    setEntries(nextEntries);
    setSelectedIds(new Set(nextEntries.map((entry) => entry.id)));
    setWarnings((current) => [...current, ...nextWarnings]);
    setSources((current) => [...current, sourceHint]);
    setProgress(100);
    setStage('ready');
    await new Promise((resolve) => setTimeout(resolve, 650));
    setProcessingVisible(false);
    setBridgeStatus(`Transfer complete — ${converted.length} proposed record${converted.length === 1 ? '' : 's'} ready to review.`);
    setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  useEffect(() => {
    const receiveBridge = (event: MessageEvent) => {
      if (!/^https:\/\/([a-z0-9-]+\.)?ripleyfieldworktracker\.com$/i.test(event.origin)) return;
      if (ripleyWindowRef.current && event.source !== ripleyWindowRef.current) return;
      if (event.data?.type !== 'BAKER_RIPLEY_TRANSFER' || typeof event.data.payload !== 'string') return;

      const pages = Math.max(1, Number(event.data.pages || 1));
      setBridgeStatus(`Received ${pages} Ripley page${pages === 1 ? '' : 's'} — Baker AI is working now.`);
      void runTextMigration(String(event.data.payload), `Ripley Total Hours transfer (${pages} page${pages === 1 ? '' : 's'})`).catch((error: unknown) => {
        setStage('error');
        setProgress(100);
        setMessage(error instanceof Error ? error.message : 'The Ripley transfer could not be processed.');
        setTimeout(() => setProcessingVisible(false), 900);
      });
    };

    window.addEventListener('message', receiveBridge);
    return () => window.removeEventListener('message', receiveBridge);
  });

  const handleFiles = async (files: FileList): Promise<void> => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setProcessingVisible(true);
    setStage('reading');
    setProgress(8);
    setMessage('');
    setWarnings([]);
    await nextPaint();

    const collected: HourEntry[] = [];
    const nextWarnings: string[] = [];
    try {
      for (let index = 0; index < list.length; index += 1) {
        const file = list[index];
        const lower = file.name.toLowerCase();
        setStage('structuring');
        setProgress(12 + Math.round((index / list.length) * 72));
        await shortYield();

        if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
          const rows = parseDelimited(await file.text(), lower.endsWith('.tsv') ? '\t' : ',');
          if (rows.length >= 2) {
            const [headers, ...dataRows] = rows;
            const parsed = dataRows
              .map((row) => buildDelimitedEntry(headers, row, email, file.name))
              .filter((entry): entry is HourEntry => Boolean(entry));
            collected.push(...parsed);
            if (parsed.length < dataRows.length) nextWarnings.push(`${file.name}: ${dataRows.length - parsed.length} rows were skipped because a date and duration could not be identified.`);
          }
        } else if (lower.endsWith('.txt') || lower.endsWith('.json')) {
          const chunks = splitText(await file.text());
          for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
            const payload = await callMigration({ rawText: chunks[chunkIndex], fileName: file.name, sourceHint: file.name });
            collected.push(...(payload.entries || []).map((entry) => aiToHourEntry(entry, email, payload.detectedSource || file.name)));
            if (payload.warnings?.length) nextWarnings.push(...payload.warnings);
          }
        } else {
          if (file.size > 2_250_000) {
            nextWarnings.push(`${file.name}: file is above the secure direct-upload limit. Split it into smaller PDFs and try again.`);
            continue;
          }
          const payload = await callMigration({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileData: await fileToBase64(file),
            sourceHint: lower.includes('ripley') ? 'Ripley export' : 'fieldwork document',
          });
          collected.push(...(payload.entries || []).map((entry) => aiToHourEntry(entry, email, payload.detectedSource || file.name)));
          if (payload.warnings?.length) nextWarnings.push(...payload.warnings);
        }
        setSources((current) => [...current, file.name]);
      }

      setStage('checking');
      setProgress(92);
      await nextPaint();
      const nextEntries = dedupeEntries([...entries, ...collected]);
      setEntries(nextEntries);
      setSelectedIds(new Set(nextEntries.map((entry) => entry.id)));
      setWarnings(nextWarnings);
      setStage('ready');
      setProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 650));
      setProcessingVisible(false);
      setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (error) {
      setStage('error');
      setProgress(100);
      setMessage(error instanceof Error ? error.message : 'Baker could not process this file.');
      setTimeout(() => setProcessingVisible(false), 900);
    }
  };

  const openRipley = () => {
    if (!ripleyConsent) return;
    const popup = window.open('https://ripleyfieldworktracker.com/login/', 'baker-ripley-import');
    ripleyWindowRef.current = popup;
    setBridgeStatus(popup
      ? 'Ripley opened. Sign in, navigate to Total Hours / Hours History, then click the Baker Ripley Bridge bookmark.'
      : 'Popup blocked. Allow popups for Fieldwork by Baker and try again.');
  };

  const copyBridge = async () => {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setBridgeStatus('Bridge copied. Create a bookmark, paste this into its URL field, then run it from Ripley’s Total Hours page.');
    } catch {
      setBridgeStatus('Drag the Baker Ripley Bridge button to your bookmarks bar instead.');
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

  const saveSelected = async () => {
    if (selectedEntries.length === 0 || isImporting) return;
    setIsImporting(true);
    setImportedCount(null);
    setProcessingVisible(true);
    setStage('checking');
    setProgress(20);
    await nextPaint();
    try {
      const beforeSignatures = new Set(
        appendEntries([], email).map((entry) => [entry.date, entry.startTime, entry.endTime, entry.duration, entry.activityType, entry.supervisorName].join('|'))
      );
      appendEntries(selectedEntries, email);
      const imported = selectedEntries.filter((entry) => !beforeSignatures.has([entry.date, entry.startTime, entry.endTime, entry.duration, entry.activityType, entry.supervisorName].join('|'))).length;
      setProgress(100);
      setStage('ready');
      setImportedCount(imported);
      await new Promise((resolve) => setTimeout(resolve, 600));
      setProcessingVisible(false);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] py-8 pb-16 px-4">
      {processingVisible && (
        <div className="fixed inset-0 z-[1000] bg-[#201B18]/75 backdrop-blur-md flex items-center justify-center p-5" role="status" aria-live="polite">
          <div className="w-full max-w-xl rounded-[32px] border border-white/60 bg-[#FFFCF9] p-8 sm:p-10 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#FFF0F3] text-[#E85D70] flex items-center justify-center mx-auto mb-5">
              {stage === 'ready' ? <CheckCircle2 size={30} /> : stage === 'error' ? <XCircle size={30} /> : <Sparkles size={30} className="animate-pulse" />}
            </div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#E85D70] mb-2">Baker Migration Assistant</div>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#332C28]">{STAGE_COPY[stage].title}</h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#74655D] mt-3 max-w-md mx-auto">{stage === 'error' && message ? message : STAGE_COPY[stage].detail}</p>
            <div className="mt-7 h-2.5 rounded-full bg-[#EFE7E2] overflow-hidden">
              <div className="h-full rounded-full bg-[#E85D70] transition-all duration-500" style={{ width: `${Math.max(5, progress)}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-[#A8998E]">
              <span>{stage === 'structuring' ? 'AI processing can take a little longer for large histories.' : 'Please keep this tab open.'}</span>
              <span className="font-mono">{Math.round(progress)}%</span>
            </div>
            {!['ready', 'error'].includes(stage) && (
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#5C70C4]"><Loader2 size={16} className="animate-spin" /> Working securely…</div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-sm font-semibold text-[#E85D70] mb-2">Paid migration concierge</div>
            <h1 className="font-serif text-4xl font-semibold text-[#332C28] mb-2">Bring your fieldwork history to Baker</h1>
            <p className="text-[#6B5D54] max-w-3xl">The fastest route from Ripley is now the Total Hours / Hours History page. Baker reads the fieldwork data already visible to you, structures it with AI, and shows you everything before anything is saved.</p>
          </div>
          <Link to="/dashboard" className="text-sm text-[#E85D70] font-medium">Back to dashboard</Link>
        </div>

        <section className="rounded-3xl border border-[#E5D9D4] bg-gradient-to-br from-[#FFF5F7] via-white to-[#F6F8FF] p-7 sm:p-8 shadow-sm mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#332C28] text-white flex items-center justify-center shrink-0"><Bot size={23} /></div>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-[0.16em] font-bold text-[#5C70C4]">Recommended: AI Ripley Transfer</div>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#332C28] mt-1">Go to Total Hours. Click Baker Bridge. Come back here.</h2>
              <p className="text-sm text-[#6B5D54] mt-2 max-w-3xl">That’s it. The bridge stays focused on your fieldwork history instead of roaming around your Ripley account, which makes the transfer faster and easier to understand.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mt-6">
            {[
              ['1', 'Open Ripley', 'Sign in normally. Baker never receives your Ripley password.'],
              ['2', 'Go to Total Hours', 'Open Ripley’s Total Hours / Hours History view before running the bridge.'],
              ['3', 'Click Baker Bridge', 'Ripley shows “Uploading to Fieldwork by Baker,” then return here to watch progress.'],
            ].map(([step, title, detail]) => (
              <div key={step} className="rounded-2xl bg-white border border-[#E9DED8] p-4">
                <div className="w-7 h-7 rounded-full bg-[#FFF0F3] text-[#E85D70] flex items-center justify-center text-xs font-bold mb-3">{step}</div>
                <div className="font-semibold text-[#332C28]">{title}</div>
                <div className="text-xs leading-relaxed text-[#8D7E75] mt-1">{detail}</div>
              </div>
            ))}
          </div>

          <label className="mt-5 flex items-start gap-3 text-sm text-[#4D423C] cursor-pointer">
            <input type="checkbox" checked={ripleyConsent} onChange={(event) => setRipleyConsent(event.target.checked)} className="mt-1" />
            <span>I authorize Baker to read only my fieldwork/history information from the Ripley pages I can already access and prepare proposed Baker entries for my review.</span>
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={!ripleyConsent} onClick={openRipley} className="btn-primary px-4 py-2.5 rounded-xl disabled:opacity-50"><ExternalLink size={15} /> Open Ripley</button>
            <a href={bookmarklet} onClick={(event) => { if (!ripleyConsent) event.preventDefault(); }} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold ${ripleyConsent ? 'border-[#5C70C4] text-[#4B5EA8] bg-white' : 'border-[#E2DAD5] text-[#B7AAA2] pointer-events-none'}`} title="Drag this to your bookmarks bar"><Sparkles size={15} /> Baker Ripley Bridge</a>
            <button disabled={!ripleyConsent} onClick={() => void copyBridge()} className="px-3 py-2.5 rounded-xl border border-[#E2DAD5] text-[#6B5D54] bg-white disabled:opacity-50" title="Copy bookmarklet"><Copy size={15} /></button>
          </div>
          <div className="mt-3 text-sm font-medium text-[#5C70C4]">{bridgeStatus}</div>
        </section>

        <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-5 items-center mb-6">
          <section className="bg-white rounded-3xl border border-[#F2EDEA] p-7 shadow-sm">
            <div className="w-11 h-11 rounded-2xl bg-[#FFF5F7] text-[#E85D70] flex items-center justify-center mb-4"><FileText size={22} /></div>
            <h2 className="font-serif text-2xl font-semibold text-[#332C28]">Or upload your existing files</h2>
            <p className="text-sm text-[#6B5D54] mt-2 mb-5">PDF, CSV, TSV, TXT, JSON, DOCX, or XLSX exports still work if you prefer files.</p>
            <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-[#E2DAD5] hover:border-[#E85D70] p-7 text-center transition-colors">
              <input type="file" multiple accept=".pdf,.csv,.tsv,.txt,.json,.docx,.xlsx,application/pdf,text/csv,text/plain" className="hidden" onChange={(event) => { if (event.target.files) void handleFiles(event.target.files); event.currentTarget.value = ''; }} />
              <Upload size={27} className="mx-auto text-[#E85D70] mb-3" />
              <div className="font-semibold text-[#332C28]">Choose migration files</div>
              <div className="text-xs text-[#A8998E] mt-1">Multiple files are supported</div>
            </label>
          </section>
          <div className="hidden lg:flex w-9 h-9 rounded-full bg-[#F4EFEC] items-center justify-center text-[#9A8A80] text-xs font-bold">OR</div>
          <section className="rounded-3xl border border-[#DDE7E1] bg-[#F8FCFA] p-7">
            <ShieldCheck size={25} className="text-[#5FA37E] mb-3" />
            <h3 className="font-serif text-xl font-semibold text-[#332C28]">Nothing imports automatically</h3>
            <p className="text-sm leading-relaxed text-[#6B5D54] mt-2">Baker AI only prepares proposed records. You review dates, hours, categories, supervision, and source confidence before clicking Import.</p>
          </section>
        </div>

        {message && !processingVisible && <div className="mb-6 rounded-2xl bg-[#FFF5F7] border border-[#F2CED5] px-5 py-4 text-sm text-[#C9445A] flex gap-2"><XCircle size={18} className="shrink-0" />{message}</div>}
        {warnings.length > 0 && <div className="mb-6 rounded-2xl bg-[#FFF9ED] border border-[#F2E3B8] px-5 py-4 text-sm text-[#806126]"><div className="font-semibold flex gap-2 items-center"><AlertTriangle size={17} />Review these extraction warnings</div>{warnings.slice(0, 8).map((warning, index) => <div key={`${warning}-${index}`} className="mt-1">• {warning}</div>)}</div>}

        <div ref={reviewRef} />
        {entries.length > 0 && (
          <section className="bg-white rounded-3xl border border-[#F2EDEA] overflow-hidden shadow-sm">
            <div className="p-6 border-b border-[#F2EDEA] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><FileSpreadsheet size={18} className="text-[#D4A574]" /><h2 className="font-serif text-xl font-semibold text-[#332C28]">Review before import</h2></div>
                <p className="text-sm text-[#A8998E] mt-1">{selectedEntries.length} of {entries.length} selected • {selectedHours.toFixed(2)} selected hours</p>
              </div>
              <div className="flex gap-3 text-xs font-semibold"><button onClick={() => setSelectedIds(new Set(entries.map((entry) => entry.id)))} className="text-[#5C70C4]">Select all</button><button onClick={() => setSelectedIds(new Set())} className="text-[#A8998E]">Clear</button></div>
            </div>

            <div className="overflow-x-auto max-h-[540px]">
              <table className="w-full min-w-[1040px] text-sm">
                <thead className="sticky top-0 bg-[#FAF8F6] text-left text-xs uppercase tracking-wider text-[#A8998E]"><tr><th className="p-4">Use</th><th className="p-4">Date</th><th className="p-4">Hours</th><th className="p-4">Type</th><th className="p-4">Category</th><th className="p-4">Supervisor</th><th className="p-4">Status</th><th className="p-4">AI confidence</th><th className="p-4">Source</th></tr></thead>
                <tbody>{entries.slice(0, 500).map((entry) => (
                  <tr key={entry.id} className="border-t border-[#F2EDEA]">
                    <td className="p-4"><input type="checkbox" checked={selectedIds.has(entry.id)} onChange={() => toggleEntry(entry.id)} /></td>
                    <td className="p-4">{entry.date}</td><td className="p-4 font-mono">{entry.duration}</td><td className="p-4">{entry.fieldworkType}</td><td className="p-4">{entry.activityCategory}</td><td className="p-4">{entry.supervisorName}</td><td className="p-4">{entry.status}</td><td className="p-4">{entry.aiGenerated ? `${Math.round((entry.aiConfidence || 0) * 100)}%` : '—'}</td><td className="p-4 max-w-[240px] truncate" title={entry.aiSourceText}>{entry.aiSourceText || 'File import'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>

            <div className="p-6 border-t border-[#F2EDEA] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                {sources.length > 0 && <div className="text-xs text-[#A8998E] mb-1">Sources: {sources.join(' • ')}</div>}
                <div className="text-xs text-[#8D7E75]">Nothing is saved until you click Import. Duplicate records are skipped when saving.</div>
              </div>
              <button disabled={selectedEntries.length === 0 || isImporting} onClick={() => void saveSelected()} className="btn-primary px-6 py-3 rounded-xl disabled:opacity-50 whitespace-nowrap">{isImporting ? 'Importing…' : `Import ${selectedEntries.length} records`} <ChevronRight size={16} /></button>
            </div>
          </section>
        )}

        {importedCount !== null && (
          <div className="mt-6 rounded-3xl border border-[#CFE5D8] bg-[#F5FBF7] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-3"><CheckCircle2 size={24} className="text-[#5FA37E] shrink-0" /><div><div className="font-semibold text-[#332C28]">Migration saved</div><div className="text-sm text-[#6B5D54]">{importedCount} new record{importedCount === 1 ? '' : 's'} added. Existing duplicates were skipped.</div></div></div>
            <Link to="/dashboard" className="text-sm font-semibold text-[#5FA37E]">Go to dashboard</Link>
          </div>
        )}
      </div>
    </div>
  );
}
