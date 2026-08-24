import { create } from "zustand";

import {
  addOpening,
  addRectangularRoom,
  addWall,
  layoutBounds,
  removeOpening,
  removeRoom,
  removeWall,
} from "@/lib/geometry/layout";
import { clamp } from "@/lib/geometry/vector";
import { emptyLayout, type Layout, type OpeningKind, type Point } from "@/lib/schemas/layout";

/**
 * State of the plan editor: the drawing being edited, what is selected, how the
 * canvas is framed and the undo stack.
 *
 * The layout is never mutated — every change goes through `apply`, which swaps
 * in a new object and pushes the previous one onto `past`. That is what makes
 * undo a one-liner instead of a diff engine.
 */

export type EditorTool = "select" | "wall" | "room" | "door" | "window" | "pan";

export type SelectionKind = "wall" | "room" | "opening";

export type Selection = { kind: SelectionKind; id: string } | null;

/** Where the canvas is looking: pan in screen pixels, `scale` px per centimetre. */
export type Camera = { x: number; y: number; scale: number };

/** A run of walls being drawn: the points already placed, plus the cursor. */
export type WallDraft = { points: Point[]; cursor: Point | null };

/** A room being dragged out as a box. */
export type RoomDraft = { from: Point; to: Point };

export const MIN_SCALE = 0.03;
export const MAX_SCALE = 3;

/** Snap steps offered in the toolbar, in centimetres. 0 = free hand. */
export const SNAP_STEPS = [0, 1, 5, 10, 25, 50] as const;

export const DEFAULT_SNAP_STEP = 10;

/** How many undo levels to keep. Deep enough to fix a mistake, not a leak. */
const HISTORY_LIMIT = 60;

const ROOM_NAME_PREFIX = "Ambiente";

type EditorState = {
  /** Which floor the drawing belongs to. `null` until `loadFloor` runs. */
  floorId: string | null;
  layout: Layout;
  past: Layout[];
  future: Layout[];
  /** Snapshot of the last saved layout, to tell whether there is work to save. */
  savedSignature: string;

  tool: EditorTool;
  selection: Selection;
  snapStep: number;
  orthoEnabled: boolean;
  showGrid: boolean;
  showRooms: boolean;

  camera: Camera;
  wallDraft: WallDraft | null;
  roomDraft: RoomDraft | null;

  loadFloor: (floorId: string, layout: Layout) => void;
  markSaved: (layout: Layout) => void;

  apply: (change: (layout: Layout) => Layout) => void;
  beginTransaction: () => void;
  updateLive: (change: (layout: Layout) => Layout) => void;
  undo: () => void;
  redo: () => void;

  setTool: (tool: EditorTool) => void;
  select: (selection: Selection) => void;
  deleteSelection: () => void;

  setSnapStep: (step: number) => void;
  toggleOrtho: () => void;
  toggleGrid: () => void;
  toggleRooms: () => void;

  setCamera: (camera: Camera) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (factor: number, screenPoint: Point) => void;
  fitToContent: (viewport: { width: number; height: number }) => void;

  beginWall: (point: Point) => void;
  moveWallCursor: (point: Point) => void;
  commitWallPoint: (point: Point) => void;
  endWall: () => void;

  beginRoom: (point: Point) => void;
  moveRoom: (point: Point) => void;
  commitRoom: () => void;

  placeOpening: (wallId: string, kind: OpeningKind, t: number) => void;
};

function signatureOf(layout: Layout): string {
  return JSON.stringify(layout);
}

/** "Ambiente 3": the first number nobody is using. */
function nextRoomName(layout: Layout): string {
  const used = new Set(
    layout.rooms
      .map((room) => room.name.match(/^Ambiente (\d+)$/)?.[1])
      .filter((value): value is string => value !== undefined)
      .map(Number),
  );

  let number = 1;
  while (used.has(number)) number += 1;

  return `${ROOM_NAME_PREFIX} ${number}`;
}

const INITIAL_CAMERA: Camera = { x: 0, y: 0, scale: 0.35 };

export const useEditorStore = create<EditorState>((set, get) => ({
  floorId: null,
  layout: emptyLayout(),
  past: [],
  future: [],
  savedSignature: signatureOf(emptyLayout()),

  tool: "select",
  selection: null,
  snapStep: DEFAULT_SNAP_STEP,
  orthoEnabled: true,
  showGrid: true,
  showRooms: true,

  camera: INITIAL_CAMERA,
  wallDraft: null,
  roomDraft: null,

  /**
   * Points the editor at a floor. Called on mount and whenever the route
   * changes, so opening a second floor never inherits the first one's history.
   */
  loadFloor: (floorId, layout) =>
    set({
      floorId,
      layout,
      past: [],
      future: [],
      savedSignature: signatureOf(layout),
      selection: null,
      wallDraft: null,
      roomDraft: null,
      tool: "select",
    }),

  /** After a successful save: what is on screen is now what is stored. */
  markSaved: (layout) => set({ savedSignature: signatureOf(layout) }),

  apply: (change) =>
    set((state) => {
      const next = change(state.layout);
      // A no-op (clicking where a wall cannot go) must not eat an undo slot.
      if (next === state.layout) return state;

      return {
        layout: next,
        past: [...state.past, state.layout].slice(-HISTORY_LIMIT),
        future: [],
      };
    }),

  /**
   * Opens a drag: the layout as it is right now becomes the undo point, and
   * every frame of the drag then goes through `updateLive`. Without this a
   * single drag would push one history entry per mouse move.
   */
  beginTransaction: () =>
    set((state) => ({
      past: [...state.past, state.layout].slice(-HISTORY_LIMIT),
      future: [],
    })),

  /** A change inside an open transaction: no history, no undo entry. */
  updateLive: (change) => set((state) => ({ layout: change(state.layout) })),

  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (previous === undefined) return state;

      return {
        layout: previous,
        past: state.past.slice(0, -1),
        future: [state.layout, ...state.future].slice(0, HISTORY_LIMIT),
        selection: null,
      };
    }),

  redo: () =>
    set((state) => {
      const [next, ...rest] = state.future;
      if (next === undefined) return state;

      return {
        layout: next,
        past: [...state.past, state.layout].slice(-HISTORY_LIMIT),
        future: rest,
        selection: null,
      };
    }),

  setTool: (tool) =>
    set({
      tool,
      // Switching tools abandons whatever was half-drawn: a dangling preview
      // that reappears three tools later is a bug people cannot explain.
      wallDraft: null,
      roomDraft: null,
      selection: tool === "select" ? get().selection : null,
    }),

  select: (selection) => set({ selection }),

  deleteSelection: () => {
    const { selection, apply } = get();
    if (selection === null) return;

    apply((layout) => {
      if (selection.kind === "wall") return removeWall(layout, selection.id);
      if (selection.kind === "room") return removeRoom(layout, selection.id);
      return removeOpening(layout, selection.id);
    });

    set({ selection: null });
  },

  setSnapStep: (snapStep) => set({ snapStep }),
  toggleOrtho: () => set((state) => ({ orthoEnabled: !state.orthoEnabled })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleRooms: () => set((state) => ({ showRooms: !state.showRooms })),

  setCamera: (camera) => set({ camera }),

  panBy: (dx, dy) =>
    set((state) => ({
      camera: { ...state.camera, x: state.camera.x + dx, y: state.camera.y + dy },
    })),

  /**
   * Zooms keeping the world point under the cursor pinned to it, which is the
   * only zoom that does not feel like the drawing ran away.
   */
  zoomAt: (factor, screenPoint) =>
    set((state) => {
      const { x, y, scale } = state.camera;
      const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
      if (next === scale) return state;

      const world = { x: (screenPoint.x - x) / scale, y: (screenPoint.y - y) / scale };

      return {
        camera: {
          scale: next,
          x: screenPoint.x - world.x * next,
          y: screenPoint.y - world.y * next,
        },
      };
    }),

  /** Frames everything drawn, with a margin. An empty floor gets a sane default. */
  fitToContent: (viewport) =>
    set((state) => {
      const bounds = layoutBounds(state.layout);

      if (bounds === null || viewport.width === 0 || viewport.height === 0) {
        return {
          camera: {
            scale: INITIAL_CAMERA.scale,
            x: viewport.width / 2,
            y: viewport.height / 2,
          },
        };
      }

      // Proportional, not a fixed number of pixels: 80px of margin on each
      // side of a phone-sized canvas is most of the canvas.
      const margin = Math.min(80, Math.min(viewport.width, viewport.height) * 0.12);
      const width = Math.max(bounds.maxX - bounds.minX, 1);
      const height = Math.max(bounds.maxY - bounds.minY, 1);

      const scale = clamp(
        Math.min(
          (viewport.width - margin * 2) / width,
          (viewport.height - margin * 2) / height,
        ),
        MIN_SCALE,
        MAX_SCALE,
      );

      return {
        camera: {
          scale,
          x: viewport.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
          y: viewport.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
        },
      };
    }),

  beginWall: (point) => set({ wallDraft: { points: [point], cursor: point } }),

  moveWallCursor: (point) =>
    set((state) =>
      state.wallDraft === null
        ? state
        : { wallDraft: { ...state.wallDraft, cursor: point } },
    ),

  /**
   * Places the next corner of the run and keeps drawing from there. Walls are
   * chained because a plan is a loop of them, not a pile of separate segments.
   */
  commitWallPoint: (point) => {
    const { wallDraft, apply } = get();
    if (wallDraft === null) return;

    const previous = wallDraft.points.at(-1);
    if (previous !== undefined) apply((layout) => addWall(layout, previous, point));

    set({ wallDraft: { points: [...wallDraft.points, point], cursor: point } });
  },

  endWall: () => set({ wallDraft: null }),

  beginRoom: (point) => set({ roomDraft: { from: point, to: point } }),

  moveRoom: (point) =>
    set((state) =>
      state.roomDraft === null ? state : { roomDraft: { ...state.roomDraft, to: point } },
    ),

  commitRoom: () => {
    const { roomDraft, apply } = get();
    if (roomDraft === null) return;

    apply((layout) =>
      addRectangularRoom(layout, roomDraft.from, roomDraft.to, nextRoomName(layout)),
    );

    set({ roomDraft: null });
  },

  placeOpening: (wallId, kind, t) => {
    get().apply((layout) => addOpening(layout, wallId, kind, t));
  },
}));

/** Whether there are changes the backend has not seen yet. */
export function selectIsDirty(state: EditorState): boolean {
  return signatureOf(state.layout) !== state.savedSignature;
}

export function selectCanUndo(state: EditorState): boolean {
  return state.past.length > 0;
}

export function selectCanRedo(state: EditorState): boolean {
  return state.future.length > 0;
}
