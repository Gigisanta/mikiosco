const CACHE = 'mikiosco-shell-v2'
const SHELL = ['/', '/index.html', '/manifest.webmanifest']
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)))
})
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).pathname.startsWith('/api/')) return
  const requestUrl = new URL(event.request.url)
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone()
      caches.open(CACHE).then(cache => cache.put('/index.html', copy))
      return response
    }).catch(() => caches.match('/index.html')))
    return
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (requestUrl.origin === self.location.origin) {
      const copy = response.clone()
      caches.open(CACHE).then(cache => cache.put(event.request, copy))
    }
    return response
  }).catch(() => caches.match('/index.html'))))
})
