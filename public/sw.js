// Service Worker for Scientific Calculator PWA & Disguised Web Push

const CACHE_NAME = 'calc-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png'
];

// Default notification body disguised messages
const DEFAULT_DISGUISE_MESSAGES = [
  'Unit conversion rates updated',
  'New calculator tip available',
  'Calculator update ready'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network first, falling back to cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Disguised Web Push Handler
self.addEventListener('push', (event) => {
  let customTexts = DEFAULT_DISGUISE_MESSAGES;

  try {
    if (event.data) {
      const data = event.data.json();
      if (data && Array.isArray(data.customNotificationText) && data.customNotificationText.length > 0) {
        customTexts = data.customNotificationText;
      }
    }
  } catch (e) {
    // If payload is plain text or empty, use default disguise
  }

  // Randomly select body text from list
  const randomBody = customTexts[Math.floor(Math.random() * customTexts.length)];

  const options = {
    body: randomBody,
    icon: '/icon-192.png',
    badge: undefined,
    silent: true,
    vibrate: [],
    tag: 'calc-update',
    renotify: true,
    data: { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification('Calculator', options).then(() => {
      // Auto-close after ~8 seconds where supported by browser
      return new Promise((resolve) => {
        setTimeout(async () => {
          const notifications = await self.registration.getNotifications({ tag: 'calc-update' });
          notifications.forEach((n) => n.close());
          resolve();
        }, 8000);
      });
    })
  );
});

// Notification click handler - ALWAYS opens root calculator page, NEVER directly opens chat!
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
