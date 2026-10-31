import type { ToolMovementBody } from "@/lib/validation/toolSchemas";
import type { MovementKind } from "./types";
type WithoutVersion<T> = T extends unknown ? Omit<T, "expectedVersion"> : never;
export type MovementAction = WithoutVersion<ToolMovementBody>;
export type SiteToolItem = {
  toolId: string;
  name: string;
  categoryName: string;
  quantityHere: number;
  version: number;
};
export type SiteToolsData = {
  site: {
    siteId: string;
    name: string;
  };
  items: SiteToolItem[];
  itemCount: number;
  toolTypeCount: number;
};
export type ReceiveToolOption = {
  toolId: string;
  name: string;
  categoryName: string;
  availableInGodown: number;
  version: number;
};
export type SiteToolMove = {
  toolId: string;
  expectedVersion: number;
  quantity: number;
  note?: string;
} & ({
  kind: "receive";
} | {
  kind: "return";
} | {
  kind: "transfer";
  targetSiteId: string;
});
export type SiteToolMoveResult = {
  status: "ok";
  toolId: string;
  version: number;
  quantityHere: number;
};
export type SiteToolMovement = {
  movementId: string;
  toolName: string;
  kind: MovementKind;
  quantity: number;
  from: {
    label: string;
    href: string | null;
  };
  to: {
    label: string;
    href: string | null;
  };
  actorName: string;
  createdAt: string;
  note: string | null;
};
