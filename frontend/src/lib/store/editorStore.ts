import { create } from "zustand";

export type EditorTool = "select" | "pan" | "wall" | "symbol" | "measure";

type EditorState = {
  activeTool: EditorTool;
  selectedIds: string[];
  zoom: number;

  setActiveTool: (tool: EditorTool) => void;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  setZoom: (zoom: number) => void;
};

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

export const useEditorStore = create<EditorState>((set) => ({
  activeTool: "select",
  selectedIds: [],
  zoom: 1,

  setActiveTool: (activeTool) => set({ activeTool }),
  setSelection: (selectedIds) => set({ selectedIds }),
  clearSelection: () => set({ selectedIds: [] }),
  setZoom: (zoom) => set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }),
}));
