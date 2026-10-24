// Pure helpers for the service worker's offline write outbox (app/sw.ts). Kept
// free of any import so the worker bundle stays small and the rules are testable.

export type ReplayOutcome = "synced" | "retry" | "rejected";

// What to do with a queued write after replaying it. Only a 2xx means the
// server saved it. Other 4xx mean the server read the request and refused it —
// a stale Work Stage (400), an archived site (404), a conflict (409) — so the
// payload will never succeed and retrying only hides the loss for 24 hours.
// Everything else (5xx, rate limits, an expired login, an unexpected redirect)
// may succeed later, so the entry is kept.
export function classifyReplayStatus(status: number): ReplayOutcome {
  if (status >= 200 && status < 300) return "synced";
  if (status === 401 || status === 408 || status === 425 || status === 429) return "retry";
  if (status >= 400 && status < 500) return "rejected";
  return "retry";
}

const WRITE_LABELS: Record<string, string> = {
  "/api/entries/material": "Material entry",
  "/api/entries/labour": "Labour entry",
  "/api/entries/machinery": "Machinery entry",
  "/api/entries/expenses": "Expense entry",
  "/api/entries/incidents": "Incident report",
  "/api/transfers": "Transfer",
};

// One line for the user about an offline write the server refused, naming what
// it was so they can enter it again.
export function describeRejectedWrite(input: {
  pathname: string;
  body: unknown;
  serverMessage: string | null;
}): string {
  const label = WRITE_LABELS[input.pathname] ?? "entry";
  const date = (input.body as { date?: unknown } | null)?.date;
  const when = typeof date === "string" && date ? ` for ${date}` : "";
  const reason = input.serverMessage ?? "the server rejected it";
  return `Offline ${label}${when} was not saved: ${reason}. Please enter it again.`;
}
