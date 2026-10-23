/* Service worker: web push notifications, and an app shell that keeps the app quick on a weak signal.
 *  - The app's own files (/_next/static, hashed, never change) come from the cache first.
 *  - Images and fonts (/assets, /fonts) come from the cache and are refreshed behind the scenes.
 *  - Pages: the network first; if it takes longer than a few seconds or fails, the last copy of that
 *    page is shown (it then refreshes its own figures). Sign-in pages, API calls and anything other
 *    than GET are never cached, and the saved pages are wiped on sign-out. */
const VERSION = 'v1'
const STATIC_CACHE = `static-${VERSION}`
const PAGE_CACHE = `pages-${VERSION}`
const PAGE_TIMEOUT_MS = 3500
const NO_PAGE_CACHE = /^\/(login|reset-password|api|auth|terms|privacy)(\/|$)/

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
)

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'clear-pages') event.waitUntil(caches.delete(PAGE_CACHE))
})

const STATIC_LIMIT = 250 // files; each deploy adds new ones, so the oldest are dropped past this

async function trim(cache) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - STATIC_LIMIT; i++) await cache.delete(keys[i])
}

async function cacheFirst(event, request) {
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) event.waitUntil(cache.put(request, res.clone()).then(() => trim(cache)))
  return res
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(request)
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => hit)
  if (hit) {
    event.waitUntil(fresh)
    return hit
  }
  return fresh
}

async function pageNetworkFirst(event, request) {
  const cache = await caches.open(PAGE_CACHE)
  const network = fetch(request).then((res) => {
    // Only a plain signed-in page is kept (not a redirect to sign-in, not an error).
    const html = (res.headers.get('content-type') || '').includes('text/html')
    if (res.ok && !res.redirected && html) cache.put(request, res.clone())
    return res
  })
  event.waitUntil(network.catch(() => {}))
  const slow = new Promise((resolve) => setTimeout(resolve, PAGE_TIMEOUT_MS, 'slow'))
  const first = await Promise.race([network.catch(() => 'failed'), slow])
  if (first !== 'slow' && first !== 'failed') return first
  const saved = await cache.match(request)
  if (saved) return saved
  return network // nothing saved yet: keep waiting for the network
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event, request))
  } else if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(staleWhileRevalidate(event, request))
  } else if (request.mode === 'navigate' && !NO_PAGE_CACHE.test(url.pathname)) {
    event.respondWith(pageNetworkFirst(event, request))
  }
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Add designer', body: event.data.text() }
  }
  const options = {
    body: data.body,
    icon: data.icon || '/assets/logo.png',
    badge: '/assets/logo.png',
    tag: data.tag,
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Add designer', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === target.origin && 'focus' in client) {
          return client.focus().then((c) => ('navigate' in c ? c.navigate(target.href) : c))
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target.href) : undefined
    })
  )
})
