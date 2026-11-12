const CACHE_NAME = "tissu-planner-v16";
const APP_RELEASE = "20261112-6";
const FILES_TO_CACHE = [
 "./", "./index.html", "./manifest.json?v=20261112-6", "./assets/css/style.css?v=20261112-6",
 "./assets/js/ocr.js?v=20261112-6", "./assets/js/parser.js?v=20261112-6", "./assets/js/form.js?v=20261112-6",
 "./assets/js/install.js?v=20261112-6", "./assets/js/history.js?v=20261112-6", "./assets/js/history-core.js?v=20261112-6",
 "./assets/js/draft.js?v=20261112-6", "./assets/js/orientation.js?v=20261112-6",
 "./assets/image/favicon_pref_2.png?v=20261112-6", "./assets/image/favicon_pref.png",
 "./assets/image/install-pref-192.png", "./assets/image/install-pref-512.png"
];
self.addEventListener("install", event => {
 // Télécharger les vrais fichiers neufs avant de remplacer le worker, même si
 // le cache HTTP ou l'ancien worker possède encore une ancienne interface.
 event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE.map(path =>
   new Request(new URL(path, self.registration.scope), { cache: "reload" })
 ))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key =>
   key.startsWith("tissu-planner-") && key !== CACHE_NAME
 ).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("message", event => {
 if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
 if (event.data?.type === "GET_VERSION") event.ports?.[0]?.postMessage({ release: APP_RELEASE });
});
async function pageResponse(request) {
 const cache = await caches.open(CACHE_NAME);
 const fallback = new URL("./index.html", self.registration.scope).href;
 try {
   const response = await fetch(new Request(request, { cache: "no-store" }));
   if (response.ok) await cache.put(fallback, response.clone()).catch(() => {});
   return response;
 } catch (error) {
   const offline = await cache.match(fallback);
   if (offline) return offline;
   throw error;
 }
}
self.addEventListener("fetch", event => {
 const request = event.request, url = new URL(request.url);
 // Aucun POST, réponse Google, photo ou fichier hors de cette application.
 if (request.method !== "GET" || url.origin !== self.location.origin) return;
 const allowed = FILES_TO_CACHE.some(path => new URL(path, self.registration.scope).pathname === url.pathname);
 if (!allowed) return;
 const page = url.pathname === new URL("./", self.registration.scope).pathname ||
   url.pathname === new URL("./index.html", self.registration.scope).pathname;
 if (page) { event.respondWith(pageResponse(request)); return; }
 event.respondWith(caches.open(CACHE_NAME).then(async cache => {
   const cached = await cache.match(request);
   return cached || fetch(request);
 }));
});
