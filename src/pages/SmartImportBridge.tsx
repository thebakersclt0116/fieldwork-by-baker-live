import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  PlugZap,
  RefreshCw,
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
import { buildStoreZip } from '@/lib/downloadZip';

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

type BridgeResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  payload?: string;
  pages?: number;
  url?: string;
};

type ProcessingStage = 'idle' | 'connecting' | 'receiving' | 'reading' | 'structuring' | 'checking' | 'ready' | 'error';

const WEB_SOURCE = 'FIELDWORK_BY_BAKER_WEB';
const EXT_SOURCE = 'FIELDWORK_BY_BAKER_EXTENSION';

const STAGE_COPY: Record<ProcessingStage, { title: string; detail: string }> = {
  idle: { title: 'Ready when you are', detail: 'Nothing is being processed yet.' },
  connecting: { title: 'Connecting to your Ripley tab', detail: 'Baker Bridge is locating the Ripley tab you already opened.' },
  receiving: { title: 'Receiving your Ripley fieldwork data', detail: 'Baker is securely receiving the Total Hours / Hours History view you authorized.' },
  reading: { title: 'Reading your fieldwork history', detail: 'Baker is separating dates, hours, supervision details, and verification status.' },
  structuring: { title: 'Baker AI is structuring your hours', detail: 'Long histories can take a moment. Keep this Baker tab open.' },
  checking: { title: 'Checking duplicates and preparing review', detail: 'Baker is preparing a safe review queue before anything is saved.' },
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
    if (aliases.some((alias) => header === normalizeHeader(alias) || header.includes(normalizeHeader(alias)))) {
      return String(row[index] || '').trim();
    }
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
    id: newId('import'), userId: email, date,
    startTime: startTime || '00:00', endTime: endTime || '00:00', duration,
    fieldworkType: inferFieldworkType(fieldworkTypeText),
    activityType: inferActivityType(activity, activityCategory), activityCategory,
    supervisorId: supervisor ? `imported_${supervisor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'imported_unknown',
    supervisorName: supervisor || 'Not specified', setting,
    notes: notes || activity || undefined, status: inferStatus(statusText),
    createdAt: now, updatedAt: now,
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
    id: newId('ai_import'), userId: email, date: entry.date,
    startTime: entry.startTime || '00:00', endTime: entry.endTime || '00:00', duration: entry.duration,
    fieldworkType: entry.fieldworkType, activityType: entry.activityType, activityCategory: entry.activityCategory,
    supervisorId: supervisorName === 'Not specified' ? 'imported_unknown' : `imported_${supervisorName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    supervisorName, setting: entry.setting || '', notes: entry.notes || undefined, status: entry.status,
    createdAt: now, updatedAt: now,
    supervisionMinutes: entry.supervisionMinutes || undefined,
    observationMinutes: entry.observationMinutes || undefined,
    individualSupervisionMinutes: entry.individualSupervisionMinutes || undefined,
    aiGenerated: true, aiConfidence: entry.confidence,
    aiRationale: entry.summaryDerived
      ? 'Baker AI extracted this as a monthly aggregate. Review it against the source before importing.'
      : 'Baker AI extracted this record from the migration source. Review it before importing.',
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
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
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

function isChromiumBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /(Chrome|Chromium|Edg)\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent);
}

export default function SmartImportBridge() {
  const email = getCurrentUserEmail() || EMILY_EMAIL;
  const reviewRef = useRef<HTMLDivElement | null>(null);
  const bridgeTimeoutRef = useRef<number | null>(null);
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [processingVisible, setProcessingVisible] = useState(false);
  const [ripleyConsent, setRipleyConsent] = useState(false);
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [bridgeVersion, setBridgeVersion] = useState('');
  const [bridgeStatus, setBridgeStatus] = useState('Open Ripley, go to Total Hours / Hours History, then return here and click Baker Bridge.');
  const [installingPackage, setInstallingPackage] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const isChromium = isChromiumBrowser();

  const selectedEntries = useMemo(() => entries.filter((entry) => selectedIds.has(entry.id)), [entries, selectedIds]);
  const selectedHours = useMemo(() => selectedEntries.reduce((sum, entry) => sum + entry.duration, 0), [selectedEntries]);

  const pingBridge = () => {
    window.postMessage({ source: WEB_SOURCE, type: 'BAKER_BRIDGE_PING' }, window.location.origin);
  };

  useEffect(() => {
    const receiveExtension = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.source !== EXT_SOURCE) return;
      if (event.data.type === 'BAKER_BRIDGE_EXTENSION_READY') {
        setBridgeAvailable(true);
        setBridgeVersion(String(event.data.version || 'beta'));
        setBridgeStatus('Baker Bridge connected. Open Ripley, go to Total Hours, come back here, and click Baker Bridge.');
      }
    };
    window.addEventListener('message', receiveExtension);
    pingBridge();
    const timer = window.setTimeout(pingBridge, 500);
    return () => {
      window.removeEventListener('message', receiveExtension);
      window.clearTimeout(timer);
    };
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
    setProgress(12);
    setMessage('');
    await nextPaint();
    const chunks = splitText(rawText);
    const converted: HourEntry[] = [];
    const nextWarnings: string[] = [];
    setStage('reading');
    setProgress(18);
    await nextPaint();

    for (let index = 0; index < chunks.length; index += 1) {
      setStage('structuring');
      setProgress(22 + Math.round(((index + 0.25) / chunks.length) * 62));
      await shortYield();
      const payload = await callMigration({
        rawText: chunks[index], fileName: `${sourceHint}-part-${index + 1}.txt`, sourceHint,
      });
      converted.push(...(payload.entries || []).map((entry) => aiToHourEntry(entry, email, payload.detectedSource || sourceHint)));
      if (payload.warnings?.length) nextWarnings.push(...payload.warnings);
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
    await new Promise((resolve) => setTimeout(resolve, 700));
    setProcessingVisible(false);
    setBridgeStatus(`Transfer complete — ${converted.length} proposed record${converted.length === 1 ? '' : 's'} ready to review.`);
    window.setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  useEffect(() => {
    const receiveBridgeResult = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || event.data?.source !== EXT_SOURCE) return;
      if (event.data.type === 'BAKER_BRIDGE_STARTED') {
        setProcessingVisible(true);
        setStage('connecting');
        setProgress(7);
        setMessage('');
        return;
      }
      if (event.data.type !== 'BAKER_BRIDGE_RESULT') return;
      if (bridgeTimeoutRef.current !== null) {
        window.clearTimeout(bridgeTimeoutRef.current);
        bridgeTimeoutRef.current = null;
      }
      const response = (event.data.response || {}) as BridgeResponse;
      if (!response.ok || !response.payload) {
        const detail = response.message || 'Baker Bridge could not read the Ripley Total Hours page.';
        setStage('error');
        setProgress(100);
        setMessage(detail);
        setBridgeStatus(detail);
        window.setTimeout(() => setProcessingVisible(false), 1200);
        return;
      }
      const pages = Math.max(1, Number(response.pages || 1));
      setBridgeStatus(`Ripley transfer received (${pages} page${pages === 1 ? '' : 's'}). Baker AI is structuring your hours.`);
      void runTextMigration(response.payload, `Ripley Total Hours transfer (${pages} page${pages === 1 ? '' : 's'})`).catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : 'The Ripley transfer could not be processed.';
        setStage('error');
        setProgress(100);
        setMessage(detail);
        setBridgeStatus(detail);
        window.setTimeout(() => setProcessingVisible(false), 1200);
      });
    };
    window.addEventListener('message', receiveBridgeResult);
    return () => window.removeEventListener('message', receiveBridgeResult);
  }, [entries, email]);

  const startBridge = async () => {
    if (!ripleyConsent) return;
    if (!bridgeAvailable) {
      setBridgeStatus('Install the Baker Bridge beta extension once, then refresh this page and click Check connection.');
      return;
    }
    setProcessingVisible(true);
    setStage('connecting');
    setProgress(5);
    setMessage('');
    await nextPaint();
    window.postMessage({ source: WEB_SOURCE, type: 'BAKER_BRIDGE_START' }, window.location.origin);
    bridgeTimeoutRef.current = window.setTimeout(() => {
      setStage('error');
      setProgress(100);
      setMessage('Baker Bridge did not answer in time. Make sure Ripley is open on Total Hours and try again.');
      setBridgeStatus('Bridge timed out. Keep the Ripley Total Hours tab open and try again.');
      window.setTimeout(() => setProcessingVisible(false), 1200);
    }, 45_000);
  };

  const openRipley = () => {
    if (!ripleyConsent) return;
    const popup = window.open('https://ripleyfieldworktracker.com/login/', 'baker-ripley-import');
    setBridgeStatus(popup
      ? 'Ripley opened. Sign in, navigate to Total Hours / Hours History, then return to this Baker tab and click Baker Bridge.'
      : 'Popup blocked. Allow popups for Fieldwork by Baker and try again.');
  };

  const downloadBridgePackage = async () => {
    setInstallingPackage(true);
    setMessage('');
    try {
      const names = ['manifest.json', 'background.js', 'baker-content.js'];
      const files = await Promise.all(names.map(async (name) => {
        const response = await fetch(`/baker-bridge/${name}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Could not download ${name}.`);
        return { name, data: new TextEncoder().encode(await response.text()) };
      }));
      const zip = buildStoreZip(files);
      const arrayBuffer = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
      const url = URL.createObjectURL(new Blob([arrayBuffer], { type: 'application/zip' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'fieldwork-by-baker-bridge-beta.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setBridgeStatus('Bridge package downloaded. Unzip it, open chrome://extensions, enable Developer mode, choose Load unpacked, and select the unzipped folder. Then refresh Baker.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not prepare the Baker Bridge package.');
    } finally {
      setInstallingPackage(false);
    }
  };

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
            const parsed = dataRows.map((row) => buildDelimitedEntry(headers, row, email, file.name)).filter((entry): entry is HourEntry => Boolean(entry));
            collected.push(...parsed);
            if (parsed.length < dataRows.length) nextWarnings.push(`${file.name}: ${dataRows.length - parsed.length} rows were skipped because a date and duration could not be identified.`);
          }
        } else if (lower.endsWith('.txt') || lower.endsWith('.json')) {
          for (const chunk of splitText(await file.text())) {
            const payload = await callMigration({ rawText: chunk, fileName: file.name, sourceHint: file.name });
            collected.push(...(payload.entries || []).map((entry) => aiToHourEntry(entry, email, payload.detectedSource || file.name)));
            if (payload.warnings?.length) nextWarnings.push(...payload.warnings);
          }
        } else {
          if (file.size > 2_250_000) {
            nextWarnings.push(`${file.name}: file is above the secure direct-upload limit. Split it into smaller PDFs and try again.`);
            continue;
          }
          const payload = await callMigration({
            fileName: file.name, mimeType: file.type || 'application/octet-stream', fileData: await fileToBase64(file),
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
      window.setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (error) {
      setStage('error');
      setProgress(100);
      setMessage(error instanceof Error ? error.message : 'Baker could not process this file.');
      window.setTimeout(() => setProcessingVisible(false), 1000);
    }
  };

  const toggleEntry = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const saveSelected = async () => {
    if (selectedEntries.length === 0 || isImporting) return;
    setIsImporting(true);
    setImportedCount(null);
    setProcessingVisible(true);
    setStage('checking');
    setProgress(15);
    await nextPaint();
    try {
      const existing = appendEntries([], email);
      const before = new Set(existing.map((entry) => [entry.date, entry.startTime, entry.endTime, entry.duration, entry.activityType, entry.supervisorName].join('|')));
      const batchSize = 100;
      for (let start = 0; start < selectedEntries.length; start += batchSize) {
        const batch = selectedEntries.slice(start, start + batchSize);
        appendEntries(batch, email);
        setProgress(20 + Math.round(((start + batch.length) / selectedEntries.length) * 75));
        await shortYield();
      }
      const imported = selectedEntries.filter((entry) => !before.has([entry.date, entry.startTime, entry.endTime, entry.duration, entry.activityType, entry.supervisorName].join('|'))).length;
      setImportedCount(imported);
      setProgress(100);
      setStage('ready');
      await new Promise((resolve) => setTimeout(resolve, 650));
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
            <div className="mt-7 h-2.5 rounded-full bg-[#EFE7E2] overflow-hidden"><div className="h-full rounded-full bg-[#E85D70] transition-all duration-500" style={{ width: `${Math.max(5, progress)}%` }} /></div>
            <div className="mt-3 flex items-center justify-between text-xs text-[#A8998E]"><span>{stage === 'structuring' ? 'Large histories take a little longer.' : 'Please keep this Baker tab open.'}</span><span className="font-mono">{Math.round(progress)}%</span></div>
            {!['ready', 'error'].includes(stage) && <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#5C70C4]"><Loader2 size={16} className="animate-spin" /> Working securely…</div>}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div><div className="text-sm font-semibold text-[#E85D70] mb-2">Paid migration concierge</div><h1 className="font-serif text-4xl font-semibold text-[#332C28] mb-2">Leave Ripley without re-entering your hours</h1><p className="text-[#6B5D54] max-w-3xl">Open Ripley, go to Total Hours, return to Baker, and click one button. Baker Bridge reads only that authorized fieldwork view and Baker AI prepares everything for review.</p></div>
          <Link to="/dashboard" className="text-sm text-[#E85D70] font-medium">Back to dashboard</Link>
        </div>

        <section className="rounded-3xl border border-[#E5D9D4] bg-gradient-to-br from-[#FFF5F7] via-white to-[#F6F8FF] p-7 sm:p-8 shadow-sm mb-6">
          <div className="flex items-start gap-4"><div className="w-12 h-12 rounded-2xl bg-[#332C28] text-white flex items-center justify-center shrink-0"><Bot size={23} /></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs uppercase tracking-[0.16em] font-bold text-[#5C70C4]">AI Ripley Transfer</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${bridgeAvailable ? 'bg-[#E9F7EF] text-[#3F7E5D]' : 'bg-[#FFF2E7] text-[#9A622B]'}`}>{bridgeAvailable ? `Bridge connected${bridgeVersion ? ` • v${bridgeVersion}` : ''}` : 'One-time Bridge setup'}</span></div><h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#332C28] mt-1">Open Ripley → Total Hours → back to Baker → Baker Bridge</h2><p className="text-sm text-[#6B5D54] mt-2 max-w-3xl">No bookmark. No Ripley password shared with Baker. The button below starts the transfer from Baker after you explicitly authorize it.</p></div></div>

          <div className="grid md:grid-cols-3 gap-3 mt-6">
            {[
              ['1', 'Open Ripley', 'Sign in normally and leave the Ripley tab open.'],
              ['2', 'Go to Total Hours', 'Navigate to Total Hours / Hours History, then return to Baker.'],
              ['3', 'Click Baker Bridge here', 'Baker starts the Ripley overlay and immediately shows the migration loading screen here.'],
            ].map(([step, title, detail]) => <div key={step} className="rounded-2xl bg-white border border-[#E9DED8] p-4"><div className="w-7 h-7 rounded-full bg-[#FFF0F3] text-[#E85D70] flex items-center justify-center text-xs font-bold mb-3">{step}</div><div className="font-semibold text-[#332C28]">{title}</div><div className="text-xs leading-relaxed text-[#8D7E75] mt-1">{detail}</div></div>)}
          </div>

          {!bridgeAvailable && (
            <div className="mt-5 rounded-2xl border border-[#E8DDD7] bg-white p-5">
              <div className="flex items-start gap-3"><PlugZap size={21} className="text-[#5C70C4] shrink-0 mt-0.5" /><div><div className="font-semibold text-[#332C28]">One-time beta setup</div><p className="text-sm text-[#6B5D54] mt-1">The direct Baker button requires the small Baker Bridge browser extension because browsers block one website from reading another site’s tab. The beta extension requests access only to Ripley pages and activates only when you click Baker Bridge.</p></div></div>
              {isChromium ? (
                <div className="mt-4"><button onClick={() => void downloadBridgePackage()} disabled={installingPackage} className="inline-flex items-center gap-2 rounded-xl bg-[#332C28] text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><Download size={16} /> {installingPackage ? 'Preparing package…' : 'Download Baker Bridge Beta'}</button><div className="mt-3 text-xs leading-relaxed text-[#8D7E75]">Unzip → open <strong>chrome://extensions</strong> → turn on <strong>Developer mode</strong> → <strong>Load unpacked</strong> → select the unzipped folder → refresh this Baker page. This is one time for the beta.</div></div>
              ) : (
                <div className="mt-4 rounded-xl bg-[#FFF7ED] px-4 py-3 text-sm text-[#8B5A2B]">The no-bookmark Bridge beta currently requires Chrome or Edge desktop. Safari needs a separately signed Safari extension. File/PDF migration below still works in Safari.</div>
              )}
              <button onClick={pingBridge} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#5C70C4]"><RefreshCw size={14} /> Check connection</button>
            </div>
          )}

          <label className="mt-5 flex items-start gap-3 text-sm text-[#4D423C] cursor-pointer"><input type="checkbox" checked={ripleyConsent} onChange={(event) => setRipleyConsent(event.target.checked)} className="mt-1" /><span>I authorize Baker to read only my fieldwork/history information from the open Ripley Total Hours / Hours History view and prepare proposed Baker entries for my review.</span></label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={!ripleyConsent} onClick={openRipley} className="btn-primary px-4 py-2.5 rounded-xl disabled:opacity-50"><ExternalLink size={15} /> Open Ripley</button>
            <button disabled={!ripleyConsent || !bridgeAvailable || processingVisible} onClick={() => void startBridge()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#5C70C4] bg-white text-[#4B5EA8] text-sm font-semibold disabled:opacity-40"><Sparkles size={16} /> Baker Bridge</button>
          </div>
          <div className="mt-3 text-sm font-medium text-[#5C70C4]">{bridgeStatus}</div>
        </section>

        <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-5 items-center mb-6">
          <section className="bg-white rounded-3xl border border-[#F2EDEA] p-7 shadow-sm"><div className="w-11 h-11 rounded-2xl bg-[#FFF5F7] text-[#E85D70] flex items-center justify-center mb-4"><FileText size={22} /></div><h2 className="font-serif text-2xl font-semibold text-[#332C28]">Or upload existing files</h2><p className="text-sm text-[#6B5D54] mt-2 mb-5">PDF, CSV, TSV, TXT, JSON, DOCX, or XLSX exports remain available.</p><label className="block cursor-pointer rounded-2xl border-2 border-dashed border-[#E2DAD5] hover:border-[#E85D70] p-7 text-center transition-colors"><input type="file" multiple accept=".pdf,.csv,.tsv,.txt,.json,.docx,.xlsx,application/pdf,text/csv,text/plain" className="hidden" onChange={(event) => { if (event.target.files) void handleFiles(event.target.files); event.currentTarget.value = ''; }} /><Upload size={27} className="mx-auto text-[#E85D70] mb-3" /><div className="font-semibold text-[#332C28]">Choose migration files</div><div className="text-xs text-[#A8998E] mt-1">Multiple files are supported</div></label></section>
          <div className="hidden lg:flex w-9 h-9 rounded-full bg-[#F4EFEC] items-center justify-center text-[#9A8A80] text-xs font-bold">OR</div>
          <section className="rounded-3xl border border-[#DDE7E1] bg-[#F8FCFA] p-7"><ShieldCheck size={25} className="text-[#5FA37E] mb-3" /><h3 className="font-serif text-xl font-semibold text-[#332C28]">Nothing imports automatically</h3><p className="text-sm leading-relaxed text-[#6B5D54] mt-2">Baker only prepares proposed records. You review dates, hours, categories, supervision, source confidence, and verification status before clicking Import.</p></section>
        </div>

        {message && !processingVisible && <div className="mb-6 rounded-2xl bg-[#FFF5F7] border border-[#F2CED5] px-5 py-4 text-sm text-[#C9445A] flex gap-2"><XCircle size={18} className="shrink-0" />{message}</div>}
        {warnings.length > 0 && <div className="mb-6 rounded-2xl bg-[#FFF9ED] border border-[#F2E3B8] px-5 py-4 text-sm text-[#806126]"><div className="font-semibold flex gap-2 items-center"><AlertTriangle size={17} />Review these extraction warnings</div>{warnings.slice(0, 8).map((warning, index) => <div key={`${warning}-${index}`} className="mt-1">• {warning}</div>)}</div>}

        <div ref={reviewRef} />
        {entries.length > 0 && (
          <section className="bg-white rounded-3xl border border-[#F2EDEA] overflow-hidden shadow-sm">
            <div className="p-6 border-b border-[#F2EDEA] flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><div className="flex items-center gap-2"><FileSpreadsheet size={18} className="text-[#D4A574]" /><h2 className="font-serif text-xl font-semibold text-[#332C28]">Review before import</h2></div><p className="text-sm text-[#A8998E] mt-1">{selectedEntries.length} of {entries.length} selected • {selectedHours.toFixed(2)} selected hours</p></div><div className="flex gap-3 text-xs font-semibold"><button onClick={() => setSelectedIds(new Set(entries.map((entry) => entry.id)))} className="text-[#5C70C4]">Select all</button><button onClick={() => setSelectedIds(new Set())} className="text-[#A8998E]">Clear</button></div></div>
            <div className="overflow-x-auto max-h-[540px]"><table className="w-full min-w-[1040px] text-sm"><thead className="sticky top-0 bg-[#FAF8F6] text-left text-xs uppercase tracking-wider text-[#A8998E]"><tr><th className="p-4">Use</th><th className="p-4">Date</th><th className="p-4">Hours</th><th className="p-4">Type</th><th className="p-4">Category</th><th className="p-4">Supervisor</th><th className="p-4">Status</th><th className="p-4">AI confidence</th><th className="p-4">Source</th></tr></thead><tbody>{entries.slice(0, 500).map((entry) => <tr key={entry.id} className="border-t border-[#F2EDEA]"><td className="p-4"><input type="checkbox" checked={selectedIds.has(entry.id)} onChange={() => toggleEntry(entry.id)} /></td><td className="p-4">{entry.date}</td><td className="p-4 font-mono">{entry.duration}</td><td className="p-4">{entry.fieldworkType}</td><td className="p-4">{entry.activityCategory}</td><td className="p-4">{entry.supervisorName}</td><td className="p-4">{entry.status}</td><td className="p-4">{entry.aiGenerated ? `${Math.round((entry.aiConfidence || 0) * 100)}%` : '—'}</td><td className="p-4 max-w-[240px] truncate" title={entry.aiSourceText}>{entry.aiSourceText || 'File import'}</td></tr>)}</tbody></table></div>
            <div className="p-6 border-t border-[#F2EDEA] flex flex-col md:flex-row md:items-center justify-between gap-4"><div>{sources.length > 0 && <div className="text-xs text-[#A8998E] mb-1">Sources: {sources.join(' • ')}</div>}<div className="text-xs text-[#8D7E75]">Nothing is saved until you click Import. Duplicate records are skipped and saves run in batches of 100.</div></div><button disabled={selectedEntries.length === 0 || isImporting} onClick={() => void saveSelected()} className="btn-primary px-6 py-3 rounded-xl disabled:opacity-50 whitespace-nowrap">{isImporting ? 'Importing…' : `Import ${selectedEntries.length} records`} <ChevronRight size={16} /></button></div>
          </section>
        )}

        {importedCount !== null && <div className="mt-6 rounded-3xl border border-[#CFE5D8] bg-[#F5FBF7] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div className="flex gap-3"><CheckCircle2 size={24} className="text-[#5FA37E] shrink-0" /><div><div className="font-semibold text-[#332C28]">Migration saved</div><div className="text-sm text-[#6B5D54]">{importedCount} new record{importedCount === 1 ? '' : 's'} added. Existing duplicates were skipped.</div></div></div><Link to="/dashboard" className="text-sm font-semibold text-[#5FA37E]">Go to dashboard</Link></div>}
      </div>
    </div>
  );
}
