const CACHE_STATIC_NAME = 'aven-static-v1.0.40';
const CACHE_DYNAMIC_NAME = 'aven-dynamic-v1.0.40';
const CACHE_IMG_NAME = 'aven-images-v1.0.40';
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

// --- FUNCIONES AUXILIARES ---

// Función para limitar el tamaño de la caché (FIFO)
const trimCache = (cacheName, maxItems) => {
  caches.open(cacheName).then(cache => {
    cache.keys().then(keys => {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(trimCache(cacheName, maxItems));
      }
    });
  });
};

// 1. INSTALACIÓN
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-cacheando App Shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// 2. ACTIVACIÓN
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_STATIC_NAME &&
          key !== CACHE_DYNAMIC_NAME &&
          key !== CACHE_IMG_NAME) {
          console.log('[Service Worker] Limpiando caché antigua:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// 3. FETCH (Estrategias Interceptadas)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // A. Ignorar Socket.io y peticiones POST (Los SW no pueden cachear POST por defecto)
  if (url.pathname.includes('socket.io') || request.method !== 'GET') {
    return;
  }

  // B. Estrategia para API (Network First con Fallback a Caché)
  // Ideal para feeds: intenta obtener lo más nuevo, si falla, muestra lo viejo.
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      caches.open(CACHE_DYNAMIC_NAME).then((cache) => {
        return fetch(request)
          .then((response) => {
            // Guardamos copia fresca solo si la respuesta es válida
            if (response.status === 200) {
              cache.put(request, response.clone());
              trimCache(CACHE_DYNAMIC_NAME, 30); // Limpiamos si hay demasiadas peticiones API guardadas
            }
            return response;
          })
          .catch(() => {
            return cache.match(request); // Devuelve JSON viejo si no hay red
          });
      })
    );
    return;
  }

  // C. Estrategia para Imágenes (Cache First con Fallback Genérico)
  // Las imágenes de redes sociales cambian poco (avatares), priorizamos velocidad.
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(CACHE_IMG_NAME).then((cache) => {
        return cache.match(request).then((response) => {
          if (response) return response; // Si está en caché, retornamos

          // Si no, vamos a la red
          return fetch(request).then((networkResponse) => {
            cache.put(request, networkResponse.clone()); // Guardamos la nueva imagen
            trimCache(CACHE_IMG_NAME, 60); // Controlamos no llenar el disco
            return networkResponse;
          }).catch(() => {
            // D. Fallback si falla la imagen y no está en caché (Offline total)
            // Aquí retornas tu avatar por defecto precacheado
            return caches.match('/assets/default-avatar.png');
          });
        });
      })
    );
    return;
  }

  // E. Estrategia por defecto para archivos estáticos (Stale-While-Revalidate modificado o Cache First)
  // Para JS, CSS y HTML que no son el App Shell inicial
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
          // Fallback para navegación HTML (si el usuario recarga en una ruta interna)
          if (request.headers.get('accept').includes('text/html')) {
            return caches.match('/offline.html');
          }
        });
    })
  );
});