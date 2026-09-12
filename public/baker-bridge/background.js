function isRipleyUrl(value) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'https:' && /(^|\.)ripleyfieldworktracker\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

async function findRipleyTab() {
  const tabs = await chrome.tabs.query({});
  const candidates = tabs.filter((tab) => tab.id && isRipleyUrl(tab.url));
  candidates.sort((a, b) => Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0));
  return candidates[0] || null;
}

async function extractRipleyHours() {
  const OVERLAY_ID = 'fieldwork-by-baker-transfer-overlay';
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  function showOverlay(title, detail, state = 'working') {
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(28,24,22,.78);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,system-ui,-apple-system,sans-serif;';
      document.documentElement.appendChild(overlay);
    }
    const working = state === 'working';
    const accent = state === 'error' ? '#c9445a' : '#e85d70';
    overlay.innerHTML = `<div style="width:min(540px,94vw);background:#fffaf7;border:1px solid #eadfd9;border-radius:30px;padding:36px;box-shadow:0 30px 100px rgba(0,0,0,.3);text-align:center"><div style="width:62px;height:62px;border-radius:20px;background:#fff0f3;color:${accent};display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:29px">✦</div><div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#e85d70;margin-bottom:8px">Fieldwork by Baker</div><div style="font-family:Georgia,serif;font-size:29px;font-weight:700;color:#332c28;margin-bottom:11px">${escapeHtml(title)}</div><div style="font-size:14px;line-height:1.65;color:#76675f">${escapeHtml(detail)}</div>${working ? '<div style="width:36px;height:36px;border:4px solid #f0dfdf;border-top-color:#e85d70;border-radius:50%;margin:25px auto 0;animation:bakerSpin .8s linear infinite"></div>' : '<div style="margin-top:22px;font-size:13px;font-weight:700;color:#5f514a">You can return to Fieldwork by Baker.</div>'}</div><style>@keyframes bakerSpin{to{transform:rotate(360deg)}}</style>`;
  }

  function cleanDocument(doc, url) {
    const tables = [...doc.querySelectorAll('table')].map((table) => [...table.querySelectorAll('tr')].map((row) => [...row.querySelectorAll('th,td')].map((cell) => (cell.innerText || '').replace(/\s+/g, ' ').trim()).join('\t')).join('\n')).join('\n---TABLE---\n');
    const root = doc.querySelector('main') || doc.querySelector('#content') || doc.body;
    const text = (root?.innerText || '').replace(/\n{4,}/g, '\n\n').slice(0, 45000);
    return `SOURCE ${url}\n${tables}\n${text}`;
  }

  try {
    showOverlay('Connecting to Fieldwork by Baker', 'Baker is checking that this is your Ripley Total Hours / Hours History page.');
    if (!/(^|\.)ripleyfieldworktracker\.com$/i.test(location.hostname)) {
      showOverlay('Open Ripley first', 'Baker Bridge only reads Ripley Fieldwork Tracker pages.', 'error');
      return { ok: false, code: 'WRONG_SITE', message: 'The open tab is not Ripley Fieldwork Tracker.' };
    }

    const heading = `${document.querySelector('h1,h2,h3')?.textContent || ''} ${document.title} ${location.pathname}`.toLowerCase();
    const tableText = [...document.querySelectorAll('table')].map((table) => table.innerText || '').join(' ').toLowerCase();
    const looksLikeHours = /(total\s*hours|hours?\s*history|fieldwork\s*hours|hour\s*entries|fieldwork\s*history)/i.test(heading) || (/date/.test(tableText) && /hour/.test(tableText));
    if (!looksLikeHours) {
      showOverlay('Go to Total Hours first', 'Navigate to Ripley’s Total Hours / Hours History page, then return to Baker and click Baker Bridge again.', 'error');
      return { ok: false, code: 'NOT_TOTAL_HOURS', message: 'Ripley is open, but it is not on the Total Hours / Hours History page yet.' };
    }

    showOverlay('Uploading to Fieldwork by Baker', 'Reading only the fieldwork information in this Total Hours / Hours History view. You can return to Baker while this finishes.');
    const parts = [cleanDocument(document, location.href)];
    const currentPath = location.pathname;
    const pageLinks = [...document.querySelectorAll('a[href]')]
      .map((anchor) => { try { return { url: new URL(anchor.href, location.href), label: (anchor.textContent || '').trim() }; } catch { return null; } })
      .filter((item) => item && item.url.origin === location.origin && item.url.pathname === currentPath && (/(page|paged|offset|start)=/i.test(item.url.search) || /^(next|previous|prev|\d+|›|»|‹|«)$/i.test(item.label)))
      .slice(0, 24);

    const seen = new Set([location.href]);
    for (const item of pageLinks) {
      if (!item || seen.has(item.url.href)) continue;
      seen.add(item.url.href);
      try {
        const response = await fetch(item.url.href, { credentials: 'include' });
        if (!response.ok) continue;
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) continue;
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        parts.push(cleanDocument(doc, item.url.href));
        if (parts.join('\n').length > 190000) break;
      } catch {}
    }

    const payload = parts.join('\n\n===== NEXT RIPLEY PAGE =====\n\n');
    showOverlay('Transfer sent to Fieldwork by Baker', 'Baker AI is structuring your hours now. Return to the Baker tab to watch the migration progress.', 'done');
    return { ok: true, payload, pages: parts.length, url: location.href };
  } catch (error) {
    showOverlay('Transfer could not finish', 'Nothing was changed in Ripley. Return to Baker and try again or use file upload.', 'error');
    return { ok: false, code: 'RIPLEY_READ_ERROR', message: error instanceof Error ? error.message : 'Baker could not read the Ripley hours page.' };
  }
}

async function startTransfer() {
  const tab = await findRipleyTab();
  if (!tab?.id) return { ok: false, code: 'NO_RIPLEY_TAB', message: 'No open Ripley tab was found. Click Open Ripley, sign in, and navigate to Total Hours first.' };
  try {
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: extractRipleyHours });
    return results?.[0]?.result || { ok: false, code: 'NO_RESULT', message: 'Baker Bridge did not receive data from the Ripley tab.' };
  } catch (error) {
    return { ok: false, code: 'SCRIPT_ERROR', message: error instanceof Error ? error.message : 'Baker Bridge could not access the Ripley tab.' };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'START_RIPLEY_TRANSFER') return undefined;
  startTransfer().then(sendResponse).catch((error) => sendResponse({ ok: false, code: 'EXTENSION_ERROR', message: error instanceof Error ? error.message : 'Baker Bridge failed.' }));
  return true;
});
