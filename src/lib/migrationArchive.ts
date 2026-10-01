import { buildStoreZip } from './downloadZip';
import { getCurrentUserEmail, loadEntries, saveEntries } from './fieldworkStore';
import { auditCsv, planMerge, sha256, type AuditEntry, type Mapping, type ImportOptions, type MigrationPreview, type SourceTable } from './detailedMigration';

export type SourceDocument = { id: string; owner: string; hash: string; filename: string; mime: string; size: number; savedAt: string; kind: 'detailed-source' | 'supporting-document'; bytes: Uint8Array };
export type AuditBatch = { id: string; owner: string; createdAt: string; sourceHash: string; filename: string; mapping: Mapping; options: ImportOptions; sourceRows: number; results: MigrationPreview['rows']; before: AuditEntry[]; addedIds: string[]; archivedSummaryIds: string[]; state: 'prepared' | 'committed' | 'failed'; note: string };
const normalized = (v: string) => v.trim().toLowerCase();
function requireOwner(owner: string) {
  if (!owner || normalized(getCurrentUserEmail() || '') !== normalized(owner)) throw new Error('Your signed-in account changed. Reopen migration before continuing.');
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('baker-audit-archive-v1', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('documents', { keyPath: 'id' }); req.result.createObjectStore('batches', { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('The audit archive could not be opened. Enable browser storage; no import was committed.'));
    req.onblocked = () => reject(new Error('Close other Baker tabs and try again. The archive is locked by another tab.'));
  });
}
async function all<T extends { owner: string }>(store: string, owner: string): Promise<T[]> {
  requireOwner(owner); const db = await openDatabase();
  try { return await new Promise<T[]>((resolve, reject) => { const req = db.transaction(store).objectStore(store).getAll(); req.onsuccess = () => resolve((req.result as T[]).filter(r => normalized(r.owner) === normalized(owner))); req.onerror = () => reject(req.error); }); }
  finally { db.close(); }
}
async function put<T extends { owner: string }>(store: string, record: T): Promise<void> {
  requireOwner(record.owner); const db = await openDatabase();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(record); tx.oncomplete = () => resolve(); tx.onabort = () => reject(new Error('Archive write failed, possibly because storage is full. Nothing may be discarded; download a backup first.')); tx.onerror = () => reject(tx.error); }); }
  finally { db.close(); }
}
export const listDocuments = (owner: string) => all<SourceDocument>('documents', owner);
export const listBatches = (owner: string) => all<AuditBatch>('batches', owner);
export async function archiveFile(file: File, owner: string, kind: SourceDocument['kind']): Promise<SourceDocument> {
  requireOwner(owner);
  if (file.size > 25 * 1024 * 1024) throw new Error('Maximum source file size is 25 MB. Split the export into date ranges; no file has been truncated.');
  const bytes = new Uint8Array(await file.arrayBuffer()), hash = await sha256(bytes);
  const doc: SourceDocument = { id: `${normalized(owner)}:${hash}`, owner: normalized(owner), hash, filename: file.name, mime: file.type, size: file.size, kind, savedAt: new Date().toISOString(), bytes };
  const existing = (await listDocuments(owner)).find(r => r.hash === hash);
  if (existing) return existing;
  await put('documents', doc);
  const readback = (await listDocuments(owner)).find(r => r.hash === hash);
  if (!readback || await sha256(new Uint8Array(readback.bytes)) !== hash) throw new Error('Original-file readback verification failed. Stop before deleting source records.');
  return doc;
}
export function downloadBytes(name: string, data: string | Uint8Array, mime: string) {
  const part = typeof data === 'string' ? data : new Uint8Array(data);
  const url = URL.createObjectURL(new Blob([part], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function commitMigration(args: { owner: string; doc: SourceDocument; table: SourceTable; mapping: Mapping; options: ImportOptions; preview: MigrationPreview; selectedIds: string[]; replaceSummaryIds: string[]; confirmPossibleDuplicates: boolean }) {
  requireOwner(args.owner);
  const before = loadEntries(args.owner) as AuditEntry[];
  const ids = new Set(args.selectedIds), incoming = args.preview.entries.filter(e => ids.has(e.id));
  const merge = planMerge(before, incoming);
  if (merge.conflicts.length) throw new Error('A source entry ID already exists with different values. Use Edit tracked hours and record the reason; import never overwrites it.');
  if (merge.possibleDuplicates.length && !args.confirmPossibleDuplicates) throw new Error('Review matching-value entries before importing. They may be duplicates or separate legitimate entries.');
  const replacing = new Set(args.replaceSummaryIds);
  const summaries = merge.overlappingSummaries;
  if (summaries.some(s => !replacing.has(s.id))) throw new Error('Monthly summaries overlap these detailed entries. Reconcile and explicitly archive the summaries first so totals are not counted twice.');
  if ([...replacing].some(id => !summaries.some(s => s.id === id))) throw new Error('Summary selection is stale. Review the new preview.');
  // A subtotal from one source page must never silently replace an entire month.
  for (const month of [...new Set(summaries.map(s => s.date.slice(0, 7)))]) {
    const monthSummaries = summaries.filter(s => s.date.startsWith(month));
    const organizations = new Set(monthSummaries.map(s => (s.organizationName || '').trim().toLowerCase()));
    if (organizations.size > 1) throw new Error('This month has summaries for multiple organizations. Reconcile each organization manually before importing.');
    const org = [...organizations][0];
    const candidates = [...before.filter(e => !replacing.has(e.id)), ...merge.add].filter(e => e.date.startsWith(month));
    const candidateOrgs = new Set(candidates.map(e => (e.organizationName || '').trim().toLowerCase()));
    if (org && (candidateOrgs.size !== 1 || !candidateOrgs.has(org))) throw new Error('Summary and detailed-entry organizations differ. Do not combine different organizations.');
    if (!org && candidateOrgs.size > 1) throw new Error('The old summary has no organization and details span several organizations. Resolve this before replacing totals.');
    const total = monthSummaries.reduce((n, e) => n + e.duration, 0), detail = candidates.reduce((n, e) => n + e.duration, 0);
    if (Math.abs(total - detail) > 0.02) throw new Error(`${month}: summary ${total.toFixed(2)} h does not reconcile to detailed ${detail.toFixed(2)} h. Import all source entries or resolve the discrepancy before replacing it.`);
  }
  if (!merge.add.length) throw new Error('No new entries to commit. Exact source-ID duplicates were left unchanged.');
  const batch: AuditBatch = { id: `${normalized(args.owner)}:${crypto.randomUUID()}`, owner: normalized(args.owner), createdAt: new Date().toISOString(), sourceHash: args.doc.hash, filename: args.doc.filename, mapping: args.mapping, options: args.options, sourceRows: args.table.rows.length, results: args.preview.rows, before, addedIds: merge.add.map(e => e.id), archivedSummaryIds: [...replacing], state: 'prepared', note: 'Source preserved before tracking mutation.' };
  await put('batches', batch);
  const after = [...before.filter(e => !replacing.has(e.id)), ...merge.add].sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));
  try {
    requireOwner(args.owner);
    if (JSON.stringify(loadEntries(args.owner)) !== JSON.stringify(before)) throw new Error('Entries changed in another tab. Re-preview before importing.');
    saveEntries(after, args.owner);
    if (JSON.stringify(loadEntries(args.owner)) !== JSON.stringify(after)) { saveEntries(before, args.owner); throw new Error('Tracked-entry readback failed; prior records restored.'); }
    await put('batches', { ...batch, state: 'committed', note: `${merge.add.length} tracked allocations verified. Historical approvals remain source evidence, not new Baker signatures.` });
  } catch (err) {
    // If tracking was written but final journal write failed, preserve both snapshots for recovery.
    try { await put('batches', { ...batch, state: 'failed', note: 'Check tracked entries against the preserved before/after snapshots before retrying.' }); } catch { /* prepared journal is still available */ }
    throw err;
  }
  window.dispatchEvent(new CustomEvent('fieldwork:entries-changed'));
  return { added: merge.add.length, skipped: merge.duplicate.length, batchId: batch.id };
}
const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function auditHtml(entries: AuditEntry[]): string {
  return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>Baker entry-level audit record</title><style>body{font:15px system-ui;max-width:1050px;margin:32px auto;padding:16px;color:#211d1a}article{break-inside:avoid;border:1px solid #ddd;border-radius:12px;padding:20px;margin:16px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px system-ui}h2{font-size:19px}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}table{width:100%;table-layout:fixed}td{overflow-wrap:anywhere}@media print{body{margin:0}}</style></head><body><h1>Fieldwork by Baker — entry-level audit record</h1><p>Exported ' + escapeHtml(new Date().toISOString()) + '. Source evidence is not a new supervisor signature or a guarantee of BACB acceptance. Blank data means not recorded. Original source rows and revision history are preserved below.</p>' + entries.map(e => '<article><h2>' + escapeHtml(e.date + ' · ' + e.duration.toFixed(2) + ' hours · ' + e.activityCategory) + '</h2><p>' + escapeHtml((e.organizationName || 'Organization missing') + ' / ' + e.supervisorName + ' / ' + e.startTime + '–' + e.endTime) + '</p><h3>Activity narrative</h3><pre>' + escapeHtml(e.notes || 'Not recorded') + '</pre><h3>Complete current record, source fields and revisions</h3><pre>' + escapeHtml(JSON.stringify(e, null, 2)) + '</pre></article>').join('') + '</body></html>';
}
export async function downloadAuditArchive(owner: string): Promise<void> {
  requireOwner(owner); const entries = loadEntries(owner) as AuditEntry[];
  const documents = await listDocuments(owner), batches = await listBatches(owner), enc = new TextEncoder();
  const files: Array<{ name: string; data: Uint8Array }> = [
    { name: 'records.json', data: enc.encode(JSON.stringify({ format: 'baker-audit-v1', owner, exportedAt: new Date().toISOString(), entries, batches }, null, 2)) },
    { name: 'entry-ledger.csv', data: enc.encode(auditCsv(entries)) },
    { name: 'entry-ledger.html', data: enc.encode(auditHtml(entries)) },
    { name: 'README.txt', data: enc.encode('This is a FULL-ACCOUNT audit export. It may contain confidential fieldwork data. Review before sharing.\nOpen entry-ledger.html in a browser to read or print to PDF. CSV cells are formula-escaped for safety; exact source text remains in records.json and originals.\nOriginal files are preserved byte-for-byte; manifest.json records their names and SHA-256 hashes. These hashes detect changes against this manifest but are NOT trusted timestamps or supervisor signatures.\nrecords.json includes complete current records, source rows, exceptions, migration decisions, and pre-import snapshots. Source records whose live entries were removed remain in batch history.\nReconcile source entry count and all monthly/organization totals before leaving the original platform. Missing original narratives cannot be reconstructed from monthly totals.\nThis archive is browser-local until you download it. Store this ZIP securely outside the browser. Baker does not promise cloud backup here.\n') },
  ];
  for (const doc of documents) {
    if (await sha256(new Uint8Array(doc.bytes)) !== doc.hash) throw new Error(`Original-file integrity check failed for ${doc.filename}. Export stopped; do not discard the source.`);
    files.push({ name: `originals/${doc.hash}/${doc.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`, data: new Uint8Array(doc.bytes) });
  }
  if (files.reduce((n, f) => n + f.data.byteLength, 0) > 150 * 1024 * 1024) throw new Error('Archive exceeds the 150 MB browser export safety limit. Download individual originals and your entry ledger; no records were truncated.');
  const manifest = { format: 'baker-audit-manifest-v1', createdAt: new Date().toISOString(), entries: entries.length, originalDocuments: documents.map(({ bytes: _bytes, ...d }) => d), files: await Promise.all(files.map(async f => ({ path: f.name, bytes: f.data.byteLength, sha256: await sha256(f.data) }))), unresolvedBatches: batches.filter(b => b.state !== 'committed').map(b => b.id) };
  files.push({ name: 'manifest.json', data: enc.encode(JSON.stringify(manifest, null, 2)) });
  requireOwner(owner); downloadBytes(`baker-full-audit-${new Date().toISOString().slice(0, 10)}.zip`, buildStoreZip(files), 'application/zip');
}
