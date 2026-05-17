import type { FabricObject } from "fabric";

/** Custom metadata stored on every Fabric canvas object via .data */
export interface FabricObjectMeta {
  blockId?: string;
  blockType?: string;
  layoutObjectId?: string;
  layoutObjectType?: string;
  pageId?: string;
  shapeType?: string;
  fieldType?: string;
  isCommentIndicator?: boolean;
  isHighlight?: boolean;
  isOcrBadge?: boolean;
  isCursorOverlay?: boolean;
  commentIds?: string[];
  table_data?: TableData;
  noteFill?: string;
  textColor?: string;
  arrowHeadLength?: number;
  arrowHeadAngle?: number;
}

/** Fabric object augmented with typed .data metadata */
export type FabricObjectWithMeta = FabricObject & { data?: FabricObjectMeta };

/** Table block data shape */
export interface TableData {
  headers?: string[];
  rows?: string[][];
}

/** Fabric touch:gesture event wrapper */
export interface FabricGestureEvent {
  self?: {
    touches?: number;
    scale?: number;
  };
}

/** Fabric mouse:down / mouse:up event with native event accessor */
export interface FabricMouseEvent {
  e: MouseEvent | TouchEvent;
  target?: FabricObject;
}

/** Yjs awareness local state shape */
export interface AwarenessState {
  user?: {
    id?: string;
    name?: string;
    color?: string;
    selectedBlockId?: string | null;
  };
}

/** Minimal TipTap JSON output — only the parts we inspect */
export interface TipTapJSON {
  content?: Array<{ type?: string }>;
}
