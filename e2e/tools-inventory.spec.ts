import { test, expect } from "./fixtures/tools";

test("supervisors can reach only their site tools and owned destinations", async ({
  page,
  tools,
}) => {
  await page.goto(`/app/sites/${tools.source}/tools`);
  await expect(
    page.getByRole("heading", { name: "Tools", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/tools")).status()).toBe(403);
  expect(
    (await page.request.get(`/api/sites/${tools.foreign}/tools`)).status(),
  ).toBe(403);
  const rejected = await page.request.post(`/api/sites/${tools.source}/tools`, {
    data: {
      kind: "transfer",
      toolId: tools.toolId,
      expectedVersion: 0,
      quantity: 1,
      targetSiteId: tools.foreign,
    },
  });
  expect(rejected.status()).toBe(403);
  const response = await page.request.get(`/api/sites/${tools.source}/tools`);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const body = await response.json();
  expect(body.data.items[0]).toEqual({
    toolId: tools.toolId,
    name: tools.toolName,
    categoryName: expect.any(String),
    quantityHere: 2,
    version: 0,
  });
});

test("partial and full returns refresh counts and retain movement history", async ({
  page,
  tools,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/app/sites/${tools.source}/tools`);
  await page
    .getByRole("button", { name: "Return to godown", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: /Quantity/ }).fill("5");
  await expect(dialog.getByText("Only 2 available.")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Return to godown", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("textbox", { name: /Quantity/ }).fill("1");
  await dialog
    .getByRole("button", { name: `Return 1 × ${tools.toolName}`, exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("1 here", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Return to godown", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: `Return 1 × ${tools.toolName}`, exact: true })
    .click();
  await expect(
    page.getByText("No tools at this site", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Movement history", exact: true })
    .click();
  await expect(
    page.getByText("Returned to godown", { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByText("Anil Test", { exact: false }).first(),
  ).toBeVisible();
});

test("receive and transfer preselect the current site", async ({
  page,
  tools,
}) => {
  await page.goto(`/app/sites/${tools.source}/tools`);
  await page
    .getByRole("button", { name: "Receive from godown", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Tool", exact: true })
    .selectOption(tools.toolId);
  await dialog
    .getByRole("button", { name: `Receive 1 × ${tools.toolName}`, exact: true })
    .click();
  await expect(page.getByText("3 here", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Transfer", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Destination site", exact: true })
    .selectOption(tools.target);
  await expect(
    dialog
      .getByRole("combobox", { name: "Destination site", exact: true })
      .locator("option"),
  ).toHaveCount(2);
  await dialog
    .getByRole("button", {
      name: `Transfer 1 × ${tools.toolName}`,
      exact: true,
    })
    .click();
  await expect(page.getByText("2 here", { exact: true })).toBeVisible();
  await page.goto(`/app/sites/${tools.target}/tools`);
  await expect(page.getByText("1 here", { exact: true })).toBeVisible();
});

test("conflict preserves input and requires explicit review", async ({
  page,
  tools,
}) => {
  await page.goto(`/app/sites/${tools.source}/tools`);
  await page
    .getByRole("button", { name: "Return to godown", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: /Quantity/ }).fill("2");
  const moved = await page.request.post(`/api/sites/${tools.source}/tools`, {
    data: {
      kind: "receive",
      toolId: tools.toolId,
      expectedVersion: 0,
      quantity: 1,
    },
  });
  expect(moved.status()).toBe(200);
  await dialog
    .getByRole("button", { name: `Return 2 × ${tools.toolName}`, exact: true })
    .click();
  await expect(dialog.getByRole("textbox", { name: /Quantity/ })).toHaveValue(
    "2",
  );
  await expect(
    dialog.getByRole("button", { name: "Review updated stock" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Review updated stock" }).click();
  await expect(
    dialog.getByRole("button", {
      name: `Return 2 × ${tools.toolName}`,
      exact: true,
    }),
  ).toBeEnabled();
});

test("an older pending save cannot close a newly opened movement", async ({
  page,
  tools,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let committed!: () => void;
  const commit = new Promise<void>((resolve) => (committed = resolve));
  await page.route(`**/api/sites/${tools.source}/tools`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    committed();
    await gate;
    await route.fulfill({ response });
  });
  await page.goto(`/app/sites/${tools.source}/tools`);
  await page
    .getByRole("button", { name: "Return to godown", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: `Return 1 × ${tools.toolName}`, exact: true })
    .click();
  await commit;
  await page
    .getByRole("button", { name: "Close movement", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Receive from godown", exact: true })
    .click();
  release();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Receive from godown", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("combobox", { name: "Tool", exact: true }),
  ).toHaveValue("");
});

test("company overview is readable on a narrow phone and links to site stock", async ({
  page,
  tools,
}) => {
  await tools.asAdmin();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/app/tools");
  await expect(
    page.getByRole("heading", { name: "Company Tools" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New tool type", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("items total", { exact: false })).toBeVisible();
  await page.getByLabel("Search company tools").fill(tools.toolName);
  await page.getByText("Locations & stock actions", { exact: true }).click();
  await expect(
    page.locator(`a[href="/app/sites/${tools.source}/tools"]`),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/siteops-tools-browser-results/company-mobile.png",
    fullPage: true,
  });
});

test('a lost response never automatically replays a committed movement', async ({ page, tools }) => {
  await page.route(`**/api/sites/${tools.source}/tools`, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fetch();
    await route.abort('failed');
  });
  await page.goto(`/app/sites/${tools.source}/tools`);
  await page.getByRole('button', { name: 'Return to godown', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: `Return 1 × ${tools.toolName}`, exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText("We couldn't confirm the result.");
  await expect(dialog.getByRole('button', { name: `Return 1 × ${tools.toolName}`, exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Check latest stock', exact: true }).click();
  const response = await page.request.get(`/api/sites/${tools.source}/tools`);
  expect((await response.json()).data.items[0]).toMatchObject({ quantityHere: 1, version: 1 });
  await dialog.getByRole('button', { name: 'Close movement', exact: true }).click();
  await page.getByRole('button', { name: 'Movement history', exact: true }).click();
  await expect(page.getByText('Returned to godown', { exact: true })).toHaveCount(1);
});

test('failed categories can be retried without leaving the new-tool dialog', async ({ page, tools }) => {
  await tools.asAdmin();
  let fail = true;
  await page.route('**/api/tools/categories', route => fail ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } }) }) : route.continue());
  await page.goto('/app/tools');
  await page.getByRole('button', { name: 'New tool type', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New tool type', exact: true });
  await expect(dialog.getByRole('button', { name: 'Retry categories', exact: true })).toBeVisible();
  fail = false;
  await dialog.getByRole('button', { name: 'Retry categories', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'Category', exact: true })).toBeEnabled();
});

test('escape returns focus to the site action', async ({ page, tools }) => {
  await page.goto(`/app/sites/${tools.source}/tools`);
  const opener = page.getByRole('button', { name: 'Return to godown', exact: true });
  await opener.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('long tool names stay inside the movement form on a phone', async ({ page, tools }) => {
  await tools.asAdmin();
  const name = 'W'.repeat(120);
  expect((await page.request.patch(`/api/tools/${tools.toolId}`, { data: { name } })).status()).toBe(200);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/app/sites/${tools.source}/tools`);
  await page.getByRole('button', { name: 'Return to godown', exact: true }).click();
  const submit = page.getByRole('dialog').getByRole('button', { name: `Return 1 × ${name}`, exact: true });
  expect(await submit.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/siteops-tools-artifacts/site-movement-mobile.png' });
});
