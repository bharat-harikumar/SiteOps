"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { ModalShell } from "@/components/ui/motion";
import { useToolMovements, useToolMutations } from "@/lib/client/tools";
import { confirmDialog } from "@/lib/ui/confirm";
import { notifyError } from "@/lib/ui/toast";
import type { MovementKind } from "@/lib/tools/types";
import { ToolHistory } from "./ToolHistory";

export function ToolLedgerDrawer({
  toolId,
  toolName,
  onClose,
  siteName,
  allowClear = true,
}: {
  toolId: string | null;
  toolName: string;
  onClose: () => void;
  siteName: (id: string) => string;
  allowClear?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [clearing, setClearing] = useState(false);
  const { data: result, isLoading, mutate } = useToolMovements(toolId, offset);
  const { clearMovements } = useToolMutations();
  useEffect(() => {
    setOffset(0);
  }, [toolId]);
  const location = (id: string) => ({
    label:
      id === "WAREHOUSE"
        ? "Godown"
        : id === "EXTERNAL"
          ? "Supplier / external"
          : siteName(id),
    href: null,
  });
  const movements = result?.ok
    ? result.data.movements.map((m) => ({
        movementId: m.movementId,
        toolName,
        kind: m.kind as MovementKind,
        quantity: m.quantity,
        from: location(m.fromLocation),
        to: location(m.toLocation),
        actorName: m.actorName ?? "Team member",
        createdAt: m.createdAt,
        note: m.note,
      }))
    : [];
  async function clear() {
    if (!toolId || clearing) return;
    const confirmed = await confirmDialog({
      title: "Clear movement history?",
      message: `Permanently clear the recorded movement history for ${toolName}?`,
      confirmLabel: "Clear history",
      cancelLabel: "Cancel",
      tone: "danger",
    });
    if (!confirmed) return;
    setClearing(true);
    try {
      const res = await clearMovements(toolId);
      if (!res.ok) {
        notifyError(res);
        return;
      }
      toast.success("Movement history cleared.");
      setOffset(0);
    } finally {
      setClearing(false);
    }
  }
  return (
    <ModalShell
      open={toolId !== null}
      onClose={onClose}
      ariaLabelledBy="tool-history-title"
      overlayClassName="fixed inset-0 z-[var(--z-overlay)] flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4"
      className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
    >
      <header className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
        <div className="min-w-0">
          <p className="text-sm text-slate-400">Movement history</p>
          <h2
            id="tool-history-title"
            className="mt-1 break-words text-lg font-semibold text-white"
          >
            {toolName}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close history"
          onClick={onClose}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-300 hover:bg-white/5"
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="overflow-y-auto overscroll-contain p-5">
        <ToolHistory
          movements={movements}
          loading={isLoading && !result}
          error={Boolean(result && !result.ok)}
          onRetry={() => void mutate()}
          offset={offset}
          onPage={setOffset}
        />
        {allowClear && movements.length > 0 ? (
          <button
            type="button"
            disabled={clearing}
            onClick={() => void clear()}
            className="mt-5 min-h-11 rounded-xl border border-rose-500/30 px-3 text-sm font-semibold text-rose-400 disabled:opacity-40"
          >
            {clearing ? "Clearing…" : "Clear history"}
          </button>
        ) : null}
      </div>
    </ModalShell>
  );
}
