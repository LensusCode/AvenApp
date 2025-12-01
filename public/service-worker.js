const CACHE_NAME = 'aven-app-v1.0.30'; // Cambiamos el nombre para forzar actualización
const CACHE_DYNAMIC_NAME = 'aven-dynamic-v1.0.30'; // Para guardar datos de la API (historial)

const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/socket.io/socket.io.js', // Librería del cliente
  '/manifest.json',
  '/offline.html' // Opcional: Una página de error personalizada
];

// 1. INSTALACIÓN: Pre-cachear recursos estáticos (App Shell)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-cacheando App Shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Fuerza al SW a activarse inmediatamente
  );
});

// 2. ACTIVACIÓN: Limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        // Si la caché no es la actual (estática o dinámica), la borramos
        if (key !== CACHE_NAME && key !== CACHE_DYNAMIC_NAME) {
          console.log('[Service Worker] Borrando caché antigua:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim(); // Toma el control de todos los clientes inmediatamente
});

// 3. FETCH: Estrategias de intercepción
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // A. Ignorar WebSockets (Socket.io usa WS y polling, no queremos cachear el polling en tiempo real)
  if (url.pathname.includes('socket.io')) {
    return;
  }

  // B. Estrategia para API (Historial de mensajes): Network First, luego Cache
  // Si tu app pide el historial por HTTP (ej: /api/messages), usamos esto.
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      caches.open(CACHE_DYNAMIC_NAME).then((cache) => {
        return fetch(request)
          .then((response) => {
            // Si hay internet, guardamos una copia fresca en caché y la retornamos
            cache.put(request, response.clone());
            return response;
          })
          .catch(() => {
            // Si no hay internet, devolvemos lo que haya en caché
            return cache.match(request);
          });
      })
    );
    return;
  }

  // C. Estrategia para Archivos Estáticos (CSS, JS, Imágenes): Cache First, luego Network
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response; // Si está en caché, úsalo (súper rápido)
      }
      // Si no está en caché, búscalo en la red
      return fetch(request).then((networkResponse) => {
        // Opcional: Podrías guardar dinámicamente nuevas imágenes aquí
        return networkResponse;
      }).catch(() => {
        // D. Fallback para navegación (Si el usuario recarga offline y no hay caché)
        if (request.headers.get('accept').includes('text/html')) {
          return caches.match('/offline.html'); // Página de respaldo (debes crearla)
        }
      });
    })
  );
});