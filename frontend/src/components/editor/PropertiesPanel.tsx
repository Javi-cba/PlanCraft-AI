"use client";

import { Trash2 } from "lucide-react";

import { EDITOR_TOOLS } from "@/components/editor/EditorToolbar";
import {
  findWall,
  formatArea,
  formatLength,
  roomArea,
  updateOpening,
  updateRoom,
  updateWall,
  wallLength,
} from "@/lib/geometry/layout";
import {
  OPENING_KINDS,
  OPENING_KIND_LABELS,
  OPENING_MAX_WIDTH,
  OPENING_MIN_WIDTH,
  ROOM_NAME_MAX_LENGTH,
  WALL_MAX_THICKNESS,
  WALL_MIN_THICKNESS,
  type OpeningKind,
} from "@/lib/schemas/layout";
import { useEditorStore } from "@/lib/store/editorStore";
import { cn } from "@/lib/utils/cn";

/**
 * Everything about whatever is selected — and, when nothing is, what the tool
 * in hand actually does. An editor whose side panel goes blank is an editor
 * that stops teaching itself.
 */

const LABEL = "text-[0.7rem] font-semibold tracking-[0.14em] text-ink-700/55 uppercase";

const FIELD =
  "mt-1.5 w-full rounded-xl border border-paper-300 bg-paper-50 px-3 py-2 text-sm text-ink-900 transition focus:border-blueprint-500 focus:ring-2 focus:ring-blueprint-400/25 focus:outline-none";

export function PropertiesPanel() {
  const layout = useEditorStore((state) => state.layout);
  const selection = useEditorStore((state) => state.selection);
  const tool = useEditorStore((state) => state.tool);
  const apply = useEditorStore((state) => state.apply);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);

  if (selection === null) {
    const active = EDITOR_TOOLS.find((definition) => definition.tool === tool);

    return (
      <section className="p-5">
        <p className={LABEL}>Herramienta</p>
        <h3 className="mt-2 font-display text-xl font-medium text-ink-900">
          {active?.label ?? "Seleccionar"}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-700/75">{active?.hint}</p>

        <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
          <Metric label="Paredes" value={String(layout.walls.length)} />
          <Metric label="Aberturas" value={String(layout.openings.length)} />
          <Metric label="Ambientes" value={String(layout.rooms.length)} />
        </dl>

        <p className="mt-6 text-xs leading-relaxed text-ink-700/55">
          Tocá una pared, una abertura o un ambiente para editarlo. Con Shift liberás el
          trazado ortogonal, y con Supr borrás lo seleccionado.
        </p>
      </section>
    );
  }

  if (selection.kind === "wall") {
    const wall = findWall(layout, selection.id);
    if (wall === undefined) return null;

    return (
      <section className="p-5">
        <Header title="Pared" onDelete={deleteSelection} />

        <div className="mt-5 space-y-4">
          <Readonly label="Largo" value={formatLength(wallLength(wall))} />

          <label className="block">
            <span className={LABEL}>Espesor (cm)</span>
            <input
              type="number"
              min={WALL_MIN_THICKNESS}
              max={WALL_MAX_THICKNESS}
              step={1}
              value={wall.thickness}
              onChange={(event) => {
                const thickness = clampNumber(
                  Number(event.target.value),
                  WALL_MIN_THICKNESS,
                  WALL_MAX_THICKNESS,
                );
                apply((current) => updateWall(current, wall.id, { thickness }));
              }}
              className={FIELD}
            />
          </label>

          <p className="text-xs leading-relaxed text-ink-700/55">
            Arrastrá la pared para moverla entera, o los puntos de las puntas para
            estirarla. Se pega a las esquinas que ya existen.
          </p>
        </div>
      </section>
    );
  }

  if (selection.kind === "room") {
    const room = layout.rooms.find((candidate) => candidate.id === selection.id);
    if (room === undefined) return null;

    return (
      <section className="p-5">
        <Header title="Ambiente" onDelete={deleteSelection} />

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className={LABEL}>Nombre</span>
            <input
              type="text"
              value={room.name}
              maxLength={ROOM_NAME_MAX_LENGTH}
              onChange={(event) => {
                const name = event.target.value;
                // An empty name would fail the API, and a room with no label is
                // not something anybody wants on a plan either.
                apply((current) =>
                  updateRoom(current, room.id, { name: name || room.name }),
                );
              }}
              className={FIELD}
            />
          </label>

          <Readonly label="Superficie" value={formatArea(roomArea(room))} />

          <p className="text-xs leading-relaxed text-ink-700/55">
            El ambiente es la etiqueta y la superficie: borrarlo no toca las paredes que
            lo rodean.
          </p>
        </div>
      </section>
    );
  }

  const opening = layout.openings.find((candidate) => candidate.id === selection.id);
  if (opening === undefined) return null;

  return (
    <section className="p-5">
      <Header title={OPENING_KIND_LABELS[opening.kind]} onDelete={deleteSelection} />

      <div className="mt-5 space-y-4">
        <div>
          <span className={LABEL}>Tipo</span>
          <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-paper-200/70 p-1">
            {OPENING_KINDS.map((kind: OpeningKind) => (
              <button
                key={kind}
                type="button"
                onClick={() =>
                  apply((current) => updateOpening(current, opening.id, { kind }))
                }
                aria-pressed={opening.kind === kind}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  opening.kind === kind
                    ? "bg-paper-50 text-blueprint-700 shadow-sm"
                    : "text-ink-700/60 hover:text-blueprint-700",
                )}
              >
                {OPENING_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className={LABEL}>Ancho (cm)</span>
          <input
            type="number"
            min={OPENING_MIN_WIDTH}
            max={OPENING_MAX_WIDTH}
            step={5}
            value={opening.width}
            onChange={(event) => {
              const width = clampNumber(
                Number(event.target.value),
                OPENING_MIN_WIDTH,
                OPENING_MAX_WIDTH,
              );
              apply((current) => updateOpening(current, opening.id, { width }));
            }}
            className={FIELD}
          />
        </label>

        {opening.kind === "door" ? (
          <button
            type="button"
            onClick={() =>
              apply((current) =>
                updateOpening(current, opening.id, { flipped: !opening.flipped }),
              )
            }
            className="w-full rounded-xl border border-blueprint-600/25 px-4 py-2 text-sm font-medium text-blueprint-700 transition hover:border-blueprint-600/60 hover:bg-paper-100"
          >
            Invertir el lado de apertura
          </button>
        ) : null}

        <p className="text-xs leading-relaxed text-ink-700/55">
          Arrastrala para correrla a lo largo de la pared. Si no entra, se acomoda sola
          adentro del tramo.
        </p>
      </div>
    </section>
  );
}

function Header({ title, onDelete }: { title: string; onDelete: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className={LABEL}>Seleccionado</p>
        <h3 className="mt-2 font-display text-xl font-medium text-ink-900">{title}</h3>
      </div>
      <button
        type="button"
        onClick={onDelete}
        title="Borrar (Supr)"
        className="rounded-xl border border-timber-500/30 p-2 text-timber-600 transition hover:border-timber-500/70 hover:bg-timber-300/20"
      >
        <Trash2 aria-hidden="true" className="size-4" />
        <span className="sr-only">Borrar</span>
      </button>
    </div>
  );
}

function Readonly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className={LABEL}>{label}</span>
      <p className="mt-1.5 font-display text-lg font-medium text-blueprint-700">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-paper-300/70 bg-paper-50 px-2 py-3">
      <dt className="text-[0.6rem] tracking-[0.12em] text-ink-700/50 uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-display text-xl font-medium text-ink-900">{value}</dd>
    </div>
  );
}

/** A number input hands back `NaN` for an empty field, and any value for the rest. */
function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
