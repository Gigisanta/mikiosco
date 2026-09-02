const CACHE = 'mikiosco-shell-v4'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/mikiosco-icon.svg']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

async function cacheSuccessful(request, response) {
  if (response?.ok && new URL(request.url).origin === self.location.origin) {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/')) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE)
            await cache.put('/index.html', response.clone())
          }
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const refreshed = fetch(event.request).then((response) =>
          cacheSuccessful(event.request, response),
        )
        return cached || refreshed
      }),
    )
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => cacheSuccessful(event.request, response))
      .catch(() => caches.match(event.request)),
  )
})
