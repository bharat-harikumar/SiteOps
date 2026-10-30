import type { ClientResult } from "@/lib/http/client";

export type MovementActionName =
  | "send"
  | "receive"
  | "return"
  | "transfer"
  | "add"
  | "remove";

export function quantityError(
  raw: string,
  available: number,
  allowZero = false,
): string | null {
  if (!/^\d+$/.test(raw)) return "Enter a whole number.";
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1))
    return allowZero ? "Enter 0 or more." : "Enter at least 1.";
  if (value > Math.min(available, 1_000_000))
    return `Only ${Math.min(available, 1_000_000)} available.`;
  return null;
}

export function movementOutcome(
  result: ClientResult<{ status?: string }>,
): "saved" | "review" | "unknown" | "error" {
  if (result.ok) return result.data.status === "ok" ? "saved" : "review";
  if (result.kind === "network_error" || (result.status ?? 0) >= 500)
    return "unknown";
  return result.status === 409 || result.status === 400 ? "review" : "error";
}

export function movementSentence(
  action: MovementActionName,
  name: string,
  quantity: number,
  from: string,
  to: string,
): string {
  const verb = {
    send: "Send",
    receive: "Receive",
    return: "Return",
    transfer: "Transfer",
    add: "Add",
    remove: "Remove",
  }[action];
  if (action === "add") return `Add ${quantity} × ${name} to Godown.`;
  if (action === "remove")
    return `Remove ${quantity} × ${name} from Godown stock.`;
  return `${verb} ${quantity} × ${name} from ${from} to ${to}.`;
}
