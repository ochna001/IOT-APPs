// Simple JS event emitter for in-app notifications (no native deps)
const listeners = Object.create(null);

export function on(event, cb) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(cb);
  return () => off(event, cb);
}

export function off(event, cb) {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter(fn => fn !== cb);
}

export function emit(event, payload) {
  const list = listeners[event] || [];
  for (const fn of list.slice()) {
    try { fn(payload); } catch (e) { console.warn('emitter handler error', e); }
  }
}

export default { on, off, emit };
