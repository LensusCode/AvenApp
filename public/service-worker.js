const CACHE_STATIC_NAME = 'aven-static-v1.0.42';
const CACHE_DYNAMIC_NAME = 'aven-dynamic-v1.0.42';
const CACHE_IMG_NAME = 'aven-images-v1.0.42';
const CACHE_EMOJI_NAME = 'aven-emojis-v1.0.42';
const CACHE_LIMIT = 50;

const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/offline.html',
  '/profile.png',
  '/profile.png'
];

const trimCache = (cacheName, maxItems) => {
  caches.open(cacheName).then(cache => {
    cache.keys().then(keys => {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(trimCache(cacheName, maxItems));
      }
    });
  });
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_STATIC_NAME &&
          key !== CACHE_DYNAMIC_NAME &&
          key !== CACHE_IMG_NAME &&
          key !== CACHE_EMOJI_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.includes('socket.io') || request.method !== 'GET') {
    return;
  }

  if (url.pathname.endsWith('.webp') || url.pathname.includes('/Animated-Emojis/')) {
    event.respondWith(
      caches.open(CACHE_EMOJI_NAME).then((cache) => {
        return cache.match(request).then((response) => {
          if (response) {
            return response;
          }
          return fetch(request).then((networkRes) => {
            cache.put(request, networkRes.clone());
            return networkRes;
          });
        });
      })
    );
    return;
  }

  if (url.pathname.includes('/api/')) {
    event.respondWith(
      caches.open(CACHE_DYNAMIC_NAME).then((cache) => {
        return fetch(request)
          .then((response) => {
            if (response.status === 200) {
              cache.put(request, response.clone());
              trimCache(CACHE_DYNAMIC_NAME, 30);
            }
            return response;
          })
          .catch(() => {
            return cache.match(request);
          });
      })
    );
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(
      caches.open(CACHE_IMG_NAME).then((cache) => {
        return cache.match(request).then((response) => {
          if (response) return response;

          return fetch(request).then((networkResponse) => {
            cache.put(request, networkResponse.clone());
            trimCache(CACHE_IMG_NAME, 60);
            return networkResponse;
          }).catch(() => {
            return caches.match('/assets/default-avatar.png');
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(request)
        .then((res) => {
          return caches.open(CACHE_DYNAMIC_NAME).then((cache) => {
            cache.put(request, res.clone());
            return res;
          });
        })
        .catch(() => {
          if (request.headers.get('accept').includes('text/html')) {
            return caches.match('/offline.html');
          }
        });
    })
  );
});