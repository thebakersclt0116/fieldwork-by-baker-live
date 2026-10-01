(() => {
  let running = '';
  const send = payload => window.postMessage({ source: 'BAKER_DETAIL_EXTENSION', ...payload }, window.location.origin);
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== window.location.origin || event.data?.source !== 'BAKER_DETAIL_WEB' || location.pathname !== '/import') return;
    if (event.data.type === 'PING') { send({ type: 'READY' }); return; }
    const requestId = event.data.requestId;
    if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) return;
    if (event.data.type === 'CANCEL' && running === requestId) { chrome.runtime.sendMessage({ type: 'DETAIL_CANCEL', requestId }); return; }
    if (event.data.type !== 'START' || running) return;
    running = requestId;
    const keepAlive = setInterval(() => chrome.runtime.sendMessage({ type: 'DETAIL_PING' }).catch(() => {}), 15000);
    const timeout = setTimeout(() => {
      if (running === requestId) { running = ''; send({ type: 'RESULT', requestId, ok: false, error: 'Capture timed out. No source data was changed. Retry or request a detailed export.' }); }
      clearInterval(keepAlive);
    }, 260000);
    chrome.runtime.sendMessage({ type: 'DETAIL_START', requestId }).then(result => {
      clearTimeout(timeout); clearInterval(keepAlive);
      if (running !== requestId) return;
      running = ''; send({ type: 'RESULT', requestId, ...result });
    }).catch(() => { clearTimeout(timeout); clearInterval(keepAlive); running = ''; send({ type: 'RESULT', requestId, ok: false, error: 'The extension stopped. Reload this page; no source entries were changed.' }); });
  });
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'DETAIL_PROGRESS' && message.requestId === running) send({ type: 'PROGRESS', requestId: running, message: message.message });
  });
  if (location.pathname === '/import') send({ type: 'READY' });
})();
