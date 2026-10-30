"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";

import { requestJson, type ClientResult } from "@/lib/http/client";
import { useApiResult } from "@/lib/http/useApiQuery";
import type {
  AssignmentInput,
  InvalidReason,
  ToolResultStatus,
} from "@/lib/tools/types";
import type { ToolMovementBody } from "@/lib/validation/toolSchemas";
import type {
  ReceiveToolOption,
  SiteToolsData,
  SiteToolMove,
  SiteToolMoveResult,
  SiteToolMovement,
} from "@/lib/tools/contracts";

export function isToolDataKey(key: unknown): boolean {
  return (
    typeof key === "string" &&
    (/^\/api\/tools(?:[/?]|$)/.test(key) ||
      /^\/api\/sites\/[^/?]+\/tools(?:[/?]|$)/.test(key))
  );
}

export function useSiteTools(siteId: string) {
  return useApiResult<SiteToolsData>(
    `/api/sites/${encodeURIComponent(siteId)}/tools`,
  );
}

export function useSiteToolReceiveOptions(siteId: string | null, query = "") {
  return useApiResult<{ tools: ReceiveToolOption[] }>(
    siteId
      ? `/api/sites/${encodeURIComponent(siteId)}/tools/receive-options?q=${encodeURIComponent(query.trim().slice(0, 120))}`
      : null,
  );
}

export function useSiteToolMovements(siteId: string | null, offset = 0) {
  return useApiResult<{
    movements: SiteToolMovement[];
    limit: number;
    offset: number;
  }>(
    siteId
      ? `/api/sites/${encodeURIComponent(siteId)}/tools/movements?limit=50&offset=${offset}`
      : null,
  );
}

// ── Client-facing DTOs (mirror the API envelopes; no server deps) ────────────
export type ToolDTO = {
  toolId: string;
  name: string;
  code: string;
  categoryId: string;
  totalQuantity: number;
  icon: string | null;
  version: number;
  free: number;
  assignments: AssignmentInput[];
};

export type ToolCategoryDTO = {
  categoryId: string;
  name: string;
  codePrefix: string;
  isActive: boolean;
  sortOrder: number;
};

export type MovementDTO = {
  movementId: string;
  toolId: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  kind: string;
  note: string | null;
  actorUserId: string | null;
  actorName?: string;
  createdAt: string;
};

export type ToolDashboardDTO = {
  totalTools: number;
  totalQuantity: number;
  deployed: number;
  free: number;
  perCategory: {
    categoryId: string;
    name: string;
    codePrefix: string;
    toolCount: number;
    totalQuantity: number;
  }[];
  perSite: { siteId: string; toolTypes: number; totalQuantity: number }[];
};

export type BatchToolPayload = {
  toolId: string;
  version: number;
  totalQuantity?: number;
  assignments?: AssignmentInput[];
};

export type BatchResult = {
  toolId: string;
  status: ToolResultStatus;
  reason?: InvalidReason;
  tool: ToolDTO;
};

// ── Query hooks (SWR, envelope-preserving) ───────────────────────────────────
const TOOLS_KEY = "/api/tools";

export function useTools(q?: string) {
  const key =
    q && q.trim()
      ? `${TOOLS_KEY}?q=${encodeURIComponent(q.trim())}`
      : TOOLS_KEY;
  return useApiResult<{ tools: ToolDTO[] }>(key);
}

export function useToolDashboard() {
  return useApiResult<ToolDashboardDTO>("/api/tools/dashboard");
}

export function useToolCategories() {
  return useApiResult<{ categories: ToolCategoryDTO[] }>(
    "/api/tools/categories",
  );
}

// toolId → per-tool ledger; null skips (conditional fetch).
export function useToolMovements(toolId: string | null, offset = 0) {
  return useApiResult<{ movements: MovementDTO[] }>(
    toolId ? `/api/tools/${toolId}/movements?limit=50&offset=${offset}` : null,
  );
}

// Merge partial-apply results back into a tools list: every returned tool (ok,
// conflict OR invalid) carries fresh server state, so conflict/invalid tools
// re-render with server values (§6, §11).
export function reconcileTools(
  current: ToolDTO[],
  results: BatchResult[],
): ToolDTO[] {
  const fresh = new Map(results.map((r) => [r.toolId, r.tool]));
  return current.map((t) => fresh.get(t.toolId) ?? t);
}

// ── Mutations ────────────────────────────────────────────────────────────────
export function useToolMutations() {
  const { mutate } = useSWRConfig();
  const revalidateTools = useCallback(async () => {
    const results = await mutate(isToolDataKey);
    return results.every(
      (result: ClientResult<unknown> | undefined) => !result || result.ok,
    );
  }, [mutate]);

  const saveBatch = useCallback(
    async (
      payload: BatchToolPayload[],
    ): Promise<ClientResult<{ results: BatchResult[] }>> => {
      const res = await requestJson<{ results: BatchResult[] }>(
        "/api/tools/batch-save",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tools: payload }),
        },
      );
      if (res.ok) revalidateTools();
      return res;
    },
    [revalidateTools],
  );

  const createTool = useCallback(
    async (body: {
      name: string;
      categoryId: string;
      icon?: string | null;
      openingStock?: number;
    }) => {
      const res = await requestJson<ToolDTO>("/api/tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) revalidateTools();
      return res;
    },
    [revalidateTools],
  );

  const patchTool = useCallback(
    async (
      toolId: string,
      body: { name?: string; categoryId?: string; icon?: string | null },
    ) => {
      const res = await requestJson<ToolDTO>(`/api/tools/${toolId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) revalidateTools();
      return res;
    },
    [revalidateTools],
  );

  const deleteTool = useCallback(
    async (toolId: string, force = false) => {
      const res = await requestJson<null>(
        `/api/tools/${toolId}${force ? "?force=true" : ""}`,
        { method: "DELETE" },
      );
      if (res.ok) revalidateTools();
      return res;
    },
    [revalidateTools],
  );

  const createCategory = useCallback(
    async (body: { name: string; codePrefix: string; sortOrder?: number }) => {
      const res = await requestJson<ToolCategoryDTO>("/api/tools/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) revalidateTools();
      return res;
    },
    [revalidateTools],
  );

  const updateCategory = useCallback(
    async (
      categoryId: string,
      body: {
        name?: string;
        codePrefix?: string;
        isActive?: boolean;
        sortOrder?: number;
      },
    ) => {
      const res = await requestJson<ToolCategoryDTO>(
        `/api/tools/categories/${categoryId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) revalidateTools();
      return res;
    },
    [revalidateTools],
  );

  const clearMovements = useCallback(
    async (toolId: string) => {
      const res = await requestJson<{ deleted: number }>(
        `/api/tools/${toolId}/movements`,
        { method: "DELETE" },
      );
      if (res.ok) revalidateTools();
      return res;
    },
    [revalidateTools],
  );

  const moveTool = useCallback(
    async (toolId: string, body: ToolMovementBody) => {
      const res = await requestJson<{ status: string; tool: ToolDTO }>(
        `/api/tools/${toolId}/move`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      let refreshFailed = false;
      if (res.ok || (!res.ok && (res.status === 400 || res.status === 409))) {
        try {
          refreshFailed = !(await revalidateTools());
        } catch {
          refreshFailed = true;
        }
      }
      return { ...res, refreshFailed };
    },
    [revalidateTools],
  );

  const moveSiteTool = useCallback(
    async (siteId: string, body: SiteToolMove) => {
      const res = await requestJson<SiteToolMoveResult>(
        `/api/sites/${encodeURIComponent(siteId)}/tools`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      let refreshFailed = false;
      if (res.ok || (!res.ok && (res.status === 400 || res.status === 409))) {
        try {
          refreshFailed = !(await revalidateTools());
        } catch {
          refreshFailed = true;
        }
      }
      return { ...res, refreshFailed };
    },
    [revalidateTools],
  );

  return {
    saveBatch,
    createTool,
    patchTool,
    deleteTool,
    createCategory,
    updateCategory,
    clearMovements,
    moveTool,
    moveSiteTool,
    revalidateTools,
  };
}
