"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ModalShell } from "@/components/ui/motion";
import type { ClientResult } from "@/lib/http/client";
import { friendlyErrorMessage } from "@/lib/ui/toastMessages";
import {
  movementOutcome,
  movementSentence,
  quantityError,
  type MovementActionName,
} from "./movementFormState";

export type MovementOperation = { action: MovementActionName; toolId?: string };
export type MovementToolChoice = {
  toolId: string;
  name: string;
  version: number;
  available: number;
};
export type MovementDraft = {
  toolId: string;
  expectedVersion: number;
  quantity: number;
  targetSiteId: string;
  note?: string;
};
export type MovementSaveResult = ClientResult<{ status?: string }> & {
  refreshFailed?: boolean;
};
const TITLES: Record<MovementActionName, string> = {
  send: "Send to site",
  receive: "Receive from godown",
  return: "Return to godown",
  transfer: "Transfer to another site",
  add: "Add stock",
  remove: "Remove damaged / lost stock",
};
const VERBS: Record<MovementActionName, string> = {
  send: "Send",
  receive: "Receive",
  return: "Return",
  transfer: "Transfer",
  add: "Add",
  remove: "Remove",
};

export function ToolMovementForm({
  operation,
  tools,
  sites,
  siteName = "This site",
  loading = false,
  error = false,
  onRetry,
  onSubmit,
  onRefresh,
  onClose,
}: {
  operation: MovementOperation | null;
  tools: MovementToolChoice[];
  sites: { siteId: string; name: string }[];
  siteName?: string;
  loading?: boolean;
  error?: boolean;
  onRetry: () => void;
  onSubmit: (draft: MovementDraft) => Promise<MovementSaveResult>;
  onRefresh: () => Promise<boolean>;
  onClose: () => void;
}) {
  const id = useId();
  const [selectedId, setSelectedId] = useState("");
  const [reviewed, setReviewed] = useState<{
    toolId: string;
    version: number;
  } | null>(null);
  const [targetId, setTargetId] = useState("");
  const [rawQty, setRawQty] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const [reviewReady, setReviewReady] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const latch = useRef(false);
  const session = useRef({ operation, id: 0 });
  if (session.current.operation !== operation) {
    session.current = { operation, id: session.current.id + 1 };
  }
  const openingId = session.current.id;
  const action = operation?.action ?? "send";
  const selected = tools.find(
    (tool) => tool.toolId === (operation?.toolId || selectedId),
  );
  const reviewedVersion =
    reviewed?.toolId === selected?.toolId
      ? reviewed?.version
      : selected?.version;
  const changed = selected && reviewedVersion !== selected.version;
  const pickDestination = action === "send" || action === "transfer";
  const target = sites.find((site) => site.siteId === targetId);
  const from =
    action === "return" || action === "transfer" ? siteName : "Godown";
  const to = pickDestination
    ? (target?.name ?? "Select a site")
    : action === "receive"
      ? siteName
      : "Godown";
  const qtyError = quantityError(rawQty, selected?.available ?? 0);
  const sentence = selected
    ? movementSentence(action, selected.name, Number(rawQty) || 0, from, to)
    : "";

  useEffect(() => {
    setSelectedId(operation?.toolId ?? "");
    const tool = tools.find((item) => item.toolId === operation?.toolId);
    setReviewed(tool ? { toolId: tool.toolId, version: tool.version } : null);
    setTargetId("");
    setRawQty("1");
    setNote("");
    setMessage("");
    setNeedsReview(false);
    setReviewReady(false);
    setUncertain(false);
    setRefreshing(false);
    // Freeze the reviewed version for this action; a background refresh must
    // not silently turn the user's old intent into a new one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingId]);

  async function refresh(requestSession = session.current.id) {
    setRefreshing(true);
    try {
      const ok = await onRefresh();
      if (!ok && session.current.id === requestSession)
        setMessage("Couldn't refresh stock. Try checking again before saving.");
      return ok;
    } catch {
      if (session.current.id === requestSession)
        setMessage("Couldn't refresh stock. Try checking again before saving.");
      return false;
    } finally {
      if (session.current.id === requestSession) setRefreshing(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      latch.current ||
      !selected ||
      qtyError ||
      (pickDestination && !target) ||
      needsReview ||
      changed ||
      uncertain ||
      reviewedVersion === undefined
    )
      return;
    latch.current = true;
    const requestSession = session.current.id;
    setBusy(true);
    setMessage("");
    try {
      const result = await onSubmit({
        toolId: selected.toolId,
        expectedVersion: reviewedVersion,
        quantity: Number(rawQty),
        targetSiteId: targetId,
        note: note.trim() || undefined,
      });
      const outcome = movementOutcome(result);
      if (session.current.id !== requestSession) {
        if (outcome === "saved") toast.success(sentence);
        else
          toast.warning(
            "Check stock and history to confirm your previous movement.",
          );
        return;
      }
      if (outcome === "saved") {
        toast.success(sentence);
        if (result.refreshFailed)
          toast.warning(
            "Saved; couldn't refresh the latest stock. Refresh before your next movement.",
          );
        onClose();
      } else if (outcome === "unknown") {
        setUncertain(true);
        setMessage(
          "We couldn't confirm the result. Check the latest stock and history before trying again.",
        );
      } else if (outcome === "review") {
        setNeedsReview(true);
        setMessage(
          result.ok
            ? "Stock changed. Review the latest quantity before saving."
            : friendlyErrorMessage(result.code, result.message),
        );
        const fresh = await refresh(requestSession);
        if (session.current.id === requestSession) setReviewReady(fresh);
      } else {
        setMessage(
          result.ok
            ? "Couldn't save this movement."
            : friendlyErrorMessage(result.code, result.message),
        );
      }
    } catch {
      if (session.current.id === requestSession) {
        setUncertain(true);
        setMessage(
          "We couldn't confirm the result. Check the latest stock and history before trying again.",
        );
      } else
        toast.warning(
          "Check stock and history to confirm your previous movement.",
        );
    } finally {
      latch.current = false;
      setBusy(false);
    }
  }

  return (
    <ModalShell
      open={operation !== null}
      onClose={onClose}
      ariaLabelledBy={`${id}-title`}
      overlayClassName="fixed inset-0 z-[var(--z-overlay)] flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4"
      className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
    >
      <header className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-bold text-white">
            {TITLES[action]}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {action === "add" || action === "remove"
              ? "Company godown"
              : `${from} → ${to}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close movement"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-300 hover:bg-white/5"
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      <form
        onSubmit={(event) => void submit(event)}
        className="overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        {loading ? (
          <p role="status" className="py-4 text-sm text-slate-400">
            Loading available tools…
          </p>
        ) : error ? (
          <div role="alert" className="text-sm text-slate-300">
            <p>Couldn't load the latest choices.</p>
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 font-semibold text-blue-400"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {operation?.toolId ? (
              <p className="break-words text-base font-semibold text-white">
                {selected?.name ?? "This tool is no longer available here."}
              </p>
            ) : (
              <label
                className="block text-sm font-medium text-slate-300"
                htmlFor={`${id}-tool`}
              >
                Tool
                <select
                  id={`${id}-tool`}
                  value={selectedId}
                  disabled={busy || uncertain}
                  onChange={(event) => {
                    const tool = tools.find(
                      (item) => item.toolId === event.target.value,
                    );
                    setSelectedId(event.target.value);
                    setReviewed(
                      tool
                        ? { toolId: tool.toolId, version: tool.version }
                        : null,
                    );
                    setNeedsReview(false);
                    setMessage("");
                  }}
                  className="input-standard mt-2 min-h-11 text-base"
                >
                  <option value="">Select a tool</option>
                  {tools.map((tool) => (
                    <option key={tool.toolId} value={tool.toolId}>
                      {tool.name} · {tool.available} available
                    </option>
                  ))}
                </select>
              </label>
            )}
            {tools.length === 0 ? (
              <p className="text-sm text-slate-400">
                No tools available in godown.
              </p>
            ) : null}
            {pickDestination ? (
              <label
                className="block text-sm font-medium text-slate-300"
                htmlFor={`${id}-site`}
              >
                Destination site
                <select
                  id={`${id}-site`}
                  value={targetId}
                  disabled={busy || uncertain}
                  onChange={(event) => setTargetId(event.target.value)}
                  className="input-standard mt-2 min-h-11 text-base"
                >
                  <option value="">Select a site</option>
                  {sites.map((site) => (
                    <option key={site.siteId} value={site.siteId}>
                      {site.name}
                    </option>
                  ))}
                </select>
                {sites.length === 0 ? (
                  <span className="mt-2 block text-sm text-slate-400">
                    No other available sites to transfer to.
                  </span>
                ) : null}
              </label>
            ) : null}
            {selected ? (
              <div>
                <label
                  htmlFor={`${id}-qty`}
                  className="text-sm font-medium text-slate-300"
                >
                  Quantity{" "}
                  <span className="font-normal text-slate-400">
                    · {selected.available} available
                    {action === "add" ? " to add" : ""}
                  </span>
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={
                      busy ||
                      uncertain ||
                      !/^\d+$/.test(rawQty) ||
                      Number(rawQty) <= 1
                    }
                    onClick={() => setRawQty(String(Number(rawQty) - 1))}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 text-white disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    id={`${id}-qty`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={rawQty}
                    disabled={busy || uncertain}
                    onChange={(event) => setRawQty(event.target.value)}
                    aria-invalid={Boolean(qtyError)}
                    aria-describedby={`${id}-qty-error`}
                    className="input-standard h-12 min-w-0 text-center text-base tabular-nums"
                  />
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    disabled={
                      busy ||
                      uncertain ||
                      !/^\d+$/.test(rawQty) ||
                      Number(rawQty) >= selected.available
                    }
                    onClick={() => setRawQty(String(Number(rawQty) + 1))}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 text-white disabled:opacity-30"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p
                  id={`${id}-qty-error`}
                  className="mt-2 min-h-5 text-sm text-rose-400"
                >
                  {qtyError}
                </p>
              </div>
            ) : null}
            <label
              className="block text-sm font-medium text-slate-300"
              htmlFor={`${id}-note`}
            >
              Note{" "}
              <span className="font-normal text-slate-400">(optional)</span>
              <textarea
                id={`${id}-note`}
                value={note}
                maxLength={500}
                disabled={busy || uncertain}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder="e.g. Sent with the driver"
                className="input-standard mt-2 resize-y text-base"
              />
            </label>
            {message ? (
              <p
                role="alert"
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200"
              >
                {message}
              </p>
            ) : null}
            {(needsReview || changed) && !uncertain ? (
              <div className="text-sm text-amber-200">
                <p>Review the latest stock before saving this movement.</p>
                <button
                  type="button"
                  disabled={
                    busy ||
                    refreshing ||
                    !selected ||
                    (needsReview && !reviewReady)
                  }
                  onClick={() => {
                    if (!selected) return;
                    // Acknowledge exactly the balance currently displayed.
                    // Any subsequent change is still rejected by its version.
                    setReviewed({
                      toolId: selected.toolId,
                      version: selected.version,
                    });
                    setNeedsReview(false);
                    setMessage("");
                  }}
                  className="mt-2 min-h-11 rounded-lg border border-amber-500/30 px-3 font-semibold disabled:opacity-40"
                >
                  {refreshing ? "Refreshing…" : "Review updated stock"}
                </button>
                {needsReview && !reviewReady ? (
                  <button
                    type="button"
                    disabled={busy || refreshing}
                    onClick={async () => {
                      const requestSession = session.current.id;
                      const ok = await refresh(requestSession);
                      if (session.current.id === requestSession)
                        setReviewReady(ok);
                    }}
                    className="min-h-11 px-3 text-sm font-semibold text-blue-400"
                  >
                    Refresh stock
                  </button>
                ) : null}
              </div>
            ) : null}
            {uncertain ? (
              <div className="text-sm text-slate-300">
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() => void refresh()}
                  className="min-h-11 font-semibold text-blue-400"
                >
                  {refreshing ? "Checking…" : "Check latest stock"}
                </button>
                <p>
                  Close this form and check movement history before recording a
                  new movement.
                </p>
              </div>
            ) : null}
            {selected && !qtyError ? (
              <p className="break-words rounded-xl bg-white/5 p-3 text-sm leading-relaxed text-slate-300">
                {sentence}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={
                busy ||
                refreshing ||
                !selected ||
                Boolean(qtyError) ||
                (pickDestination && !target) ||
                needsReview ||
                Boolean(changed) ||
                uncertain
              }
              className="min-h-12 w-full break-words rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? "Saving…"
                : selected && !qtyError
                  ? `${VERBS[action]} ${Number(rawQty)} × ${selected.name}`
                  : TITLES[action]}
            </button>
          </div>
        )}
      </form>
    </ModalShell>
  );
}
