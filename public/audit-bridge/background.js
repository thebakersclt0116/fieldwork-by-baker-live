// These two DOM readers are self-contained because chrome.scripting serializes them.
export function scanHistoryDocument() {
  const root = document.querySelector('main') || document.body;
  const forbidden = /delete|remove|destroy|logout|signout|submit|save|create|new\b|password|account|profile/i;
  const links = [];
  for (const a of root.querySelectorAll('a[href]')) {
    let url; try { url = new URL(a.getAttribute('href'), location.href); } catch { continue; }
    if (url.origin !== location.origin || forbidden.test(url.pathname + url.search)) continue;
    if ([...url.searchParams.keys()].some(k => /token|secret|auth|password|action/i.test(k))) continue;
    const label = `${a.textContent || ''} ${a.getAttribute('aria-label') || ''} ${a.getAttribute('title') || ''}`;
    const entryPath = /hour|entr(?:y|ies)|fieldwork/i.test(url.pathname);
    const isDetail = /\/(edit|view|detail)(?:\/|$)/i.test(url.pathname) || /edit|view|detail/i.test(label) || /\/(hours?|entries)\/[a-f0-9-]+\/?$/i.test(url.pathname);
    if (entryPath && isDetail && !links.some(l => l.url === url.href)) links.push({ url: url.href, sourceId: url.pathname });
  }
  const tables = [...root.querySelectorAll('table')].map(table => {
    const allRows = [...table.querySelectorAll('tr')];
    const headers = [...(allRows[0]?.querySelectorAll('th,td') || [])].map(cell => cell.textContent.trim());
    const valid = headers.some(h => /date/i.test(h)) && headers.some(h => /hour|duration/i.test(h));
    return valid ? { headers, rows: allRows.slice(1).map(row => [...row.querySelectorAll('td')].map(cell => cell.innerText || cell.textContent || '')) } : null;
  }).filter(Boolean);
  return { links, tables, sourcePath: location.pathname, title: document.title };
}
export function readDetailDocument() {
  const forms = [...document.querySelectorAll('form')];
  const labelOf = el => {
    const explicit = el.labels?.[0]?.textContent || el.getAttribute('aria-label');
    if (explicit) return explicit.replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim();
    return el.name || el.id || '';
  };
  const form = forms.find(f => {
    const labels = [...f.querySelectorAll('input,select,textarea')].map(labelOf).join(' ').toLowerCase();
    return /date/.test(labels) && /start/.test(labels) && /end/.test(labels);
  });
  if (!form) return { ok: false, reason: 'An entry form containing date, start and end fields was not found. Custom widgets or summary pages require a detailed export.' };
  const record = { 'Entry ID': location.pathname };
  const controls = [];
  for (const el of form.querySelectorAll('input,select,textarea')) {
    const type = String(el.type || '').toLowerCase(), label = labelOf(el);
    if (!label || ['hidden', 'password', 'submit', 'button', 'reset', 'file'].includes(type) || /password|csrf|token|secret|session/i.test(label + ' ' + el.name)) continue;
    if (type === 'radio' && !el.checked) continue;
    let value = el.value ?? '', shown = value;
    if (el.tagName === 'SELECT') shown = [...el.selectedOptions].map(o => o.textContent.trim()).join(' | ');
    if (type === 'checkbox') shown = el.checked ? 'true' : 'false';
    const key = type === 'radio' ? el.name || label : label;
    let uniqueKey = key, count = 2;
    while (Object.prototype.hasOwnProperty.call(record, uniqueKey)) uniqueKey = `${key} (${count++})`;
    record[uniqueKey] = shown;
    controls.push({ label, name: el.name || '', type, value, shown, ...(type === 'checkbox' || type === 'radio' ? { checked: el.checked } : {}) });
  }
  record.__originalControls = controls;
  record.__sourceEntryText = form.innerText || form.textContent || '';
  record.__sourcePath = location.pathname;
  return { ok: true, record };
}
const tasks = new Map();
const allowedBaker = url => { try { const u = new URL(url); return u.protocol === 'https:' && ['www.fieldworkbybaker.com', 'fieldworkbybaker.com'].includes(u.hostname) && u.pathname === '/import'; } catch { return false; } };
const ripley = url => { try { const u = new URL(url); return u.protocol === 'https:' && /(^|\.)ripleyfieldworktracker\.com$/i.test(u.hostname); } catch { return false; } };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function runIn(tabId, func) { const result = await chrome.scripting.executeScript({ target: { tabId }, func }); return result[0]?.result; }
async function capture(sender, requestId) {
  const key = sender.tab.id;
  if (tasks.has(key)) return { ok: false, error: 'A capture is already in progress.' };
  const task = { cancel: false }; tasks.set(key, task);
  let temp;
  const warnings = [], entries = [], failed = [];
  try {
    const tabs = (await chrome.tabs.query({})).filter(t => t.id && ripley(t.url)).sort((a, b) => Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0));
    if (!tabs.length) return { ok: false, error: 'Open Ripley, sign in yourself, and open a month/hour-entry history page first.' };
    const source = tabs[0], scan = await runIn(source.id, scanHistoryDocument);
    if (!scan?.links.length) {
      return { ok: false, error: 'No supported entry-detail links were found on the open Ripley page. This bridge will not mistake a summary table for full records. Open a month dashboard with entry pencil/edit links, or request a complete CSV/JSON export.' };
    }
    const digestBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scan.links.map(l => l.url).join('\n')));
    const cursorKey = 'detail-' + [...new Uint8Array(digestBytes)].map(b => b.toString(16).padStart(2, '0')).join('');
    const stored = await chrome.storage.session.get(cursorKey), offset = Number(stored[cursorKey] || 0);
    const start = offset < scan.links.length ? offset : 0, deadline = Date.now() + 210000;
    temp = await chrome.tabs.create({ url: 'about:blank', active: false });
    let next = start;
    for (; next < scan.links.length && next < start + 100 && Date.now() < deadline && !task.cancel; next++) {
      const link = scan.links[next];
      chrome.tabs.sendMessage(key, { type: 'DETAIL_PROGRESS', requestId, message: `Reading original entry ${next + 1} of ${scan.links.length} linked from this page. No source edits are being saved.` }).catch(() => {});
      await chrome.tabs.update(temp.id, { url: link.url, active: false });
      let detail, lastPath = '';
      for (let attempt = 0; attempt < 16 && Date.now() < deadline && !task.cancel; attempt++) {
        await sleep(500);
        const tab = await chrome.tabs.get(temp.id);
        if (tab.status !== 'complete' || !ripley(tab.url)) continue;
        lastPath = new URL(tab.url).pathname;
        if (lastPath !== new URL(link.url).pathname) continue;
        try { detail = await runIn(temp.id, readDetailDocument); } catch { continue; }
        if (detail?.ok) break;
      }
      if (detail?.ok) entries.push(detail.record);
      else failed.push({ sourceId: link.sourceId, reason: detail?.reason || 'Entry did not render in time or authentication redirected it.', finalPath: lastPath });
    }
    const remaining = scan.links.length - next;
    await chrome.storage.session.set({ [cursorKey]: remaining > 0 ? next : 0 });
    warnings.push('Scope is only the entry links on the page you opened. Other months, organizations, pagination pages and attachments are NOT automatically included.');
    if (remaining) warnings.push(`${remaining} links remain on this page. Press Capture entry details again to continue the next batch. Do not call this a complete migration yet.`);
    if (failed.length) warnings.push(`${failed.length} entries could not be read. Their identifiers are in capture.failed. Revisit those entries or request an export; do not retire the source account.`);
    if (task.cancel) warnings.push('Capture stopped by user; the returned records are partial.');
    return { ok: true, report: { format: 'baker-ripley-detail-capture-v1', capturedAt: new Date().toISOString(), sourceSystem: 'Ripley', entries, warnings, capture: { scope: 'current-page-linked-entry-forms', sourcePath: scan.sourcePath, linkedCount: scan.links.length, startingOffset: start, nextOffset: next, remaining, failed, listTables: scan.tables, completeAccount: false } } };
  } catch (e) { return { ok: false, error: `Read-only capture stopped: ${e instanceof Error ? e.message : String(e)}. Nothing was modified in Ripley.` }; }
  finally { if (temp?.id) await chrome.tabs.remove(temp.id).catch(() => {}); tasks.delete(key); }
}
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!sender.tab?.id || !allowedBaker(sender.url || sender.tab.url)) return;
  if (message?.type === 'DETAIL_CANCEL') { const task = tasks.get(sender.tab.id); if (task) task.cancel = true; respond({ ok: true }); return; }
  if (message?.type === 'DETAIL_PING') { respond({ ok: true }); return; }
  if (message?.type !== 'DETAIL_START' || !/^[a-f0-9-]{36}$/i.test(message.requestId || '')) return;
  capture(sender, message.requestId).then(respond).catch(() => respond({ ok: false, error: 'Capture failed. Nothing changed in Ripley.' }));
  return true;
});
