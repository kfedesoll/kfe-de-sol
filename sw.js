// K'fe De Sol — service worker untuk Push Notification SAHAJA (diambil daripada Repatha Care).
// Tiada cache (tiada "fetch" handler) — app sentiasa dimuat terus dari server, kemas kini tidak tersangkut.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let m = {}
  try { m = e.data ? e.data.json() : {} } catch { m = { body: e.data && e.data.text() } }
  e.waitUntil(self.registration.showNotification(m.title || "K'fe De Sol", {
    body: m.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    image: m.image || undefined, // gambar hebahan (Android; iPhone abaikan)
    tag: m.tag || undefined,
    renotify: !!m.tag,
    vibrate: [250, 100, 250, 100, 500],
    data: { url: m.url || '/' },
  }))
})

// Tekan notifikasi → buka (atau fokus) app K'fe De Sol
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = all.find((c) => new URL(c.url).origin === self.location.origin && !/\/(skrin|siap)\.html$/.test(new URL(c.url).pathname))
    if (open) return open.focus()
    return self.clients.openWindow(url)
  })())
})
