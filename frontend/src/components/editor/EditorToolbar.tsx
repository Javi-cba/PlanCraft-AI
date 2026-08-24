"use client";

import {
  DoorOpen,
  Grid3x3,
  Hand,
  Magnet,
  Maximize,
  MousePointer2,
  PenLine,
  RectangleHorizontal,
  Redo2,
  Square,
  Undo2,
} from "lucide-react";
import type { ComponentType } from "react";

import {
  SNAP_STEPS,
  selectCanRedo,
  selectCanUndo,
  useEditorStore,
  type EditorTool,
} from "@/lib/store/editorStore";
import { cn } from "@/lib/utils/cn";

/**
 * The tools, and the switches that change how they behave.
 *
 * Vertical on desktop (a rail beside the canvas) and horizontal on a phone,
 * which is the same list laid out the other way — hence one component and a
 * `flex-row lg:flex-col`.
 */

type ToolDefinition = {
  tool: EditorTool;
  label: string;
  hint: string;
  shortcut: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
};

export const EDITOR_TOOLS: ToolDefinition[] = [
  {
    tool: "select",
    label: "Seleccionar",
    hint: "Mové, estirá y editá lo que ya está dibujado.",
    shortcut: "V",
    Icon: MousePointer2,
  },
  {
    tool: "wall",
    label: "Pared",
    hint: "Clic para cada esquina; doble clic o Esc para cerrar el tramo.",
    shortcut: "W",
    Icon: PenLine,
  },
  {
    tool: "room",
    label: "Ambiente",
    hint: "Arrastrá un rectángulo: crea las cuatro paredes y el ambiente.",
    shortcut: "R",
    Icon: Square,
  },
  {
    tool: "door",
    label: "Puerta",
    hint: "Clic sobre una pared para abrir el vano.",
    shortcut: "D",
    Icon: DoorOpen,
  },
  {
    tool: "window",
    label: "Ventana",
    hint: "Clic sobre una pared para colocar la ventana.",
    shortcut: "N",
    Icon: RectangleHorizontal,
  },
  {
    tool: "pan",
    label: "Mover vista",
    hint: "Arrastrá el plano. También funciona con el botón del medio.",
    shortcut: "H",
    Icon: Hand,
  },
];

const BUTTON_BASE =
  "group relative flex size-11 items-center justify-center rounded-2xl transition";

export function EditorToolbar({ onFitToContent }: { onFitToContent: () => void }) {
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const snapStep = useEditorStore((state) => state.snapStep);
  const setSnapStep = useEditorStore((state) => state.setSnapStep);
  const orthoEnabled = useEditorStore((state) => state.orthoEnabled);
  const toggleOrtho = useEditorStore((state) => state.toggleOrtho);
  const showGrid = useEditorStore((state) => state.showGrid);
  const toggleGrid = useEditorStore((state) => state.toggleGrid);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-paper-300/70 bg-paper-100/80 px-3 py-2 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-2 lg:py-3">
      <div className="flex items-center gap-1 lg:flex-col">
        {EDITOR_TOOLS.map(({ tool: value, label, hint, shortcut, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTool(value)}
            aria-pressed={tool === value}
            title={`${label} (${shortcut}) — ${hint}`}
            className={cn(
              BUTTON_BASE,
              tool === value
                ? "bg-blueprint-600 text-paper-50 shadow-md shadow-blueprint-600/25"
                : "text-ink-700/70 hover:bg-paper-200/70 hover:text-blueprint-700",
            )}
          >
            <Icon aria-hidden="true" className="size-5" />
            <span className="sr-only">{label}</span>
          </button>
        ))}
      </div>

      <span className="h-8 w-px shrink-0 bg-paper-300/80 lg:h-px lg:w-8" />

      <div className="flex items-center gap-1 lg:flex-col">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          title="Deshacer (⌘Z)"
          className={cn(BUTTON_BASE, "text-ink-700/70 hover:bg-paper-200/70 disabled:opacity-30")}
        >
          <Undo2 aria-hidden="true" className="size-5" />
          <span className="sr-only">Deshacer</span>
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          title="Rehacer (⇧⌘Z)"
          className={cn(BUTTON_BASE, "text-ink-700/70 hover:bg-paper-200/70 disabled:opacity-30")}
        >
          <Redo2 aria-hidden="true" className="size-5" />
          <span className="sr-only">Rehacer</span>
        </button>
      </div>

      <span className="h-8 w-px shrink-0 bg-paper-300/80 lg:h-px lg:w-8" />

      <div className="flex items-center gap-1 lg:flex-col">
        <button
          type="button"
          onClick={toggleGrid}
          aria-pressed={showGrid}
          title="Grilla (G)"
          className={cn(
            BUTTON_BASE,
            showGrid
              ? "bg-paper-200 text-blueprint-700"
              : "text-ink-700/50 hover:bg-paper-200/70",
          )}
        >
          <Grid3x3 aria-hidden="true" className="size-5" />
          <span className="sr-only">Mostrar la grilla</span>
        </button>
        <button
          type="button"
          onClick={toggleOrtho}
          aria-pressed={orthoEnabled}
          title="Trazado ortogonal (O) — mantené Shift para liberarlo"
          className={cn(
            BUTTON_BASE,
            orthoEnabled
              ? "bg-paper-200 text-blueprint-700"
              : "text-ink-700/50 hover:bg-paper-200/70",
          )}
        >
          <Magnet aria-hidden="true" className="size-5" />
          <span className="sr-only">Trazado ortogonal</span>
        </button>
        <button
          type="button"
          onClick={onFitToContent}
          title="Encuadrar el plano (F)"
          className={cn(BUTTON_BASE, "text-ink-700/70 hover:bg-paper-200/70")}
        >
          <Maximize aria-hidden="true" className="size-5" />
          <span className="sr-only">Encuadrar el plano</span>
        </button>
      </div>

      <span className="h-8 w-px shrink-0 bg-paper-300/80 lg:h-px lg:w-8" />

      <label className="flex shrink-0 items-center gap-1.5 lg:flex-col lg:gap-1">
        <span className="text-[0.6rem] font-semibold tracking-[0.12em] text-ink-700/50 uppercase">
          Paso
        </span>
        <select
          value={snapStep}
          onChange={(event) => setSnapStep(Number(event.target.value))}
          aria-label="Paso de la grilla en centímetros"
          className="rounded-xl border border-paper-300 bg-paper-50 px-2 py-1 text-xs text-ink-800 focus:border-blueprint-500 focus:ring-2 focus:ring-blueprint-400/25 focus:outline-none"
        >
          {SNAP_STEPS.map((step) => (
            <option key={step} value={step}>
              {step === 0 ? "libre" : `${step} cm`}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
