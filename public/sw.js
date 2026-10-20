/* Service worker: web push notifications only (no offline caching). */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

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
