// Simple poller utility: startPolling(deviceId, host, path, intervalSec)
// subscribe(deviceId, cb) -> cb({ deviceId, url, ok, text, json, error, ts })

const timers = {};
const subscribers = {};

function normalizeHost(h) {
  if (!h) return '';
  return h.replace(/^https?:\/\//i, '').replace(/\/+$/,'');
}

function notify(deviceId, data) {
  const subs = subscribers[deviceId] || [];
  subs.forEach(cb => {
    try { cb(data); } catch (e) { console.warn('poller subscriber error', e); }
  });
}

export function subscribe(deviceId, cb) {
  if (!subscribers[deviceId]) subscribers[deviceId] = [];
  subscribers[deviceId].push(cb);
  return () => {
    subscribers[deviceId] = (subscribers[deviceId] || []).filter(x => x !== cb);
  };
}

export function startPolling(deviceId, host, path = 'sensor/temperature', intervalSec = 5) {
  if (!deviceId || !host) return;
  stopPolling(deviceId);
  const h = normalizeHost(host);
  const p = String(path || '').trim().replace(/^\/+/, '');
  const encoded = encodeURI(p);
  const url = `http://${h}/${encoded}`;

  async function tick() {
    const ts = Date.now();
    try {
      const res = await fetch(url);
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch (e) { /* not json */ }
      notify(deviceId, { deviceId, url, ok: res.ok, status: res.status, text, json, ts });
    } catch (error) {
      notify(deviceId, { deviceId, url, ok: false, error: error.message || String(error), ts });
    }
  }

  // run immediately then interval
  tick();
  const id = setInterval(tick, Math.max(1000, intervalSec * 1000));
  timers[deviceId] = id;
}

export function stopPolling(deviceId) {
  const t = timers[deviceId];
  if (t) { clearInterval(t); delete timers[deviceId]; }
  // also clear subscribers optionally? keep subscribers
}

export function stopAll() {
  Object.keys(timers).forEach(k => stopPolling(k));
}

export default { startPolling, stopPolling, subscribe, stopAll };
