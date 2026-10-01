import fs from 'node:fs';
function change(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Patch context changed for ${path}`);
  fs.writeFileSync(path, source.replace(before, after));
}
const page = 'src/pages/DetailedMigration.tsx';
change(page, "import { Archive, Download, FileText, ShieldCheck, Upload } from 'lucide-react';", "import { Archive, Download, FileText, ShieldCheck } from 'lucide-react';");
change(page, "import { getCurrentUserEmail, loadEntries } from '@/lib/fieldworkStore';", "import { loadEntries } from '@/lib/fieldworkStore';");
change('src/lib/migrationArchive.ts', 'async function put(store: string, record: { owner: string }): Promise<void>', 'async function put<T extends { owner: string }>(store: string, record: T): Promise<void>');
change(page, '  const chosen = useMemo(() => preview?.entries.filter(e => selected.includes(e.id)) || [], [preview, selected]);', '  const selectedSet = useMemo(() => new Set(selected), [selected]);\n  const chosen = useMemo(() => preview?.entries.filter(e => selectedSet.has(e.id)) || [], [preview, selectedSet]);');
change(page, 'checked={selected.includes(e.id)}', 'checked={selectedSet.has(e.id)}');
change(page, '    const records: Record<string, unknown>[] = [];', "    if (!owner || !hasPaidFeatures) throw new Error('An active trial or plan is required for new imports.');\n    resetPreview(); setTable(null); setDoc(null);\n    const records: Record<string, unknown>[] = [];");
change(page, 'const record: Record<string, unknown> = {};', 'const record: Record<string, unknown> = Object.create(null);');
change(page, "  const [expectedCount, setExpectedCount] = useState(''), [expectedHours, setExpectedHours] = useState('');", "  const [expectedCount, setExpectedCount] = useState(''), [expectedHours, setExpectedHours] = useState('');\n  const [sourceScopeWarning, setSourceScopeWarning] = useState('');");
change(page, '    resetPreview(); setTable(null); setDoc(null);', "    resetPreview(); setTable(null); setDoc(null); setSourceScopeWarning('');");
change(page, "    const parsed = parseSource(new TextDecoder('utf-8', { fatal: true }).decode(stored.bytes), file.name);", "    const sourceText = new TextDecoder('utf-8', { fatal: true }).decode(stored.bytes);\n    if (/\\.json$/i.test(file.name)) {\n      const json = JSON.parse(sourceText);\n      if (json?.capture) setSourceScopeWarning('Detail Bridge capture: ONLY the linked entry forms from the selected page. Other months, organizations, pages and attachments may be missing. ' + (Array.isArray(json.warnings) ? json.warnings.map(String).join(' ') : '') + (json.capture.failed?.length ? ' UNREAD ENTRIES: ' + json.capture.failed.length + '. Resolve these before retiring the source.' : ''));\n    }\n    const parsed = parseSource(sourceText, file.name);");
change(page, '<p className="mt-3 text-xs break-all">Source SHA-256: {doc?.hash}</p>', '<p className="mt-3 text-xs break-all">Source SHA-256: {doc?.hash}</p>{sourceScopeWarning && <p className="mt-4 rounded-xl border border-amber-400 p-3 text-sm" role="note">{sourceScopeWarning}</p>}');
const parser = 'src/lib/detailedMigration.ts';
change(parser, 'export type AuditEntry = HourEntry & { migration?: Provenance };', 'export type AuditEntry = HourEntry & { migration?: Provenance; contactType?: string };');
change(parser, "      observationMode: mode, clientInitials: get('client').trim() || undefined, setting: get('setting'),", "      observationMode: mode, contactType: get('contactType') || undefined, clientInitials: get('client').trim() || undefined, setting: get('setting'),");
change(parser, "    if (!fw) errors.push('Choose the actual fieldwork type or map its source column.');", "    if (!fw) errors.push('Choose the actual fieldwork type or map its source column.');\n    if (fwText && !['supervised', 'supervised fieldwork', 'concentrated', 'concentrated supervised fieldwork'].includes(fwText)) errors.push('Unrecognized source fieldwork type. Review it; do not silently replace it with a default.');");
change(parser, "    if (presence === 'INDEPENDENT' && (minuteValues.supervision || 0) > 0) errors.push('Independent entry conflicts with supervision minutes.');", "    if (presence === 'INDEPENDENT' && ((minuteValues.supervision || 0) > 0 || (minuteValues.observation || 0) > 0)) errors.push('Independent entry conflicts with supervision/observation minutes.');\n    if (minuteValues.observation !== undefined && minuteValues.supervision !== undefined && minuteValues.observation > minuteValues.supervision) errors.push('Client observation exceeds total supervision.');\n    if (format === 'GROUP' && (minuteValues.individual || 0) > 0) errors.push('Group format conflicts with individual supervision minutes.');");
change(parser, "'Source warnings', 'All original fields'];", "'Source warnings', 'Contact type', 'All original fields'];");
change(parser, "e.migration?.allocation, e.migration?.warnings, e.migration?.raw])", "e.migration?.allocation, e.migration?.warnings, e.contactType, e.migration?.raw])");
console.log('Typed archive and detailed migration hardening applied.');
