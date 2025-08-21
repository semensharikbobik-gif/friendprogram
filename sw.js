const CACHE = "friendtimer-v4";        // новая версия кэша
const ROOT  = "/friendprogram/";       // путь каталога на GitHub Pages

const APP_SHELL = [
  ROOT,
  ROOT + "index.html",
  ROOT + "styles.css",
  ROOT + "app.js",
  ROOT + "manifest.webmanifest"
];

// Установка: кладём приложение в кэш
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

// Активация: чистим старые кэши
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Обработка запросов
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const accept = req.headers.get("accept") || "";

  // Для HTML: сначала сеть (чтобы обновляться), при офлайне — кэш
  if (req.mode === "navigate" || accept.includes("text/html")) {
    e.respondWith(
      fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(ROOT + "index.html", copy));
        return resp;
      }).catch(() => caches.match(ROOT + "index.html"))
    );
    return;
  }

  // Для статики (CSS/JS/иконки): cache-first
  if (req.method === "GET") {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        if (resp && resp.status === 200 && resp.type === "basic") {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return resp;
      }))
    );
  }
});
