import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Archive, Download, FileText, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { loadEntries } from '@/lib/fieldworkStore';
import { FIELDS, MIGRATION_VERSION, auditCsv, buildPreview, guessMapping, isMonthlySummary, parseSource, planMerge, selectionProblem, type AuditEntry, type Field, type ImportOptions, type Mapping, type MigrationPreview, type SourceTable } from '@/lib/detailedMigration';
import { archiveFile, downloadOriginal, auditHtml, commitMigration, downloadAuditArchive, downloadBytes, listBatches, listDocuments, type AuditBatch, type SourceDocument } from '@/lib/migrationArchive';
import { buildStoreZip } from '@/lib/downloadZip';
import RipleyPdfGuide from '@/components/RipleyPdfGuide';
import { readRipleyPdf, pdfReportsToTable, type PdfSource } from '@/lib/ripleyPdfImport';

const panel = 'rounded-2xl border border-[#F2EDEA] bg-white p-5 dark:border-white/10 dark:bg-[#211D1A]';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#E85D70] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40';
const field = 'w-full rounded-xl border border-[#E2DAD5] bg-white p-2.5 text-sm dark:border-white/15 dark:bg-[#171412]';
const hours = (entries: AuditEntry[]) => entries.reduce((sum, e) => sum + e.duration, 0).toFixed(2);
export default function DetailedMigration() {
  const { user, hasPaidFeatures, isLoading } = useAuth();
  const owner = user?.email || '', location = useLocation(), isAudit = location.pathname === '/audit-history';
  const [existing, setExisting] = useState<AuditEntry[]>([]), [documents, setDocuments] = useState<SourceDocument[]>([]), [batches, setBatches] = useState<AuditBatch[]>([]);
  const [table, setTable] = useState<SourceTable | null>(null), [doc, setDoc] = useState<SourceDocument | null>(null);
  const [mapping, setMapping] = useState<Mapping>({}), [options, setOptions] = useState<ImportOptions>({ sourceSystem: 'Ripley', dateOrder: 'MDY' });
  const [preview, setPreview] = useState<MigrationPreview | null>(null), [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [acknowledged, setAcknowledged] = useState(false), [replaceSummaries, setReplaceSummaries] = useState(false), [allowMatching, setAllowMatching] = useState(false);
  const [expectedCount, setExpectedCount] = useState(''), [expectedHours, setExpectedHours] = useState('');
  const [sourceScopeWarning, setSourceScopeWarning] = useState('');
  const [allowPartial, setAllowPartial] = useState(false);
  const [pdfSources, setPdfSources] = useState<PdfSource[]>([]);
  const [pdfProgress, setPdfProgress] = useState('');
  const [sourceOverlapsReviewed, setSourceOverlapsReviewed] = useState(false);
  const [query, setQuery] = useState(''), [month, setMonth] = useState(''), [organization, setOrganization] = useState(''), [supervisor, setSupervisor] = useState('');
  const [reviewPage, setReviewPage] = useState(0), [ledgerPage, setLedgerPage] = useState(0);
  const [bridgeState, setBridgeState] = useState(''), [bridgeReady, setBridgeReady] = useState(false), [bridgeConsent, setBridgeConsent] = useState(false);
  const bridgeRequest = useRef('');
  const pdfBatchComplete = useRef(false);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const chosen = useMemo(() => preview?.entries.filter(e => selectedSet.has(e.id)) || [], [preview, selectedSet]);
  const merge = useMemo(() => planMerge(existing, chosen), [existing, chosen]);
  const filtered = useMemo(() => existing.filter(e => (!month || e.date.startsWith(month)) && (!organization || e.organizationName === organization) && (!supervisor || e.supervisorName === supervisor) && `${e.notes || ''} ${e.date} ${e.supervisorName} ${e.organizationName || ''} ${e.migration?.sourceId || ''}`.toLowerCase().includes(query.toLowerCase())), [existing, month, organization, supervisor, query]);
  async function refresh() {
    if (!owner) return;
    setExisting(loadEntries(owner) as AuditEntry[]);
    setDocuments(await listDocuments(owner)); setBatches(await listBatches(owner));
  }
  useEffect(() => {
    if (!owner) return;
    const reload = () => { void refresh().catch(e => setMessage(String(e.message || e))); };
    reload(); window.addEventListener('fieldwork:entries-changed', reload); window.addEventListener('storage', reload);
    return () => { window.removeEventListener('fieldwork:entries-changed', reload); window.removeEventListener('storage', reload); };
  }, [owner]);
  function resetPreview() { setPreview(null); setSelected([]); setAcknowledged(false); setReplaceSummaries(false); setAllowMatching(false); setAllowPartial(false); setReviewPage(0); }
  async function readFile(file: File, origins?: SourceTable['origins']) {
    if (!owner || !hasPaidFeatures) throw new Error('An active trial or plan is required for new imports.');
    resetPreview(); setTable(null); setDoc(null); setSourceScopeWarning(''); setPdfSources([]); setPdfProgress('');
    if (!/\.(csv|tsv|txt|json)$/i.test(file.name)) throw new Error('Use a detailed CSV, TSV or JSON entry export. A monthly PDF cannot supply original entry narratives; preserve it under Supporting documents.');
    const stored = await archiveFile(file, owner, 'detailed-source'); setDoc(stored);
    const sourceText = new TextDecoder('utf-8', { fatal: true }).decode(stored.bytes);
    if (/\.json$/i.test(file.name)) {
      const json = JSON.parse(sourceText);
      if (json?.capture) setSourceScopeWarning('Detail Bridge capture: ONLY the linked entry forms from the selected page. Other months, organizations, pages and attachments may be missing. ' + (Array.isArray(json.warnings) ? json.warnings.map(String).join(' ') : '') + (json.capture.failed?.length ? ' UNREAD ENTRIES: ' + json.capture.failed.length + '. Resolve these before retiring the source.' : ''));
    }
    const parsed = parseSource(sourceText, file.name);
    setTable({ ...parsed, origins }); setMapping(guessMapping(parsed.headers)); setExpectedCount(''); setExpectedHours('');
    setMessage(`${parsed.rows.length} original rows preserved. Map columns and build the review before tracking anything.`); await refresh();
  }
  async function readFiles(files: File[]) {
    if (files.some(file => /\.pdf$/i.test(file.name))) {
      if (files.some(file => !/\.pdf$/i.test(file.name))) throw new Error('Import your monthly PDFs together. Import CSV/TSV/JSON files in a separate batch.');
      return readMonthlyPdfs(files);
    }
    if (files.length === 1) return readFile(files[0]);
    if (!files.length) return;
    if (!owner || !hasPaidFeatures) throw new Error('An active trial or plan is required for new imports.');
    resetPreview(); setTable(null); setDoc(null);
    const records: Record<string, unknown>[] = [];
    const origins: NonNullable<SourceTable['origins']> = [];
    for (const file of files) {
      if (!/\.(csv|tsv|txt|json)$/i.test(file.name)) throw new Error('Detailed files must be CSV/TSV/JSON; archive PDFs separately.');
      const original = await archiveFile(file, owner, 'detailed-source');
      const parsed = parseSource(new TextDecoder('utf-8', { fatal: true }).decode(original.bytes), file.name);
      parsed.rows.forEach((row, index) => {
        const record: Record<string, unknown> = Object.create(null);
        parsed.headers.forEach((header, column) => { record[Object.prototype.hasOwnProperty.call(record, header) ? header + ' [column ' + (column + 1) + ']' : header] = row[column]; });
        record.__bakerSource = { filename: file.name, sha256: original.hash, sourceRow: index + 2, original: parsed.originals[index] };
        origins.push({ filename: file.name, sha256: original.hash, sourceRow: index + 2, original: parsed.originals[index] });
        records.push(record);
      });
    }
    await readFile(new File([JSON.stringify({ entries: records, combinedOnDevice: true })], 'combined-detailed-sources.json', { type: 'application/json' }), origins);
  }
  async function readMonthlyPdfs(files: File[]) {
    if (!owner || !hasPaidFeatures) throw new Error('An active trial or plan is required for new imports.');
    if (files.length > 40 || files.reduce((n,f)=>n+f.size,0) > 100*1024*1024) throw new Error('Choose up to 40 monthly PDFs and 100 MB per batch. Each PDF must be 25 MB or smaller.');
    pdfBatchComplete.current = false;
    resetPreview(); setTable(null); setDoc(null); setPdfSources([]); setSourceScopeWarning(''); setSourceOverlapsReviewed(false);
    const sources: PdfSource[] = [];
    const seenFiles=new Set<string>();
    for (let index=0;index<files.length;index++) {
      const file=files[index];
      setPdfProgress(`Reading file ${index+1} of ${files.length}: ${file.name}`);
      const original=await archiveFile(file,owner,'detailed-source');
      if (seenFiles.has(original.hash)) continue;
      seenFiles.add(original.hash);
      const report=await readRipleyPdf(original.bytes,(page,total)=>setPdfProgress(`${file.name}: page ${page} of ${total} · file ${index+1} of ${files.length}`));
      sources.push({filename:file.name,hash:original.hash,report}); setPdfSources([...sources]);
      if (!report.reconciled) { await refresh(); throw new Error(`${file.name}: ${report.errors.join(' ')} No tracked entries were added. Reprint all pages of this month.`); }
    }
    const candidates = new Set(sources.map(source => source.report.supervisee.trim().toLowerCase()));
    if (candidates.size !== 1 || candidates.has('')) throw new Error('All PDFs in one batch must identify the same candidate. Separate different users’ reports; no tracked entries were added.');
    pdfBatchComplete.current = true;
    await preparePdfReview(sources);
  }
  async function preparePdfReview(sources: PdfSource[]) {
    if (!pdfBatchComplete.current) throw new Error('The complete selected PDF batch has not been read successfully. Reselect all valid month files; no partial batch is ready to import.');
    const parsed=await pdfReportsToTable(sources);
    const reviewFile=new File([JSON.stringify({format:'baker-ripley-pdf-review-v1',entries:parsed.originals},null,2)],'ripley-detailed-pdf-review.json',{type:'application/json'});
    const reviewDoc=await archiveFile(reviewFile,owner,'detailed-source');
    const detectedMapping=guessMapping(parsed.headers);
    const actualOptions: ImportOptions={sourceSystem:'Ripley',dateOrder:'MDY'};
    const result=await buildPreview(parsed,detectedMapping,actualOptions,{name:reviewDoc.filename,hash:reviewDoc.hash},owner);
    setTable(parsed);setDoc(reviewDoc);setMapping(detectedMapping);setOptions(actualOptions);setPreview(result);setSelected(result.entries.map(e=>e.id));
    setExpectedCount(String(parsed.rows.length));setExpectedHours(String(sources.reduce((n,x)=>n+x.report.totals.totalHours,0)));
    setPdfProgress(`Finished reading ${sources.length} PDF${sources.length===1?'':'s'}. Nothing is tracked until you approve the review.`);
    setMessage(`${parsed.rows.length} individual source sessions read from ${sources.length} detailed monthly PDF${sources.length===1?'':'s'}. Review the per-month reconciliation and import when ready.`);
    await refresh();
  }
  async function perform(action: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Operation failed. No success was assumed.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== window || event.data?.source !== 'BAKER_DETAIL_EXTENSION') return;
      if (event.data.type === 'READY') { setBridgeReady(true); return; }
      if (event.data.requestId !== bridgeRequest.current) return;
      if (event.data.type === 'PROGRESS') setBridgeState(String(event.data.message || 'Capturing source entries…'));
      if (event.data.type === 'RESULT') {
        bridgeRequest.current = ''; setBusy(false);
        if (!event.data.ok) { setMessage(String(event.data.error || 'Detailed capture did not finish. Use an original detailed export.')); return; }
        const report = event.data.report;
        if (!report || !Array.isArray(report.entries)) { setMessage('Invalid capture response. No entries imported.'); return; }
        setBridgeState(`${report.entries.length} detail records captured. ${report.warnings?.join(' ') || ''} Confirm count and date range against Ripley; capture is not a completeness guarantee.`);
        const file = new File([JSON.stringify(report, null, 2)], 'ripley-detailed-capture.json', { type: 'application/json' });
        void perform(() => readFile(file));
      }
    }
    window.addEventListener('message', receive);
    window.postMessage({ source: 'BAKER_DETAIL_WEB', type: 'PING' }, window.location.origin);
    return () => window.removeEventListener('message', receive);
  }, [owner, hasPaidFeatures]);
  async function installBridge() {
    const files = await Promise.all(['manifest.json', 'background.js', 'content.js'].map(async name => {
      const response = await fetch(`/audit-bridge/${name}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not download ${name}.`);
      return { name, data: new Uint8Array(await response.arrayBuffer()) };
    }));
    downloadBytes('baker-detail-bridge.zip', buildStoreZip(files), 'application/zip');
    setMessage('Unzip the package. In Chrome/Edge Extensions, enable Developer mode, choose Load unpacked, and select that folder. Reload this Baker page. The extension only reads authorized Ripley entry pages; it never saves or deletes in Ripley.');
  }
  async function createPreview() {
    if (!table || !doc) return;
    const result = await buildPreview(table, mapping, options, { name: doc.filename, hash: doc.hash }, owner);
    setExisting(loadEntries(owner)); setPreview(result); setSelected(result.entries.map(e => e.id)); setAcknowledged(false);
    setMessage(`${result.rows.length} source rows checked; ${result.errors} blocked rows; ${result.warnings} rows with review flags. Nothing has been added to tracked hours yet.`);
  }
  async function commit() {
    if (!doc || !table || !preview || !acknowledged) return;
    if (pdfSources.some(source=>!source.report.reconciled) || (pdfSources.some(source=>source.report.overlapPairs.length>0) && !sourceOverlapsReviewed)) throw new Error('Review the PDF reconciliation and source overlaps before importing.');
    const issue = selectionProblem(preview, selected, allowPartial);
    if (issue) throw new Error(issue);
    if (!window.confirm(`Add ${merge.add.length} tracked allocations (${hours(merge.add)} h) as Pending? ${preview.errors} source rows are blocked and will remain in the archive. ${replaceSummaries ? 'Overlapping monthly summaries will be preserved in the audit journal and removed from live totals only if they reconcile.' : 'Existing tracked entries will not be overwritten.'}`)) return;
    const outcome = await commitMigration({ owner, doc, table, mapping, options, preview, selectedIds: selected, replaceSummaryIds: replaceSummaries ? merge.overlappingSummaries.map(e => e.id) : [], confirmPossibleDuplicates: allowMatching, allowPartial });
    setMessage(`Saved and read-back verified ${outcome.added} allocations. ${outcome.skipped} exact duplicates unchanged. Download your full audit archive and check it before retiring the source platform.`);
    resetPreview(); await refresh();
  }
  const selectionIssue = preview ? selectionProblem(preview, selected, allowPartial) : '';
  const hasSourceOverlaps = pdfSources.some(source=>source.report.overlapPairs.length>0);
  const incompleteComparisons = Boolean((expectedCount && Number(expectedCount) !== table?.rows.length) || (expectedHours && Math.abs(Number(expectedHours) - Number(hours(preview?.entries || []))) > 0.02));
  if (isLoading) return <div className="p-10" role="status">Opening your migration workspace…</div>;
  return <div className="min-h-screen bg-[#FFFCF9] px-4 py-8 text-[#332C28] dark:bg-[#171412] dark:text-white"><div className="mx-auto max-w-7xl space-y-5">
    <header><div className="flex items-center gap-2 text-sm font-bold text-[#E85D70]"><ShieldCheck size={18}/> Entry-level migration & audit history</div><h1 className="mt-2 font-serif text-4xl">Every entry. The original details. A record you can keep.</h1><p className="mt-3 max-w-4xl text-sm leading-6 text-[#6B5D54] dark:text-[#CFC4BE]">Dates, clock times, decimal hours, organizations, supervisors, classifications, observations, full activity descriptions, source fields and revision history. Monthly forms are evidence—not a substitute for individual entries.</p><div className="mt-4 flex flex-wrap gap-3"><Link className={button} to="/import">Import detailed entries</Link><Link className={button} to="/audit-history">Open audit history</Link><Link className="p-3 underline" to="/dashboard">Tracked hours</Link><Link className="p-3 underline" to="/export">Monthly worksheets</Link><a className="p-3 underline" href="#audit-ledger">Jump to individual entries</a></div><p className="mt-2 text-xs text-[#A8998E]">{MIGRATION_VERSION}</p></header>
    <div className="rounded-2xl border border-amber-400/40 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-900/15 dark:text-amber-100"><strong>Migration safety:</strong> {user?.authProvider==='supabase'?'Selected files and records are saved to your private Fieldwork account. Earlier browser records are kept separately.':'This app currently stores records and original files on this browser/device.'} Download the full audit ZIP to secure storage outside the browser. Do not close the source account until every required entry, narrative, signed form, organization and month reconciles. Hashes help detect changes but are not supervisor signatures or certified timestamps.</div>
    {message && <div role="status" className={`${panel} whitespace-pre-wrap border-[#E85D70]`}>{message}</div>}
    {!isAudit && hasPaidFeatures && <>
      <RipleyPdfGuide/>
      <section className={panel}><h2 className="font-serif text-2xl">Other import options & source details</h2><p className="my-3 text-sm leading-6">Use the source platform’s detailed CSV/TSV/JSON data export when available. For Excel exports, save the detailed sheet as CSV. Include all dates, organizations and full descriptions. Ripley’s monthly verification forms do not contain those descriptions; the detailed month-history PDFs shown above do. A screenshot or a summary table alone is not a full migration.</p><div className="flex flex-wrap gap-3"><a href="https://ripleyfieldworktracker.com/how-to-use-ripley/hour-entries/" target="_blank" rel="noreferrer" className="underline">Ripley entry guide</a><button className="underline" onClick={() => downloadBytes('request-full-fieldwork-export.txt', 'Please provide a complete machine-readable export of MY fieldwork account, with one original record per entry, including entry IDs, dates, start/end times, decimal hours and all allocations, descriptions/notes without truncation, supervisors, organizations, fieldwork type, independent/supervised, individual/group, contact and observation details, source statuses, timestamps, revisions, and copies of my signed verification forms and attachments. Please include all date ranges, inactive organizations, and archived records. Monthly summaries alone are not sufficient. Please identify any fields that cannot be exported.', 'text/plain')}>Download data-export request</button></div>
        <details className="mt-4 rounded-xl border border-[#E2DAD5] p-4 dark:border-white/10"><summary className="cursor-pointer font-semibold">No detailed export? Read authorized Ripley entry pages with Baker Detail Bridge</summary><p className="mt-3 text-sm leading-6">This separate, read-only desktop Chrome/Edge bridge follows entry edit/detail links actually present in the open Ripley month/history page, reads form values without saving, and returns a JSON export. It cannot promise an entire account from a filtered page. Capture each month/organization and verify the count. Unsupported screens and limits are explicitly reported.</p><div className="my-3 flex flex-wrap gap-3"><button disabled={busy} className={button} onClick={() => void perform(installBridge)}>Download Detail Bridge</button><a className="p-3 underline" href="https://app.ripleyfieldworktracker.com/" target="_blank" rel="noreferrer">Open Ripley</a><button className="p-3 underline" onClick={() => window.postMessage({ source: 'BAKER_DETAIL_WEB', type: 'PING' }, window.location.origin)}>Check extension</button></div><label className="flex gap-2 text-sm"><input type="checkbox" checked={bridgeConsent} onChange={e => setBridgeConsent(e.target.checked)}/>I authorize read-only capture of my fieldwork entries from the open Ripley history page and the linked entry detail pages.</label><button className={`${button} mt-3`} disabled={!bridgeReady || !bridgeConsent || busy} onClick={() => { const requestId = crypto.randomUUID(); bridgeRequest.current = requestId; setBusy(true); setBridgeState('Reading the selected Ripley history view…'); window.postMessage({ source: 'BAKER_DETAIL_WEB', type: 'START', requestId }, window.location.origin); }}>Capture entry details</button>{busy && bridgeRequest.current && <button className="ml-3 underline" onClick={() => window.postMessage({ source: 'BAKER_DETAIL_WEB', type: 'CANCEL', requestId: bridgeRequest.current }, window.location.origin)}>Stop and return captured records</button>}<p className="mt-3 text-sm" role="status">{bridgeReady ? 'Detail Bridge connected. ' : 'Detail Bridge not detected. '}{bridgeState}</p></details>
      </section>
      <section id="detailed-upload" className={panel}><h2 className="font-serif text-2xl">Upload your detailed month PDFs or entry exports</h2><p className="my-3 text-sm">Choose multiple detailed monthly PDFs together, or a separate batch of CSV/TSV/JSON exports. PDFs are detected and reconciled automatically. Each original is kept with its source references. Up to 25 MB per file / 20,000 combined rows; never silently truncated. Original files and every source column are preserved, including columns Baker does not recognize. {user?.authProvider==='supabase'?'Choosing a file uploads the original to your private Fieldwork archive.':'Files remain local.'} This detailed import does not send narratives to AI.</p><label className="block text-sm font-semibold">Detailed monthly PDFs or entry exports<input disabled={busy} type="file" multiple accept=".pdf,.csv,.tsv,.txt,.json" className="mt-2 block w-full" onChange={e => { const files = Array.from(e.target.files || []); e.currentTarget.value = ''; if (files.length) void perform(() => readFiles(files)); }}/></label>
        {pdfProgress && <p role="status" className="mt-3 text-sm text-[#E85D70]">{pdfProgress}</p>}
        {pdfSources.length>0 && <div className="mt-5 space-y-3"><h3 className="font-semibold">Each PDF checked against its original month totals</h3>{pdfSources.map((source,index)=><article key={source.hash+index} className="rounded-2xl border border-[#E2DAD5] p-4 dark:border-white/10"><div className="flex flex-wrap justify-between gap-2"><strong className="break-all">{source.filename}</strong><span className={source.report.reconciled?'text-green-700 dark:text-green-300':'text-red-600 dark:text-red-300'}>{source.report.reconciled?'Totals reconcile':'Needs attention'}</span></div><p className="mt-2 text-sm">{source.report.supervisee} · {source.report.month} · {source.report.organization} · {source.report.sessions.length} individual sessions · {source.report.pageCount} pages</p><div className="mt-3 grid grid-cols-2 gap-2 text-sm lg:grid-cols-4"><span><strong>{source.report.totals.totalHours.toFixed(2)}</strong> total h</span><span>{source.report.totals.restrictedHours.toFixed(2)} restricted h</span><span>{source.report.totals.unrestrictedHours.toFixed(2)} unrestricted h</span><span>{source.report.totals.observationMinutes} observation min</span></div><p className="mt-2 text-sm">Independent: {source.report.totals.independentHours.toFixed(2)} h · Supervised: {source.report.totals.supervisedHours.toFixed(2)} h · Group: {source.report.totals.groupHours.toFixed(2)} h</p>{source.report.errors.map((v,i)=><p className="mt-2 text-sm text-red-600 dark:text-red-300" key={'error'+i}>{v}</p>)}{source.report.warnings.map((v,i)=><p className="mt-2 text-sm text-amber-800 dark:text-amber-200" key={'warning'+i}>{v}</p>)}<details className="mt-3 text-sm"><summary className="cursor-pointer">Supervisor mapping & source overlaps</summary>{source.report.supervisors.map(p=><p className="mt-2" key={p.name}>{p.name} · {p.email} · BACB ID as printed: {p.bacbId}</p>)}{[...new Set(source.report.sessions.filter(session=>!session.supervisor).map(session=>session.supervisorAlias))].map(alias=><label key={alias} className="mt-3 block">Confirm supervisor for “{alias}”<select className={field} value="" onChange={event=>{const person=source.report.supervisors.find(p=>p.name===event.target.value);if(!person)return;resetPreview();setPdfSources(current=>current.map((item,at)=>at===index?{...item,report:{...item.report,sessions:item.report.sessions.map(session=>session.supervisorAlias===alias?{...session,supervisor:person,warnings:[...session.warnings,`Supervisor mapping confirmed by importing user: ${person.name}.`]}:session)}}:item));}}><option value="">Select from this report’s supervisor header</option>{source.report.supervisors.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select></label>)}{source.report.overlapPairs.map(([a,b])=><p className="mt-2" key={a+':'+b}>Source sessions {a} and {b} overlap on {source.report.sessions[a-1].date}. Review the original records; Baker does not change their hours automatically.</p>)}</details></article>)}{!preview && <button type="button" className={button} disabled={busy || !pdfBatchComplete.current || pdfSources.some(source=>!source.report.reconciled || source.report.sessions.some(session=>!session.supervisor))} onClick={()=>void perform(()=>preparePdfReview(pdfSources))}>Prepare PDF review</button>}</div>}
        {table && <><div className="my-5 grid gap-3 sm:grid-cols-3"><label className="text-sm">Source platform<input disabled={busy} value={options.sourceSystem} onChange={e => { resetPreview(); setOptions({ ...options, sourceSystem: e.target.value }); }} className={field}/></label><label className="text-sm">Source date order<select disabled={busy} value={options.dateOrder} onChange={e => { resetPreview(); setOptions({ ...options, dateOrder: e.target.value as 'MDY' | 'DMY' }); }} className={field}><option value="MDY">Month / day / year (US)</option><option value="DMY">Day / month / year</option></select></label><label className="text-sm">Only if missing: actual fieldwork type<select disabled={busy} value={options.defaultFieldworkType || ''} onChange={e => { resetPreview(); setOptions({ ...options, defaultFieldworkType: e.target.value as ImportOptions['defaultFieldworkType'] || undefined }); }} className={field}><option value="">Require value in each source row</option><option value="SUPERVISED">Supervised Fieldwork — I confirm</option><option value="CONCENTRATED">Concentrated — I confirm</option></select></label></div><details open={!pdfSources.length}><summary className="cursor-pointer font-semibold">Column mapping ({table.headers.length} source columns)</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(Object.keys(FIELDS) as Field[]).map(key => <label className="text-xs" key={key}>{FIELDS[key][0]}<select disabled={busy || pdfSources.length>0} value={mapping[key] ?? -1} className={field} onChange={e => { resetPreview(); setMapping({ ...mapping, [key]: Number(e.target.value) < 0 ? undefined : Number(e.target.value) }); }}><option value={-1}>Not recorded / not mapped</option>{table.headers.map((h, i) => <option key={i} value={i}>{i + 1}. {h} · {table.rows[0]?.[i]?.slice(0, 55)}</option>)}</select></label>)}</div></details><button disabled={busy || !options.sourceSystem.trim() || pdfSources.length>0} className={`${button} mt-5`} onClick={() => void perform(createPreview)}>{pdfSources.length ? 'PDF review prepared automatically' : busy ? 'Checking source…' : 'Build entry-by-entry review'}</button><p className="mt-3 text-xs break-all">Source SHA-256: {doc?.hash}</p>{sourceScopeWarning && <p className="mt-4 rounded-xl border border-amber-400 p-3 text-sm" role="note">{sourceScopeWarning}</p>}</>}
      </section>
      {preview && <section className={panel}><h2 className="font-serif text-2xl">3. Review & reconcile before adding hours</h2><p className="my-3 text-sm">{table?.rows.length} original rows → {preview.entries.length} tracked allocations. {preview.errors} blocked rows. {preview.warnings} rows with review flags. Exact duplicates: {merge.duplicate.length}. Selecting any allocation keeps the entire original session together. Conflicting source IDs: {merge.conflicts.length}. All rejected and unselected rows remain in the source file; committing also journals this full review.</p><div className="my-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Source entry count (optional cross-check)<input className={field} type="number" min="0" value={expectedCount} onChange={e => setExpectedCount(e.target.value)}/></label><label className="text-sm">Source total hours (same scope, optional)<input className={field} type="number" step="any" min="0" value={expectedHours} onChange={e => setExpectedHours(e.target.value)}/></label></div>{incompleteComparisons && <p className="text-red-600 dark:text-red-300">Count or hours do not match your source cross-check. Resolve this before committing.</p>}
        <div className="my-3 flex gap-4 text-sm"><button onClick={() => setSelected(preview.entries.map(e => e.id))} className="underline">Select all valid rows</button><button onClick={() => setSelected([])} className="underline">Clear selection</button><span>{selected.length} allocations / {hours(chosen)} h selected</span></div>
        <div className="space-y-3">{preview.rows.slice(reviewPage * 25, reviewPage * 25 + 25).map(row => <details key={row.row} className="rounded-xl border border-[#E2DAD5] p-3 dark:border-white/10"><summary className="cursor-pointer"><span className="font-semibold">Source row {row.row}</span> · {row.entries[0]?.date || 'Blocked'} · {row.entries.length} allocation(s) · {row.entries[0]?.organizationName || 'Organization missing'} · {row.errors.length ? 'Needs correction' : row.warnings.length ? 'Review flags' : 'Mapped'}</summary><p className="my-2 whitespace-pre-wrap text-sm">{row.entries[0]?.notes || 'No narrative in mapped fields.'}</p>{row.entries.map(e => <label key={e.id} className="my-2 flex gap-2 text-sm"><input type="checkbox" checked={selectedSet.has(e.id)} onChange={event => setSelected(ids => event.target.checked ? [...new Set([...ids, ...row.entries.map(part => part.id)])] : ids.filter(id => !row.entries.some(part => part.id === id)))}/>{e.activityCategory} · {e.duration.toFixed(2)} h · {e.supervisorName} · {e.workPresence || 'Presence unknown'}</label>)}{row.errors.map((v, i) => <p className="text-sm text-red-600 dark:text-red-300" key={'e' + i}>{v}</p>)}{row.warnings.map((v, i) => <p className="text-sm text-amber-800 dark:text-amber-200" key={'w' + i}>{v}</p>)}<h3 className="mt-3 text-sm font-bold">Every original source column</h3><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(table?.originals[row.row - 2], null, 2)}</pre></details>)}</div><Pager page={reviewPage} total={preview.rows.length} setPage={setReviewPage}/>
        {merge.overlappingSummaries.length > 0 && <div className="my-4 rounded-xl border border-amber-400 p-4"><h3 className="font-semibold">Double-counting protection</h3><p className="my-2 text-sm">These old monthly summaries overlap the detailed import: {merge.overlappingSummaries.map(e => `${e.date.slice(0, 7)} / ${e.duration.toFixed(2)} h`).join('; ')}. A partial page cannot replace a full month. Commit is blocked unless the old totals reconcile within 0.02 h and the organization scope is consistent.</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={replaceSummaries} onChange={e => setReplaceSummaries(e.target.checked)}/>Preserve these summaries in the audit journal and remove them from live totals once the detailed records reconcile.</label></div>}
        {merge.possibleDuplicates.length > 0 && <label className="my-3 flex gap-2 text-sm"><input type="checkbox" checked={allowMatching} onChange={e => setAllowMatching(e.target.checked)}/>I reviewed {merge.possibleDuplicates.length} matching-value records with different/missing source IDs. They are separate legitimate entries; keep both. Otherwise deselect them.</label>}
        {(preview.errors > 0 || selected.length < preview.entries.length) && <div className="my-4 rounded-xl border border-amber-400 p-4"><label className="flex gap-2 text-sm"><input type="checkbox" checked={allowPartial} onChange={e => setAllowPartial(e.target.checked)}/>Intentionally import only the selected valid sessions. This is a PARTIAL import, not a completed migration.</label></div>}
        {selectionIssue && <p className="my-3 text-sm text-amber-800 dark:text-amber-200" role="note">{selectionIssue}</p>}
        {hasSourceOverlaps && <label className="my-4 flex gap-2 rounded-xl border border-amber-400 p-3 text-sm"><input type="checkbox" checked={sourceOverlapsReviewed} onChange={e=>setSourceOverlapsReviewed(e.target.checked)}/>I reviewed the overlapping source time ranges. Import the original records unchanged; any corrections will be made transparently with my supervisor.</label>}
        <label className="my-4 flex gap-2 text-sm"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}/>I reviewed the source rows, scope, flags and totals. Missing narratives/times are not recreated. Historical approvals are evidence only; these entries begin Pending in Baker.</label><button className={button} disabled={busy || !acknowledged || (hasSourceOverlaps && !sourceOverlapsReviewed) || !!selectionIssue || incompleteComparisons || !merge.add.length || !!merge.conflicts.length || (!!merge.overlappingSummaries.length && !replaceSummaries) || (!!merge.possibleDuplicates.length && !allowMatching)} onClick={() => void perform(commit)}>{busy ? 'Saving and verifying…' : 'Import selected entries'}</button>
      </section>}
    </>}
    <section id="supporting-documents" className={panel}><h2 className="font-serif text-2xl">Supporting documents & original files</h2><p className="my-3 text-sm">Keep signed monthly/final verification forms, supervision contracts, source exports and attachments here. They do not add hours to the tracker. Do not include unnecessary client-identifying information. Upload only your own authorized records. {user?.authProvider==='supabase'&&'Selected files are uploaded to your private Fieldwork account.'}</p><label className="block text-sm">Preserve supporting files (25 MB each)<input type="file" multiple disabled={busy} className="mt-2 block w-full" onChange={e => { const files = Array.from(e.target.files || []); e.currentTarget.value = ''; void perform(async () => { for (const f of files) await archiveFile(f, owner, 'supporting-document'); await refresh(); setMessage('Supporting files preserved and hash-verified. No hours added.'); }); }}/></label><div className="my-4 space-y-2">{documents.map(d => <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF8F6] p-3 text-sm dark:bg-white/5"><div className="min-w-0"><span className="break-all">{d.filename}</span> · {(d.size / 1024).toFixed(0)} KB · {d.kind}<div className="break-all text-xs text-[#A8998E]">SHA-256 {d.hash}</div></div><button className="shrink-0 underline" onClick={() => void perform(() => downloadOriginal(d))}>Download original</button></div>)}</div><button disabled={busy} className={button} onClick={() => void perform(async () => { await downloadAuditArchive(owner); setMessage('Full audit ZIP generated. Open the downloaded file and preserve it outside this browser before retiring any source platform.'); })}><Archive size={16}/>Download full audit ZIP</button><p className="mt-2 text-xs">Contains ALL current records, import journals, source rows, before-import snapshots, original files, readable HTML, CSV and an integrity manifest—not only the filtered view below.</p></section>
    <section id="audit-ledger" className={panel}><h2 className="font-serif text-2xl">Entry-by-entry audit ledger</h2><p className="my-2 text-sm">Expand any entry to see what was done, who was responsible, source values, Baker feedback and revisions. {existing.filter(isMonthlySummary).length} older monthly summaries are still present; they are not evidence of individual activities.</p><div className="my-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs">Search narrative/date/ID<input className={field} value={query} onChange={e => { setQuery(e.target.value); setLedgerPage(0); }}/></label><label className="text-xs">Month<input type="month" className={field} value={month} onChange={e => { setMonth(e.target.value); setLedgerPage(0); }}/></label><label className="text-xs">Organization<select className={field} value={organization} onChange={e => { setOrganization(e.target.value); setLedgerPage(0); }}><option value="">All organizations</option>{[...new Set(existing.map(e => e.organizationName).filter(Boolean))].map(o => <option key={o}>{o}</option>)}</select></label><label className="text-xs">Supervisor<select className={field} value={supervisor} onChange={e => { setSupervisor(e.target.value); setLedgerPage(0); }}><option value="">All supervisors</option>{[...new Set(existing.map(e => e.supervisorName))].map(s => <option key={s}>{s}</option>)}</select></label></div><div className="my-4 flex flex-wrap gap-3"><span className="p-2 text-sm">{filtered.length} records · {hours(filtered)} h</span><button className="underline" onClick={() => downloadBytes('baker-filtered-entry-ledger.csv', auditCsv(filtered), 'text/csv;charset=utf-8')}><Download size={14} className="mr-1 inline"/>CSV of this view</button><button className="underline" onClick={() => downloadBytes('baker-filtered-entry-ledger.html', auditHtml(filtered), 'text/html;charset=utf-8')}><FileText size={14} className="mr-1 inline"/>Printable audit report</button></div>
      <div className="space-y-3">{filtered.slice(ledgerPage * 25, ledgerPage * 25 + 25).map(e => <details key={e.id} className="rounded-xl border border-[#E2DAD5] p-4 dark:border-white/10"><summary className="cursor-pointer text-sm font-semibold">{e.date} · {e.duration.toFixed(2)} h · {e.activityCategory} · {e.supervisorName} · {e.organizationName || 'Organization missing'} · {isMonthlySummary(e) ? 'MONTHLY SUMMARY ONLY' : e.status}</summary><p className="mt-4 whitespace-pre-wrap text-sm leading-7">{e.notes || 'Narrative not recorded in this entry.'}</p><div className="my-3 text-sm">{e.startTime || 'Start unknown'}–{e.endTime || 'End unknown'} · {e.workPresence || 'Presence unknown'} · {e.supervisionFormat || 'Format unknown'}</div><p className="text-sm">Supervision: {e.supervisionMinutes ?? 'not recorded'} min · Observation: {e.observationMinutes ?? 'not recorded'} min · {e.observationMode || 'Mode unknown'}</p>{e.migration && <p className="my-3 text-xs break-all">Source: {e.migration.sourceFile}, row {e.migration.sourceRow}{e.migration.sourcePages?.length ? `, PDF page(s) ${e.migration.sourcePages.join(', ')}` : ''}, entry ID {e.migration.sourceId || 'absent'}. Original source clock range: {e.migration.sourceStart}–{e.migration.sourceEnd}. Original status: {e.migration.originalStatus || 'absent'}. SHA-256: {e.migration.sourceHash}</p>}<details className="mt-3"><summary className="cursor-pointer font-semibold">Full record, all source columns, feedback & revisions</summary><pre className="mt-3 max-h-[34rem] overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(e, null, 2)}</pre></details></details>)}</div><Pager page={ledgerPage} total={filtered.length} setPage={setLedgerPage}/>
    </section>
    <section className={panel}><h2 className="font-serif text-2xl">Migration journal</h2>{!batches.length && <p className="mt-2 text-sm">No detailed migrations committed yet.</p>}{batches.map(b => <details className="my-3 rounded-xl border border-[#E2DAD5] p-3 dark:border-white/10" key={b.id}><summary className="cursor-pointer text-sm">{b.filename} · {b.sourceRows} original rows · {b.addedIds.length} tracked allocations · {b.state} · {b.createdAt}</summary><p className="my-2 text-sm">{b.note}</p><p className="text-sm">{b.addedIds.filter(id => !existing.some(e => e.id === id)).length} imported allocations are no longer in live totals. Their original source and snapshots remain here. These snapshots preserve import decisions; they do not certify audit acceptance.</p><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(b, null, 2)}</pre></details>)}</section>
    <footer className="text-xs leading-6 text-[#A8998E]">The BACB and the qualified supervisor determine whether documentation supports fieldwork. Baker does not certify audit acceptance. <a className="underline" href="https://www.bacb.com/documenting-fieldwork-helpful-answers-to-your-faqs/" target="_blank" rel="noreferrer">Official documentation guidance</a>. <a className="underline" href="#supporting-documents">Keep monthly forms as supporting evidence without adding duplicate totals</a>.</footer>
  </div></div>;
}
function Pager({ page, total, setPage }: { page: number; total: number; setPage: (n: number) => void }) {
  return <div className="mt-4 flex items-center gap-4 text-sm"><button disabled={!page} className="underline disabled:opacity-40" onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}</span><button disabled={(page + 1) * 25 >= total} className="underline disabled:opacity-40" onClick={() => setPage(page + 1)}>Next</button></div>;
}
