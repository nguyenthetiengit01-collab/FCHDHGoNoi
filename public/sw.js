const CACHE_VERSION = "fc-gonoi-static-v1";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/images/logo.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(async (cache) => {
        await cache.addAll(PRECACHE_URLS);
        const offlineRes = await cache.match(OFFLINE_URL);
        if (offlineRes) {
          const html = await offlineRes.text();
          const staticMatches = html.match(/\/_next\/static\/[^"'\s<>]+\.(?:js|css)/g) || [];
          const uniqueAssets = [...new Set(staticMatches)];
          if (uniqueAssets.length > 0) {
            await cache.addAll(uniqueAssets);
          }
        }
      })
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isSafeStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/images/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Chỉ xử lý GET cùng origin; bỏ qua mọi POST/PUT/DELETE và cross-origin
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // TUYỆT ĐỐI KHÔNG CACHE API (xác thực, dữ liệu cá nhân, tài chính, import/export)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Điều hướng trang HTML: Network-first, chỉ fallback về /offline khi mất mạng.
  // Không lưu cache HTML để tránh lộ trạng thái phiên đăng nhập hoặc dữ liệu cũ.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedOffline = await caches.match(OFFLINE_URL);
        if (cachedOffline) return cachedOffline;
        return new Response(
          "Không có kết nối mạng. Vui lòng kiểm tra Internet và thử lại.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      })
    );
    return;
  }

  // Tài nguyên tĩnh (JS/CSS build hash, icon, ảnh CLB): Cache-first + revalidate nền
  if (isSafeStaticAsset(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok && response.type === "basic") {
              cache.put(request, response.clone()).catch(() => undefined);
            }
            return response;
          })
          .catch(() => undefined);

        return cached || (await networkFetch) || Response.error();
      })
    );
  }
});
