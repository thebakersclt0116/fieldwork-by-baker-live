import fs from 'node:fs';
function patch(path, before, after) {
  const src=fs.readFileSync(path,'utf8');
  if(!src.includes(before)) throw new Error('Release patch context changed: '+path+' / '+before.slice(0,70));
  fs.writeFileSync(path,src.replace(before,after));
}
const parser='src/lib/detailedMigration.ts', page='src/pages/DetailedMigration.tsx', archive='src/lib/migrationArchive.ts';
patch(parser, 'export type SourceTable = { headers: string[]; rows: string[][]; originals: unknown[] };', "export type SourceOrigin = { filename: string; sha256: string; sourceRow: number; original: unknown };\nexport type SourceTable = { headers: string[]; rows: string[][]; originals: unknown[]; origins?: SourceOrigin[] };");
patch(parser,"export type AuditEntry = HourEntry & { migration?: Provenance; contactType?: string };", "export type AuditEntry = HourEntry & { migration?: Provenance; contactType?: string; recordKind?: 'SESSION' | 'MONTHLY_SUMMARY' };");
patch(parser,"    const errors: string[] = [], warnings: string[] = [];",`    const errors: string[] = [], warnings: string[] = [];
    const originalRow = table.originals[index] as Record<string, unknown>;
    // Only in-memory provenance from locally combined files is authoritative. Never trust hash claims inside uploaded JSON.
    const attribution = table.origins?.[index];
    const sourceHash = attribution?.sha256 || file.hash;
    const sourceRow = attribution?.sourceRow || index + 2;
    const sourceFile = attribution?.filename || file.name;
    const originalEvidence = attribution?.original ?? originalRow;
    if (originalRow?.summaryDerived === true || originalRow?.recordKind === 'MONTHLY_SUMMARY' || originalRow?.granularity === 'month') errors.push('This source row is explicitly a monthly summary, not an individual session. Preserve it as a supporting document.');`);
patch(parser,"    const baseId = await sha256(`${options.sourceSystem}\\n${sourceId || file.hash + ':' + index}`);", "    const baseId = await sha256(`${options.sourceSystem.trim().toLowerCase()}\\n${sourceId || sourceHash + ':' + (sourceRow - 2)}`);");
patch(parser,"id: `detail_${baseId}_${aIndex}`, userId: email, date,", "id: `detail_${baseId}_${aIndex}`, userId: email, date, recordKind: 'SESSION',");
patch(parser,"sourceSystem: options.sourceSystem, sourceFile: file.name, sourceHash: file.hash,", "sourceSystem: options.sourceSystem, sourceFile, sourceHash,");
patch(parser,"sourceRow: index + 2, sourceId, importedAt, mapping: { ...mapping }, raw, original: table.originals[index], originalStatus,", "sourceRow, sourceId, importedAt, mapping: { ...mapping }, raw, original: originalEvidence, originalStatus,");
patch(parser, "  return !entry.migration && (entry.duration > 24 || /monthly aggregate|monthly verification|summary.derived/i.test(`${entry.aiRationale || ''} ${entry.notes || ''}`));", `  if (entry.recordKind === 'SESSION' || entry.migration) return false;
  return entry.recordKind === 'MONTHLY_SUMMARY' || entry.duration > 24 || /monthly aggregate|summary.derived/i.test(entry.aiRationale || '') || /^monthly aggregate(?:[.:\\s]|$)/i.test(entry.notes || '');`);
patch(parser,'export function auditCsv(entries: AuditEntry[]): string {',`export function selectionProblem(preview: MigrationPreview, selectedIds: string[], allowPartial = false): string {
  const ids = new Set(selectedIds), known = new Set(preview.entries.map(e => e.id));
  if ([...ids].some(id => !known.has(id))) return 'Selection is stale. Build the review again.';
  for (const row of preview.rows) {
    const selected = row.entries.filter(e => ids.has(e.id)).length;
    if (selected && selected !== row.entries.length) return 'An original session cannot be partially imported. Select all its linked allocations or none.';
  }
  if (!allowPartial && (preview.errors || preview.entries.some(e => !ids.has(e.id)))) return 'Complete-file mode: correct blocked rows and select every valid session, or explicitly choose a partial import.';
  return '';
}

export function auditCsv(entries: AuditEntry[]): string {`);
patch(archive,'auditCsv, planMerge, sha256,','auditCsv, planMerge, selectionProblem, sha256,');
patch(archive,'confirmPossibleDuplicates: boolean })','confirmPossibleDuplicates: boolean; allowPartial?: boolean })');
patch(archive,'  const before = loadEntries(args.owner) as AuditEntry[];',`  const selectionError = selectionProblem(args.preview, args.selectedIds, args.allowPartial);
  if (selectionError) throw new Error(selectionError);
  const before = loadEntries(args.owner) as AuditEntry[];`);
patch(archive,"note: 'Source preserved before tracking mutation.'", "note: (args.allowPartial ? 'EXPLICIT PARTIAL IMPORT. ' : 'All valid sessions from this file selected. ') + 'Source preserved before tracking mutation. Whole-account completeness still requires source reconciliation.'");
patch(archive,"note: `${merge.add.length} tracked allocations verified. Historical approvals remain source evidence, not new Baker signatures.`", "note: `${args.allowPartial ? 'EXPLICIT PARTIAL IMPORT. ' : 'Selected-file import complete. '}${merge.add.length} tracked allocations verified. Historical approvals remain source evidence, not new Baker signatures.`");
patch(archive,"const req = indexedDB.open('baker-audit-archive-v1', 1);", "const req = indexedDB.open('baker-audit-archive-v1', 2);");
patch(archive,"    req.onupgradeneeded = () => { req.result.createObjectStore('documents', { keyPath: 'id' }); req.result.createObjectStore('batches', { keyPath: 'id' }); };",`    req.onupgradeneeded = () => {
      for (const name of ['documents', 'batches']) {
        const store = req.result.objectStoreNames.contains(name) ? req.transaction!.objectStore(name) : req.result.createObjectStore(name, { keyPath: 'id' });
        if (!store.indexNames.contains('owner')) store.createIndex('owner', 'owner');
      }
    };`);
patch(archive,'.objectStore(store).getAll();','.objectStore(store).index(\'owner\').getAll(normalized(owner));');
patch(page,'parseSource, planMerge, type AuditEntry','parseSource, planMerge, selectionProblem, type AuditEntry');
patch(page,"  const [sourceScopeWarning, setSourceScopeWarning] = useState('');", "  const [sourceScopeWarning, setSourceScopeWarning] = useState('');\n  const [allowPartial, setAllowPartial] = useState(false);");
patch(page,'setAllowMatching(false); setReviewPage(0);','setAllowMatching(false); setAllowPartial(false); setReviewPage(0);');
patch(page,'    if (!doc || !table || !preview || !acknowledged) return;', "    if (!doc || !table || !preview || !acknowledged) return;\n    const issue = selectionProblem(preview, selected, allowPartial);\n    if (issue) throw new Error(issue);");
patch(page,'confirmPossibleDuplicates: allowMatching });','confirmPossibleDuplicates: allowMatching, allowPartial });');
patch(page,"  const incompleteComparisons = Boolean(", "  const selectionIssue = preview ? selectionProblem(preview, selected, allowPartial) : '';\n  const incompleteComparisons = Boolean(");
patch(page,'disabled={busy || !acknowledged || incompleteComparisons || !merge.add.length', 'disabled={busy || !acknowledged || !!selectionIssue || incompleteComparisons || !merge.add.length');
patch(page,"setSelected(ids => event.target.checked ? [...new Set([...ids, e.id])] : ids.filter(id => id !== e.id))", "setSelected(ids => event.target.checked ? [...new Set([...ids, ...row.entries.map(part => part.id)])] : ids.filter(id => !row.entries.some(part => part.id === id)))");
patch(page,'        <label className="my-4 flex gap-2 text-sm"><input type="checkbox" checked={acknowledged}',`        {(preview.errors > 0 || selected.length < preview.entries.length) && <div className="my-4 rounded-xl border border-amber-400 p-4"><label className="flex gap-2 text-sm"><input type="checkbox" checked={allowPartial} onChange={e => setAllowPartial(e.target.checked)}/>Intentionally import only the selected valid sessions. This is a PARTIAL import, not a completed migration.</label></div>}
        {selectionIssue && <p className="my-3 text-sm text-amber-800 dark:text-amber-200" role="note">{selectionIssue}</p>}
        <label className="my-4 flex gap-2 text-sm"><input type="checkbox" checked={acknowledged}`);
patch(page,'Exact duplicates: {merge.duplicate.length}.', 'Exact duplicates: {merge.duplicate.length}. Selecting any allocation keeps the entire original session together.');
patch(page,'    <section className={panel}><h2 className="font-serif text-2xl">Entry-by-entry audit ledger', '    <section id="audit-ledger" className={panel}><h2 className="font-serif text-2xl">Entry-by-entry audit ledger');
patch(page,'<Link className="p-3 underline" to="/export">Monthly worksheets</Link>', '<Link className="p-3 underline" to="/export">Monthly worksheets</Link><a className="p-3 underline" href="#audit-ledger">Jump to individual entries</a>');
patch(page, 'async function readFile(file: File) {', "async function readFile(file: File, origins?: SourceTable['origins']) {");
patch(page, 'setTable(parsed); setMapping(guessMapping(parsed.headers));', 'setTable({ ...parsed, origins }); setMapping(guessMapping(parsed.headers));');
patch(page, '    const records: Record<string, unknown>[] = [];', "    const records: Record<string, unknown>[] = [];\n    const origins: NonNullable<SourceTable['origins']> = [];");
patch(page, '        records.push(record);', "        origins.push({ filename: file.name, sha256: original.hash, sourceRow: index + 2, original: parsed.originals[index] });\n        records.push(record);");
patch(page, "'combined-detailed-sources.json', { type: 'application/json' }));", "'combined-detailed-sources.json', { type: 'application/json' }), origins);");
patch('scripts/detailed-migration.test.mjs', "id: 'legacy', migration: undefined, duration: 70", "id: 'legacy', migration: undefined, recordKind: undefined, duration: 70");
patch('src/components/Layout.tsx','key={`${location.pathname}:${fieldworkVersion}`}','key={`${location.pathname}:${[\'/import\', \'/audit-history\'].includes(location.pathname) ? \'records\' : fieldworkVersion}`}');
patch(archive,'req.onsuccess = () => resolve((req.result as T[]).filter(r => normalized(r.owner) === normalized(owner)));', 'req.onsuccess = () => { try { requireOwner(owner); resolve((req.result as T[]).filter(r => normalized(r.owner) === normalized(owner))); } catch (e) { reject(e); } };');
const editor='src/components/TrackedHoursEditor.tsx';
patch(editor,"    next.workPresence = next.workPresence || ((next.supervisionMinutes || 0) > 0 ? 'SUPERVISED' : 'INDEPENDENT');\n    next.supervisionFormat = next.supervisionFormat || ((next.individualSupervisionMinutes || 0) > 0 ? 'INDIVIDUAL' : undefined);", '    // Missing source classifications remain unknown until the user explicitly supplies them.');
patch(editor,"if (draft.startTime && draft.endTime && draft.startTime !== '00:00' && draft.endTime !== '00:00')", "if (draft.startTime && draft.endTime && (!original || draft.startTime !== original.startTime || draft.endTime !== original.endTime))");
patch(editor,'  }, [draft]);','  }, [draft, original]);');
patch(editor,"'observationMode', 'clientInitials', 'setting', 'notes',", "'observationMode', 'clientInitials', 'setting', 'notes', 'individualSupervisionMinutes', 'fieldworkType',");
patch(editor,"    date: entry.date,", "    ...entry,\n    revisionHistory: undefined, // avoid recursively copying the entire prior history\n    date: entry.date,");
patch(editor,"      supervisionMinutes: draft.workPresence === 'SUPERVISED' ? Math.max(0, Number(draft.supervisionMinutes || 0)) || undefined : undefined,\n      observationMinutes: draft.workPresence === 'SUPERVISED' ? Math.max(0, Number(draft.observationMinutes || 0)) || undefined : undefined,\n      individualSupervisionMinutes: draft.workPresence === 'SUPERVISED' && draft.supervisionFormat === 'INDIVIDUAL'\n        ? Math.max(0, Number(draft.supervisionMinutes || 0)) || undefined\n        : undefined,", "      supervisionMinutes: draft.supervisionMinutes,\n      observationMinutes: draft.observationMinutes,\n      individualSupervisionMinutes: draft.individualSupervisionMinutes,");
patch(editor,"    if (!normalized.date || normalized.duration <= 0) {",`    const timeChanged = draft.startTime !== original.startTime || draft.endTime !== original.endTime;
    if (timeChanged && (!draft.startTime || !draft.endTime || hoursBetween(draft.startTime, draft.endTime) <= 0)) { setMessage('Enter a valid same-day start and end time, or restore the source time range.'); return; }
    for (const [label, minutes] of [['Supervision', normalized.supervisionMinutes], ['Observation', normalized.observationMinutes], ['Individual supervision', normalized.individualSupervisionMinutes]] as const) {
      if (minutes !== undefined && (!Number.isFinite(minutes) || minutes < 0 || minutes > normalized.duration * 60 + 0.61)) { setMessage(label + ' minutes must be between 0 and the entry duration.'); return; }
    }
    if (normalized.workPresence === 'INDEPENDENT' && (normalized.supervisionMinutes || 0) > 0) { setMessage('Independent work conflicts with positive supervision minutes. Review those fields before saving.'); return; }
    if (!normalized.date || normalized.duration <= 0) {`);
patch(editor,"value={draft.startTime || '00:00'}", "value={draft.startTime || ''}");
patch(editor,"value={draft.endTime || '00:00'}", "value={draft.endTime || ''}");
patch(editor,"Unknown / monthly summary", "Unknown / not in source");
patch(editor,"value={draft.workPresence || 'INDEPENDENT'}", "value={draft.workPresence || ''}");
patch(editor,'<option value="INDEPENDENT">Independent</option>', '<option value="">Not recorded in source</option><option value="INDEPENDENT">Independent</option>');
patch(editor,"{(draft.workPresence || 'INDEPENDENT') === 'SUPERVISED' && (", '{(');
patch(editor,"value={draft.supervisionFormat || 'INDIVIDUAL'}", "value={draft.supervisionFormat || ''}");
patch(editor,'<option value="INDIVIDUAL">Individual</option>', '<option value="">Not recorded in source</option><option value="INDIVIDUAL">Individual</option>');
patch(editor,'<Field label="Client observation minutes">', '<Field label="Individual supervision minutes"><input type="number" min="0" value={draft.individualSupervisionMinutes ?? \'\'} onChange={e => updateDraft(\'individualSupervisionMinutes\', e.target.value === \'\' ? undefined : Number(e.target.value))} className="field-input" /></Field>\n                          <Field label="Client observation minutes">');
patch(editor,'Client initials / name', 'Client initials (no full names)');
console.log('Reviewed release fixes applied. Source data, unknown values and observations survive import and later edits; partial selections are explicit.');
