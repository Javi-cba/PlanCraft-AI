"use client";

import { ArrowLeft, Check, LayoutTemplate, LoaderCircle, Save, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { FloorPlansPanel } from "@/components/editor/FloorPlansPanel";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { TemplatePicker } from "@/components/editor/TemplatePicker";
import { useApi } from "@/hooks/useApi";
import { isApiError } from "@/lib/api/client";
import { saveFloorLayout } from "@/lib/api/floors";
import { findTemplate, instantiateTemplate } from "@/lib/plans/templates";
import { floorLevelLabel, type FloorDetail } from "@/lib/schemas/floor";
import type { ProjectDetail } from "@/lib/schemas/project";
import { selectIsDirty, useEditorStore } from "@/lib/store/editorStore";
import { cn } from "@/lib/utils/cn";

/**
 * The editor screen: toolbar, canvas and the panels around them.
 *
 * The canvas is loaded with `ssr: false` because Konva paints on a real
 * `<canvas>` and reaches for `window` as soon as it is imported — rendering it
 * on the server does not fail gracefully, it fails at import time.
 */
const EditorStage = dynamic(
  () => import("@/components/editor/EditorStage").then((module) => module.EditorStage),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <LoaderCircle
          aria-hidden="true"
          className="size-6 animate-spin text-blueprint-600"
        />
        <span className="sr-only">Cargando el editor…</span>
      </div>
    ),
  },
);

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function PlanEditor({
  project,
  floor,
}: {
  project: Pick<ProjectDetail, "id" | "name">;
  floor: FloorDetail;
}) {
  const api = useApi();

  const canvasRef = useRef<HTMLDivElement>(null);
  const fittedFloorRef = useRef<string | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  const loadedFloorId = useEditorStore((state) => state.floorId);
  const isDirty = useEditorStore(selectIsDirty);

  const isReady = loadedFloorId === floor.id;

  /**
   * Point the store at this floor. Guarded by the id, not by the props: the
   * panels call `router.refresh()` after creating a plan, and reloading the
   * layout there would throw away whatever is unsaved on the canvas.
   */
  useEffect(() => {
    if (useEditorStore.getState().floorId !== floor.id) {
      useEditorStore.getState().loadFloor(floor.id, floor.layout);
      fittedFloorRef.current = null;
    }
  }, [floor.id, floor.layout]);

  // The canvas needs pixel dimensions, and Konva cannot read a CSS `flex: 1`.
  useEffect(() => {
    const element = canvasRef.current;
    if (element === null) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitToContent = useCallback(() => {
    const element = canvasRef.current;
    if (element === null) return;

    useEditorStore.getState().fitToContent({
      width: element.clientWidth,
      height: element.clientHeight,
    });
  }, []);

  // Frame the drawing once per floor, as soon as there is a canvas to frame in.
  useEffect(() => {
    if (!isReady || size.width === 0 || fittedFloorRef.current === floor.id) return;

    fittedFloorRef.current = floor.id;
    fitToContent();
  }, [fitToContent, floor.id, isReady, size.width]);

  const save = useCallback(async () => {
    const { layout, markSaved } = useEditorStore.getState();

    setSaveState({ kind: "saving" });

    try {
      await saveFloorLayout(api, floor.id, layout);
      markSaved(layout);
      setSaveState({ kind: "saved" });
    } catch (cause) {
      setSaveState({
        kind: "error",
        message: isApiError(cause)
          ? cause.message
          : "No pudimos guardar el plano. Probá de nuevo.",
      });
    }
  }, [api, floor.id]);

  // Keyboard: the tools, the history and the save, the way every editor does it.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // Never steal a keystroke from a field the user is typing in.
      if (
        target !== null &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }

      const store = useEditorStore.getState();
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
        return;
      }

      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }

      if (meta) return;

      switch (event.key) {
        case "Escape":
          store.endWall();
          store.select(null);
          return;
        case "Delete":
        case "Backspace":
          if (store.selection !== null) {
            event.preventDefault();
            store.deleteSelection();
          }
          return;
        default:
          break;
      }

      const shortcuts: Record<string, () => void> = {
        v: () => store.setTool("select"),
        w: () => store.setTool("wall"),
        r: () => store.setTool("room"),
        d: () => store.setTool("door"),
        n: () => store.setTool("window"),
        h: () => store.setTool("pan"),
        g: store.toggleGrid,
        o: store.toggleOrtho,
        f: fitToContent,
      };

      shortcuts[event.key.toLowerCase()]?.();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fitToContent, save]);

  // Closing the tab with unsaved walls should at least ask.
  useEffect(() => {
    if (!isDirty) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  return (
    <main className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden lg:h-[calc(100dvh-5rem)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-paper-300/70 bg-paper-100/80 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/projects/${project.id}`}
            className="rounded-full border border-paper-300 p-2 text-ink-700/70 transition hover:border-blueprint-600/40 hover:text-blueprint-700"
            title="Volver al proyecto"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <span className="sr-only">Volver al proyecto</span>
          </Link>

          <div className="min-w-0">
            <p className="truncate text-[0.7rem] tracking-[0.14em] text-ink-700/50 uppercase">
              {project.name}
            </p>
            <h1 className="truncate font-display text-lg leading-tight font-medium text-ink-900">
              <span className="mr-2 rounded-md bg-blueprint-600/10 px-1.5 py-0.5 text-xs font-semibold text-blueprint-700">
                {floorLevelLabel(floor.level)}
              </span>
              {floor.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} isDirty={isDirty} />

          <button
            type="button"
            onClick={() => void save()}
            disabled={saveState.kind === "saving" || !isDirty}
            className="inline-flex items-center gap-2 rounded-full bg-blueprint-600 px-5 py-2.5 text-sm font-medium text-paper-50 shadow-sm transition hover:bg-blueprint-700 disabled:pointer-events-none disabled:opacity-45"
          >
            {saveState.kind === "saving" ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            Guardar
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <EditorToolbar onFitToContent={fitToContent} />

        <div
          ref={canvasRef}
          className="relative min-h-64 flex-1 touch-none overflow-hidden bg-paper-50"
        >
          {isReady && size.width > 0 ? (
            <EditorStage width={size.width} height={size.height} />
          ) : null}
        </div>

        <aside className="flex max-h-[45dvh] shrink-0 flex-col overflow-y-auto border-t border-paper-300/70 bg-paper-100/60 lg:max-h-none lg:w-80 lg:border-t-0 lg:border-l">
          <PropertiesPanel />

          <details className="border-t border-paper-300/70">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-[0.7rem] font-semibold tracking-[0.14em] text-ink-700/55 uppercase transition hover:text-blueprint-700">
              <LayoutTemplate aria-hidden="true" className="size-4" />
              Plantillas
            </summary>
            <div className="px-5 pb-5">
              <p className="mb-3 text-xs leading-relaxed text-ink-700/60">
                Reemplaza el dibujo actual del piso. Si no era lo que buscabas, deshacé
                con ⌘Z.
              </p>
              <TemplatePicker
                value=""
                columns="grid-cols-1"
                onChange={(templateId) => {
                  const template = findTemplate(templateId);
                  if (template === undefined) return;

                  useEditorStore
                    .getState()
                    .apply(() => instantiateTemplate(template));
                  fitToContent();
                }}
              />
            </div>
          </details>

          <FloorPlansPanel
            floorId={floor.id}
            floorName={floor.name}
            plans={floor.plans}
          />
        </aside>
      </div>
    </main>
  );
}

/** Says, in words, whether what is on screen is what is stored. */
function SaveIndicator({ state, isDirty }: { state: SaveState; isDirty: boolean }) {
  if (state.kind === "error") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-timber-600">
        <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="max-w-52 truncate" title={state.message}>
          {state.message}
        </span>
      </p>
    );
  }

  if (isDirty) {
    return (
      <p className="text-xs text-ink-700/60">
        <span className="mr-1.5 inline-block size-1.5 rounded-full bg-timber-500 align-middle" />
        Cambios sin guardar
      </p>
    );
  }

  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-xs",
        state.kind === "saved" ? "text-blueprint-700" : "text-ink-700/45",
      )}
    >
      <Check aria-hidden="true" className="size-3.5" />
      {state.kind === "saved" ? "Guardado" : "Sin cambios"}
    </p>
  );
}
