// Simple event emitter for cross-component communication
const listeners = {};

export function on(event, callback) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);
  
  // Return unsubscribe function
  return () => {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    }
  };
}

export function emit(event, data) {
  if (listeners[event]) {
    listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.warn('Event listener error:', e);
      }
    });
  }
}