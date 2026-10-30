import { expect, test } from "@playwright/test";

test("production worker bypasses old tool caches online and offline", async ({
  page,
  context,
}) => {
  await page.goto("/auth/sign-in");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.evaluate(async () => {
    const cache = await caches.open("siteops-api-v1");
    for (const path of [
      "/api/tools",
      "/api/sites/00000000-0000-4000-8000-000000000001/tools",
    ]) {
      const url = new URL(path, location.origin);
      url.searchParams.set("_u", "anon");
      await cache.put(
        url,
        new Response(
          JSON.stringify({ success: true, data: { staleInventory: true } }),
          { headers: { "content-type": "application/json" } },
        ),
      );
    }
  });
  const online = await page.evaluate(async () => {
    const response = await fetch("/api/tools");
    return { status: response.status, body: await response.json() };
  });
  expect(online.status).toBe(401);
  expect(online.body.success).toBe(false);
  expect(online.body.data?.staleInventory).not.toBe(true);
  await context.setOffline(true);
  const offline = await page.evaluate(async () => {
    try {
      const response = await fetch("/api/tools");
      return { served: true, body: await response.text() };
    } catch {
      return { served: false };
    }
  });
  expect(offline.served).toBe(false);
  await context.setOffline(false);
});
