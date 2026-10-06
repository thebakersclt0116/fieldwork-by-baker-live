import { buildStoreZip } from './downloadZip';
import { assertDeviceEditorAccess, getCurrentUserEmail, loadEntries, loadSupervisors, saveEntries } from './fieldworkStore';
import { listDeviceBackups } from './cloudBackups';
import { canonicalJson } from '../../shared/cloudTypes';
import { auditCsv, planMerge, selectionProblem, sha256, type AuditEntry, type Mapping, type ImportOptions, type MigrationPreview, type SourceTable } from './detailedMigration';

export type SourceDocument = { id: string; owner: string; hash: string; filename: string; mime: string; size: number; savedAt: string; kind: 'detailed-source' | 'supporting-document'; originalDocumentId?: string; bytes: Uint8Array };
export type AuditBatch = { id: string; owner: string; createdAt: string; sourceHash: string; filename: string; mapping: Mapping; options: ImportOptions; sourceRows: number; results: MigrationPreview['rows']; before: AuditEntry[]; addedIds: string[]; archivedSummaryIds: string[]; state: 'prepared' | 'committed' | 'failed'; note: string };
const normalized = (v: string) => v.trim().toLowerCase();
function requireOwner(owner: string) {
  if (!owner || normalized(getCurrentUserEmail() || '') !== normalized(owner)) throw new Error('Your signed-in account changed. Reopen migration before continuing.');
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('baker-audit-archive-v1', 2);
    req.onupgradeneeded = () => {
      for (const name of ['documents', 'batches']) {
        const store = req.result.objectStoreNames.contains(name) ? req.transaction!.objectStore(name) : req.result.createObjectStore(name, { keyPath: 'id' });
        if (!store.indexNames.contains('owner')) store.createIndex('owner', 'owner');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('The audit archive could not be opened. Enable browser storage; no import was committed.'));
    req.onblocked = () => reject(new Error('Close other Baker tabs and try again. The archive is locked by another tab.'));
  });
}
async function all<T extends { owner: string }>(store: string, owner: string): Promise<T[]> {
  requireOwner(owner); const db = await openDatabase();
  try { return await new Promise<T[]>((resolve, reject) => { const req = db.transaction(store).objectStore(store).index('owner').getAll(normalized(owner)); req.onsuccess = () => { try { requireOwner(owner); resolve((req.result as T[]).filter(r => normalized(r.owner) === normalized(owner))); } catch (e) { reject(e); } }; req.onerror = () => reject(req.error); }); }
  finally { db.close(); }
}
function matchingDocument(a: SourceDocument, b: SourceDocument): boolean {
  const { bytes: aBytes, ...aMetadata } = a, { bytes: bBytes, ...bMetadata } = b;
  const left = new Uint8Array(aBytes), right = new Uint8Array(bBytes);
  return canonicalJson(aMetadata) === canonicalJson(bMetadata) && left.length === right.length
    && left.every((value, index) => value === right[index]);
}
function compatibleBatch(existing: AuditBatch, incoming: AuditBatch): boolean {
  if (canonicalJson(existing) === canonicalJson(incoming)) return true;
  return existing.state === 'prepared' && ['committed', 'failed'].includes(incoming.state)
    && canonicalJson({ ...existing, state: null, note: null }) === canonicalJson({ ...incoming, state: null, note: null });
}
async function put(store: 'documents' | 'batches', record: SourceDocument | AuditBatch, notify = true): Promise<void> {
  requireOwner(record.owner);
  assertDeviceEditorAccess(record.owner, !notify);
  if (record.owner !== normalized(record.owner)) throw new Error('This archive uses an incompatible account identifier. Preserve the original and review it before restoring.');
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite'), records = tx.objectStore(store);
      let failure: unknown;
      tx.oncomplete = () => { try { requireOwner(record.owner); resolve(); } catch (error) { reject(error); } };
      tx.onabort = () => reject(failure || new Error('Archive write failed, possibly because storage is full. Download a backup before continuing.'));
      tx.onerror = () => { failure ||= tx.error; };
      // The primary key is global in the legacy device store. Read and conditionally
      // write within one transaction so another tab cannot replace a newer decision.
      const request = records.get(record.id);
      request.onsuccess = () => {
        try {
          requireOwner(record.owner);
          assertDeviceEditorAccess(record.owner, !notify);
          const existing = request.result as SourceDocument | AuditBatch | undefined;
          if (existing && existing.owner !== record.owner) throw new Error('This archive ID is already owned by another local account. Both copies were preserved.');
          if (existing && store === 'documents' && !matchingDocument(existing as SourceDocument, record as SourceDocument)) throw new Error('An original document or its metadata differs on this device. Both copies must be reviewed.');
          if (existing && store === 'batches' && !compatibleBatch(existing as AuditBatch, record as AuditBatch)) throw new Error('An audit decision differs on this device. Both copies have been preserved.');
          if (!existing || store === 'batches') records.put(record);
        } catch (error) { failure = error; tx.abort(); }
      };
    });
  }
  finally { db.close(); }
  if (notify) window.dispatchEvent(new CustomEvent('fieldwork:archive-changed', { detail: { email: normalized(record.owner) } }));
}
export const listDocuments = (owner: string) => all<SourceDocument>('documents', owner);
export const listBatches = (owner: string) => all<AuditBatch>('batches', owner);

export async function restoreArchivedDocument(owner: string, document: SourceDocument): Promise<void> {
  requireOwner(owner);
  const bytes = new Uint8Array(document.bytes);
  if (normalized(document.owner) !== normalized(owner) || document.size !== bytes.byteLength || await sha256(bytes) !== document.hash) {
    throw new Error('The original document did not pass account and integrity verification.');
  }
  requireOwner(owner);
  await put('documents', { ...document, bytes }, false);
  const saved = (await listDocuments(owner)).find((value) => value.id === document.id);
  if (!saved || !matchingDocument(saved, document)) throw new Error('The restored original could not be verified on this device.');
  requireOwner(owner);
}

export async function restoreAuditBatch(owner: string, batch: AuditBatch): Promise<void> {
  requireOwner(owner);
  if (normalized(batch.owner) !== normalized(owner)) throw new Error('This audit batch belongs to a different account.');
  await put('batches', batch, false);
}
export async function archiveFile(file: File, owner: string, kind: SourceDocument['kind']): Promise<SourceDocument> {
  requireOwner(owner);
  if (file.size > 25 * 1024 * 1024) throw new Error('Maximum source file size is 25 MB. Split the export into date ranges; no file has been truncated.');
  const bytes = new Uint8Array(await file.arrayBuffer()), hash = await sha256(bytes);
  const existing = (await listDocuments(owner)).find(r => r.hash === hash && r.size === file.size
    && r.filename === file.name && r.mime === file.type && r.kind === kind);
  if (existing) {
    if (new Uint8Array(existing.bytes).byteLength !== existing.size || await sha256(new Uint8Array(existing.bytes)) !== hash) throw new Error('The saved original failed its integrity check. Keep the source file before continuing.');
    requireOwner(owner);
    return existing;
  }
  // A capture has its own identity: equal bytes on another device may have
  // different filenames, capture times, or other source evidence.
  const doc: SourceDocument = { id: `${normalized(owner)}:capture:${crypto.randomUUID()}`, owner: normalized(owner), hash, filename: file.name, mime: file.type, size: file.size, kind, savedAt: new Date().toISOString(), bytes };
  await put('documents', doc);
  const readback = (await listDocuments(owner)).find(r => r.id === doc.id);
  if (!readback || !matchingDocument(readback, doc)) throw new Error('Original-file readback verification failed. Stop before deleting source records.');
  return doc;
}
export function downloadBytes(name: string, data: string | Uint8Array, mime: string) {
  const part = typeof data === 'string' ? data : new Uint8Array(data);
  const url = URL.createObjectURL(new Blob([part], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function commitMigration(args: { owner: string; doc: SourceDocument; table: SourceTable; mapping: Mapping; options: ImportOptions; preview: MigrationPreview; selectedIds: string[]; replaceSummaryIds: string[]; confirmPossibleDuplicates: boolean; allowPartial?: boolean }) {
  requireOwner(args.owner);
  const selectionError = selectionProblem(args.preview, args.selectedIds, args.allowPartial);
  if (selectionError) throw new Error(selectionError);
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
  const batch: AuditBatch = { id: `${normalized(args.owner)}:${crypto.randomUUID()}`, owner: normalized(args.owner), createdAt: new Date().toISOString(), sourceHash: args.doc.hash, filename: args.doc.filename, mapping: args.mapping, options: args.options, sourceRows: args.table.rows.length, results: args.preview.rows, before, addedIds: merge.add.map(e => e.id), archivedSummaryIds: [...replacing], state: 'prepared', note: (args.allowPartial ? 'EXPLICIT PARTIAL IMPORT. ' : 'All valid sessions from this file selected. ') + 'Source preserved before tracking mutation. Whole-account completeness still requires source reconciliation.' };
  await put('batches', batch);
  const after = [...before.filter(e => !replacing.has(e.id)), ...merge.add].sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));
  try {
    requireOwner(args.owner);
    if (JSON.stringify(loadEntries(args.owner)) !== JSON.stringify(before)) throw new Error('Entries changed in another tab. Re-preview before importing.');
    saveEntries(after, args.owner);
    if (JSON.stringify(loadEntries(args.owner)) !== JSON.stringify(after)) { saveEntries(before, args.owner); throw new Error('Tracked-entry readback failed; prior records restored.'); }
    await put('batches', { ...batch, state: 'committed', note: `${args.allowPartial ? 'EXPLICIT PARTIAL IMPORT. ' : 'Selected-file import complete. '}${merge.add.length} tracked allocations verified. Historical approvals remain source evidence, not new Baker signatures.` });
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
export async function buildAuditArchive(owner: string): Promise<Uint8Array> {
  requireOwner(owner); const entries = loadEntries(owner) as AuditEntry[];
  const documents = await listDocuments(owner), batches = await listBatches(owner), enc = new TextEncoder();
  const supervisors = loadSupervisors(owner), deviceRecoveryCopies = await listDeviceBackups(owner);
  const rawDeviceRecoveryCopies = await (await import('./cloudSync')).listRawDeviceRecoveryCopies(owner);
  const files: Array<{ name: string; data: Uint8Array }> = [
    { name: 'records.json', data: enc.encode(JSON.stringify({ format: 'baker-audit-v1', owner, exportedAt: new Date().toISOString(), entries, supervisors, batches }, null, 2)) },
    { name: 'device-recovery-copies.json', data: enc.encode(JSON.stringify({ owner, copies: deviceRecoveryCopies, rawDeviceRecoveryCopies }, null, 2)) },
    { name: 'entry-ledger.csv', data: enc.encode(auditCsv(entries)) },
    { name: 'entry-ledger.html', data: enc.encode(auditHtml(entries)) },
    { name: 'README.txt', data: enc.encode('This is a FULL-ACCOUNT FIELDWORK AUDIT export. It may contain confidential fieldwork data. Review before sharing.\nOpen entry-ledger.html in a browser to read or print to PDF. CSV cells are formula-escaped for safety; exact source text remains in records.json and originals.\nOriginal files are preserved byte-for-byte; manifest.json records their names and SHA-256 hashes. These hashes detect changes against this manifest but are NOT trusted timestamps or supervisor signatures.\nrecords.json includes complete current records, source rows, exceptions, migration decisions, and pre-import snapshots. Source records whose live entries were removed remain in batch history.\nReconcile source entry count and all monthly/organization totals before leaving the original platform. Missing original narratives cannot be reconstructed from monthly totals.\nStorage details reports whether the account copy of these fieldwork records and originals has been verified. This downloaded ZIP is a separate backup; keep it securely outside the browser. Device recovery copies may include older or malformed source snapshots. Study progress, saved AI material, and other device-only preferences are outside this fieldwork audit export.\n') },
  ];
  const originalDocuments: Array<Omit<SourceDocument, 'bytes'> & { archivePath: string }> = [];
  for (const doc of documents) {
    if (await sha256(new Uint8Array(doc.bytes)) !== doc.hash) throw new Error(`Original-file integrity check failed for ${doc.filename}. Export stopped; do not discard the source.`);
    const archivePath = `originals/${doc.hash}/${await sha256(doc.id)}/${doc.filename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'original'}`;
    files.push({ name: archivePath, data: new Uint8Array(doc.bytes) });
    const metadata = { ...doc } as Partial<SourceDocument>; delete metadata.bytes;
    originalDocuments.push({ ...metadata as Omit<SourceDocument, 'bytes'>, archivePath });
  }
  if (files.reduce((n, f) => n + f.data.byteLength, 0) > 150 * 1024 * 1024) throw new Error('Archive exceeds the 150 MB browser export safety limit. Download individual originals and your entry ledger; no records were truncated.');
  const manifest = { format: 'baker-audit-manifest-v1', createdAt: new Date().toISOString(), entries: entries.length, originalDocuments, files: await Promise.all(files.map(async f => ({ path: f.name, bytes: f.data.byteLength, sha256: await sha256(f.data) }))), unresolvedBatches: batches.filter(b => b.state !== 'committed').map(b => b.id) };
  files.push({ name: 'manifest.json', data: enc.encode(JSON.stringify(manifest, null, 2)) });
  requireOwner(owner); return buildStoreZip(files);
}
export async function downloadAuditArchive(owner: string): Promise<void> {
  const bytes = await buildAuditArchive(owner);
  requireOwner(owner); downloadBytes(`baker-full-audit-${new Date().toISOString().slice(0, 10)}.zip`, bytes, 'application/zip');
}
