import fs from 'node:fs';
function change(path,before,after){const source=fs.readFileSync(path,'utf8');if(source.includes(after))return;if(!source.includes(before))throw new Error('Source changed; inspect before overwriting: '+path);fs.writeFileSync(path,source.replace(before,after));}
const page='src/pages/DetailedMigration.tsx';
change(page,"  const bridgeRequest = useRef('');","  const bridgeRequest = useRef('');\n  const pdfBatchComplete = useRef(false);");
change(page,"    resetPreview(); setTable(null); setDoc(null); setPdfSources([]); setSourceScopeWarning(''); setSourceOverlapsReviewed(false);","    pdfBatchComplete.current = false;\n    resetPreview(); setTable(null); setDoc(null); setPdfSources([]); setSourceScopeWarning(''); setSourceOverlapsReviewed(false);");
change(page,"    await preparePdfReview(sources);","    const candidates = new Set(sources.map(source => source.report.supervisee.trim().toLowerCase()));\n    if (candidates.size !== 1 || candidates.has('')) throw new Error('All PDFs in one batch must identify the same candidate. Separate different users’ reports; no tracked entries were added.');\n    pdfBatchComplete.current = true;\n    await preparePdfReview(sources);");
change(page,"  async function preparePdfReview(sources: PdfSource[]) {","  async function preparePdfReview(sources: PdfSource[]) {\n    if (!pdfBatchComplete.current) throw new Error('The complete selected PDF batch has not been read successfully. Reselect all valid month files; no partial batch is ready to import.');");
change(page,"disabled={busy || pdfSources.some(source=>!source.report.reconciled || source.report.sessions.some(session=>!session.supervisor))}","disabled={busy || !pdfBatchComplete.current || pdfSources.some(source=>!source.report.reconciled || source.report.sessions.some(session=>!session.supervisor))}");
change(page,"{source.report.month} · {source.report.organization} · {source.report.sessions.length}","{source.report.supervisee} · {source.report.month} · {source.report.organization} · {source.report.sessions.length}");
const check='scripts/ripley-pdf-browser-check.mjs';
change(check,"  await page.setViewportSize({width:390,height:844});",`  await page.locator('input[type=file][accept]').setInputFiles([{name:'valid-first.pdf',mimeType:'application/pdf',buffer:pdf},{name:'invalid-second.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 invalid fixture')}]);
  await page.waitForTimeout(2000);
  const partialButton=page.getByRole('button',{name:'Prepare PDF review',exact:true});
  assert.ok(await partialButton.count()===0 || await partialButton.isDisabled(),'A failed batch must not expose a valid prefix as ready for import');
  assert.equal((await page.evaluate(email=>JSON.parse(localStorage.getItem(\`fieldworkByBaker:v1:\${email}:entries\`)||'[]'),email)).length,6);
  checks.push('a corrupt later file cannot silently turn a bulk import into a partial import');
  await page.setViewportSize({width:390,height:844});`);
console.log('Complete-batch integrity hardened; no user records touched.');
