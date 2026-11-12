const CACHE_NAME = "tissu-planner-v12";
const FILES_TO_CACHE = [
  "./", "./index.html", "./manifest.json", "./assets/css/style.css?v=20261112-2",
  "./assets/js/ocr.js?v=20261112-2", "./assets/js/parser.js?v=20261112-2", "./assets/js/form.js?v=20261112-2",
  "./assets/js/install.js?v=20261112-2", "./assets/image/favicon_pref_2.png",
  "./assets/js/history-core.js?v=20261112-2", "./assets/js/history.js?v=20261112-2",
  "./assets/js/draft.js?v=20261112-2", "./assets/js/orientation.js?v=20261112-2",
  "./assets/image/icon-192.png", "./assets/image/icon-512.png"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith("tissu-planner-") && key !== CACHE_NAME)
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener("message", event => {
  if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
});
self.addEventListener("fetch", event => {
  // Ne jamais intercepter les POST vers Apps Script.
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  // Ne conserver que l'interface publique : jamais les réponses OAuth/Sheets ou les photos.
  const allowed = FILES_TO_CACHE.some(path => new URL(path, self.registration.scope).pathname === new URL(event.request.url).pathname);
  if (!allowed) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
