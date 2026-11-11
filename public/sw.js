/* Service worker do Lyra: instalação como app e avisos (Web Push). Sem cache offline: a agenda precisa ser a atual. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    let aviso = {};
    try {
        aviso = event.data ? event.data.json() : {};
    } catch {
        aviso = { corpo: event.data ? event.data.text() : '' };
    }
    const escopo = self.registration.scope;
    event.waitUntil(
        self.registration.showNotification(aviso.titulo || 'Lyra', {
            body: aviso.corpo || '',
            icon: new URL('icons/icon-192.png', escopo).href,
            badge: new URL('icons/badge-96.png', escopo).href,
            tag: aviso.tag,
            renotify: Boolean(aviso.tag),
            data: { url: new URL(aviso.url || 'inicio', escopo).href },
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
    event.waitUntil(
        (async () => {
            const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            const lyra = abertas.find((c) => c.url.startsWith(self.registration.scope));
            if (lyra) {
                await lyra.focus();
                if ('navigate' in lyra) return lyra.navigate(url);
                return undefined;
            }
            return self.clients.openWindow(url);
        })()
    );
});

/* O Chrome só oferece "Instalar" com um handler de fetch; deixar passar direto para a rede. */
self.addEventListener('fetch', () => {});
