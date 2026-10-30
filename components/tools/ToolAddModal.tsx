"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { ModalShell } from "@/components/ui/motion";
import { useToolMutations, type ToolCategoryDTO } from "@/lib/client/tools";
import { notifyError } from "@/lib/ui/toast";
import { quantityError } from "./movementFormState";

// Add-tool flow lifted out of the inline toolbar into a focused modal, mirroring
// CatalogAddModal. Same validation/behaviour as the old inline form.
export function ToolAddModal({
  open,
  onClose,
  categories,
  onCreated,
  categoriesLoading = false,
  categoriesError = false,
  onRetryCategories,
}: {
  open: boolean;
  onClose: () => void;
  categories: ToolCategoryDTO[];
  onCreated: () => Promise<unknown> | void;
  categoriesLoading?: boolean;
  categoriesError?: boolean;
  onRetryCategories?: () => void;
}) {
  const id = useId();
  const { createTool } = useToolMutations();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [opening, setOpening] = useState("");
  const [busy, setBusy] = useState(false);
  const openingError =
    opening === "" ? null : quantityError(opening, 1_000_000, true);

  function reset() {
    setName("");
    setCategoryId("");
    setOpening("");
  }

  function close() {
    reset();
    onClose();
  }

  async function create() {
    const n = name.trim();
    if (
      !n ||
      !categoryId ||
      openingError ||
      busy ||
      categoriesError ||
      categoriesLoading
    )
      return;
    const openingStock = opening === "" ? 0 : Number(opening);
    setBusy(true);
    const res = await createTool({ name: n, categoryId, openingStock });
    setBusy(false);
    if (!res.ok) return notifyError(res);
    toast.success(`Created tool type "${res.data.name}".`);
    await onCreated();
    close();
  }

  return (
    <ModalShell
      open={open}
      onClose={close}
      ariaLabelledBy={`${id}-title`}
      overlayClassName="fixed inset-0 z-[var(--z-overlay)] flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4"
      className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"
    >
      <div className="space-y-3.5">
        <h3 id={`${id}-title`} className="text-base font-bold text-white">
          New tool type
        </h3>

        <label className="flex flex-col gap-1.5 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
          Name
          <input
            autoFocus
            type="text"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Manvatti"
            className="h-12 w-full rounded-xl border border-outline px-3 text-base normal-case text-on-surface"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
          Category
          <select
            value={categoryId}
            disabled={categoriesLoading || categoriesError}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-12 w-full cursor-pointer rounded-xl border border-outline px-3 text-base text-on-surface"
          >
            <option value="">Select…</option>
            {categories
              .filter((c) => c.isActive)
              .map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>

        {categoriesLoading ? (
          <p role="status" className="text-sm text-slate-400">
            Loading categories…
          </p>
        ) : categoriesError ? (
          <div role="alert" className="text-sm text-slate-300">
            <p>Couldn't load tool categories.</p>
            <button
              type="button"
              onClick={onRetryCategories}
              className="min-h-11 font-semibold text-blue-400"
            >
              Retry categories
            </button>
          </div>
        ) : !categories.some((category) => category.isActive) ? (
          <p className="text-sm text-slate-400">
            Create an active category in the{" "}
            <Link
              href="/app/admin/catalog?tab=tools"
              className="font-semibold text-blue-400 underline"
            >
              tool catalog
            </Link>{" "}
            first.
          </p>
        ) : null}

        <label className="flex flex-col gap-1.5 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
          Initial quantity in godown
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-invalid={Boolean(openingError)}
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="0"
            className="h-12 w-full rounded-xl border border-outline px-3 text-base text-on-surface"
          />
        </label>

        {openingError ? (
          <p role="alert" className="text-sm text-rose-400">
            {openingError}
          </p>
        ) : null}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={
              !name.trim() ||
              !categoryId ||
              Boolean(openingError) ||
              busy ||
              categoriesLoading ||
              categoriesError
            }
            onClick={() => void create()}
            className="flex-1 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-bold uppercase text-on-primary transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Create tool type"}
          </button>
          <button
            type="button"
            onClick={close}
            className="cursor-pointer rounded-xl border border-outline px-4 py-2.5 text-sm font-semibold uppercase text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
