// audio-worker.js — Service Worker for background audio persistence
// Keeps audio alive when tab is hidden, screen locked, or app is switched

const CACHE_NAME = 'chatpro-audio-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const { type } = event.data || {};
  if (type === 'PING') {
    event.ports[0]?.postMessage({ type: 'PONG' });
  }
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (url.includes('/api/music/proxy') || url.includes('/api/music/stream')) {
    event.respondWith(
      fetch(event.request.clone()).catch(() => {
        return new Response('Audio stream temporarily unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
  }
});
