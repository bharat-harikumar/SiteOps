/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import {
  BackgroundSyncQueue,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
} from "serwist";

import {
  classifyReplayStatus,
  describeRejectedWrite,
} from "../lib/pwa/replayOutcome";
import { isLiveToolPath } from "../lib/pwa/toolRequests";

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: Array<PrecacheEntry | string>;
  }
}

declare const self: ServiceWorkerGlobalScope;

const API_CACHE = "siteops-api-v1";
const PAGE_CACHE = "siteops-pages-v1";

let currentUserId = "anon";

// PWA4 — offline write outbox. Field workers on bad signal expect a log or
// transfer submitted offline to send once they reconnect. Failed POSTs to the
// entry/transfer endpoints are queued and replayed on the next `sync` event (or
// SW startup as a fallback). Clients are notified so the UI can reflect the
// pending → synced transition.
async function notifyClients(message: Record<string, unknown>) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(message));
}

// Reads what the server said and what we sent, for the "not saved" message.
// Both reads are best-effort: the message must still go out if either fails.
async function rejectionNotice(request: Request, response: Response) {
  const [body, reply] = await Promise.all([
    request
      .clone()
      .json()
      .catch(() => null),
    response.json().catch(() => null),
  ]);
  const serverMessage =
    typeof reply?.error?.message === "string" ? reply.error.message : null;
  return describeRejectedWrite({
    pathname: new URL(request.url).pathname,
    body,
    serverMessage,
  });
}

const writeSyncQueue = new BackgroundSyncQueue("siteops-write-sync", {
  maxRetentionTime: 24 * 60, // retry for up to 24h, then drop
  onSync: async ({ queue }) => {
    let rejected = 0;
    let entry: Awaited<ReturnType<typeof queue.shiftRequest>>;
    while ((entry = await queue.shiftRequest())) {
      let response: Response;
      try {
        response = await fetch(entry.request.clone());
      } catch (error) {
        // Put it back at the front and rethrow so the browser retries later.
        await queue.unshiftRequest(entry);
        throw error;
      }

      const outcome = classifyReplayStatus(response.status);
      if (outcome === "retry") {
        // Server down, rate limited or signed out: the entry may still save later.
        await queue.unshiftRequest(entry);
        throw new Error(
          `Replay of ${entry.request.url} returned ${response.status}`,
        );
      }
      if (outcome === "rejected") {
        // The server read it and refused it (stale Work Stage, archived site…).
        // Retrying can never work, so drop it from the queue — but tell the user,
        // never report it as synced.
        rejected += 1;
        await notifyClients({
          type: "BG_SYNC_REJECTED",
          url: entry.request.url,
          message: await rejectionNotice(entry.request, response),
        });
        continue;
      }
      await notifyClients({ type: "BG_SYNC_REPLAYED", url: entry.request.url });
    }
    if (rejected === 0) await notifyClients({ type: "BG_SYNC_DRAINED" });
  },
});

const isQueueableWrite = (url: URL, method: string) =>
  method === "POST" &&
  (url.pathname.startsWith("/api/entries") ||
    url.pathname === "/api/transfers");

const userScopedCachePlugin = {
  cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    url.searchParams.set("_u", currentUserId || "anon");
    return new Request(url.toString(), request);
  },
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin && request.method === "GET" && isLiveToolPath(url.pathname),
      handler: new NetworkOnly(),
    },
    {
      // PWA4 — entry/transfer writes go network-first; on failure (offline) they
      // are queued for background sync and replayed later instead of being lost.
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin && isQueueableWrite(url, request.method),
      handler: new NetworkOnly({
        plugins: [
          {
            fetchDidFail: async ({ request }) => {
              await writeSyncQueue.pushRequest({ request });
              await notifyClients({ type: "BG_SYNC_QUEUED", url: request.url });
            },
          },
        ],
      }),
    },
    {
      // Cache GET /api/* responses, excluding admin and live data — those must
      // always reflect current server state for security and freshness.
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin &&
        request.method === "GET" &&
        url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/api/admin") &&
        !url.pathname.startsWith("/api/admin/live-feed"),
      handler: new StaleWhileRevalidate({
        cacheName: API_CACHE,
        plugins: [
          userScopedCachePlugin,
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 300,
          }),
        ],
      }),
    },
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: PAGE_CACHE,
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 40,
            maxAgeSeconds: 60 * 60 * 24,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
  // Offline navigation that misses the network AND the page cache lands on the
  // branded offline screen instead of the browser error page (PWA2).
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

// Retire inventory persisted by older workers. The live rule also covers RSC
// page requests, so an old stock/permission response cannot become a fallback.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of [API_CACHE, PAGE_CACHE]) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        await Promise.all(
          keys
            .filter((key) => isLiveToolPath(new URL(key.url).pathname))
            .map((key) => cache.delete(key)),
        );
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data as
    | { type?: string; userId?: string | null }
    | undefined;
  if (!data || data.type !== "AUTH_CHANGED") return;

  const nextUserId = data.userId ?? "anon";
  if (nextUserId === currentUserId) return;

  currentUserId = nextUserId;

  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name === API_CACHE)
          .map((name) => caches.delete(name)),
      );
    })(),
  );
});

// PWA6 — show pushes sent by lib/push/webPush.ts and route clicks to the link.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload: { title?: string; body?: string; url?: string; tag?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "SiteOps", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "SiteOps", {
      body: payload.body ?? "",
      tag: payload.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url ?? "/app/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data as { url?: string } | undefined)?.url ??
    "/app/notifications";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Focus an existing tab if one is already open, else open a new one.
      const existing = allClients.find((client) => "focus" in client);
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: "PUSH_NAVIGATE", url: targetUrl });
        return;
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

serwist.addEventListeners();
