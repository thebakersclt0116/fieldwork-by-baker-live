(() => {
  const WEB_SOURCE = 'FIELDWORK_BY_BAKER_WEB';
  const EXT_SOURCE = 'FIELDWORK_BY_BAKER_EXTENSION';
  const VERSION = '0.1.0';

  function post(type, detail = {}) {
    window.postMessage({ source: EXT_SOURCE, type, version: VERSION, ...detail }, window.location.origin);
  }

  function announceReady() {
    post('BAKER_BRIDGE_EXTENSION_READY');
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.source !== WEB_SOURCE) return;

    if (data.type === 'BAKER_BRIDGE_PING') {
      announceReady();
      return;
    }

    if (data.type !== 'BAKER_BRIDGE_START') return;

    post('BAKER_BRIDGE_STARTED');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'START_RIPLEY_TRANSFER' });
      post('BAKER_BRIDGE_RESULT', { response });
    } catch (error) {
      post('BAKER_BRIDGE_RESULT', {
        response: {
          ok: false,
          code: 'EXTENSION_ERROR',
          message: error instanceof Error ? error.message : 'Baker Bridge could not start.',
        },
      });
    }
  });

  announceReady();
  document.addEventListener('DOMContentLoaded', announceReady, { once: true });
})();
