"use client";

import {
  LoaderCircle,
  Pencil,
  PenLine,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useApi } from "@/hooks/useApi";
import { isApiError } from "@/lib/api/client";
import { deleteFloor, updateFloor } from "@/lib/api/floors";
import {
  FLOOR_NAME_MAX_LENGTH,
  floorLevelLabel,
  type FloorWithPlans,
} from "@/lib/schemas/floor";
import { INSTALLATION_TYPE_LABELS } from "@/lib/schemas/plan";

/**
 * One storey of the project: how much is drawn on it, which installations hang
 * off it, and the way into the editor.
 *
 * The card carries the counts and the area the backend derived, not the drawing
 * itself — a project page that downloaded three full layouts to render three
 * cards would be paying for a plan nobody is looking at yet.
 */
export function FloorCard({
  projectId,
  floor,
  canDelete,
}: {
  projectId: string;
  floor: FloorWithPlans;
  /** False for the last floor left: a project with no storey cannot be opened. */
  canDelete: boolean;
}) {
  const api = useApi();
  const router = useRouter();

  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(floor.name);
  const [busy, setBusy] = useState<"rename" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { summary } = floor;
  const isEmpty = summary.walls === 0;

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = name.trim();
    if (trimmed === "" || trimmed === floor.name) {
      setIsRenaming(false);
      setName(floor.name);
      return;
    }

    setBusy("rename");
    setError(null);

    try {
      await updateFloor(api, floor.id, { name: trimmed });
      setIsRenaming(false);
      router.refresh();
    } catch (cause) {
      setError(
        isApiError(cause) ? cause.message : "No pudimos renombrar el piso.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    setBusy("delete");
    setError(null);

    try {
      await deleteFloor(api, floor.id);
      router.refresh();
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : "No pudimos borrar el piso.");
      setBusy(null);
    }
  }

  return (
    <article className="flex h-full flex-col rounded-3xl border border-paper-300/70 bg-paper-50 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl motion-reduce:hover:translate-y-0">
      <div className="flex items-start justify-between gap-3">
        {isRenaming ? (
          <form onSubmit={handleRename} className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={FLOOR_NAME_MAX_LENGTH}
              aria-label="Nombre del piso"
              className="min-w-0 flex-1 rounded-xl border border-paper-300 bg-paper-100/60 px-3 py-1.5 text-sm text-ink-900 focus:border-blueprint-500 focus:ring-2 focus:ring-blueprint-400/25 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy === "rename"}
              className="rounded-lg bg-blueprint-600 px-3 py-1.5 text-xs font-medium text-paper-50 transition hover:bg-blueprint-700 disabled:opacity-60"
            >
              {busy === "rename" ? "…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRenaming(false);
                setName(floor.name);
              }}
              className="rounded-lg p-1.5 text-ink-700/50 transition hover:text-ink-900"
            >
              <X aria-hidden="true" className="size-4" />
              <span className="sr-only">Cancelar</span>
            </button>
          </form>
        ) : (
          <h3 className="flex min-w-0 items-center gap-2 font-display text-xl leading-tight font-medium text-ink-900">
            <span className="shrink-0 rounded-md bg-blueprint-600/10 px-1.5 py-0.5 text-xs font-semibold text-blueprint-700">
              {floorLevelLabel(floor.level)}
            </span>
            <span className="truncate">{floor.name}</span>
          </h3>
        )}

        {isRenaming ? null : (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setIsRenaming(true)}
              title="Renombrar el piso"
              className="rounded-lg p-1.5 text-ink-700/40 transition hover:bg-paper-200/70 hover:text-blueprint-700"
            >
              <Pencil aria-hidden="true" className="size-4" />
              <span className="sr-only">Renombrar el piso</span>
            </button>

            {canDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy === "delete"}
                title={`Borrar «${floor.name}» y sus ${floor.plans.length} planos`}
                className="rounded-lg p-1.5 text-ink-700/40 transition hover:bg-timber-300/20 hover:text-timber-600 disabled:opacity-40"
              >
                {busy === "delete" ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Trash2 aria-hidden="true" className="size-4" />
                )}
                <span className="sr-only">Borrar el piso</span>
              </button>
            ) : null}
          </div>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Ambientes" value={String(summary.rooms)} />
        <Stat label="Superficie" value={summary.area_m2 > 0 ? `${summary.area_m2} m²` : "—"} />
        <Stat label="Aberturas" value={String(summary.openings)} />
      </dl>

      {floor.plans.length > 0 ? (
        <ul className="mt-4 flex flex-1 flex-wrap content-start gap-1.5">
          {floor.plans.map((plan) => (
            <li
              key={plan.id}
              className="rounded-full border border-paper-300 px-2.5 py-1 text-[0.7rem] text-ink-700/70"
              title={plan.name}
            >
              {INSTALLATION_TYPE_LABELS[plan.installation_type]}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 flex-1 text-xs text-ink-700/45 italic">Sin planos todavía</p>
      )}

      {error ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-timber-500/40 bg-timber-300/20 px-3 py-2 text-xs text-ink-800">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-timber-600" />
          {error}
        </p>
      ) : null}

      <Link
        href={`/projects/${projectId}/floors/${floor.id}`}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-blueprint-600 px-5 py-2.5 text-sm font-medium text-paper-50 shadow-sm transition hover:bg-blueprint-700"
      >
        <PenLine aria-hidden="true" className="size-4" />
        {isEmpty ? "Dibujar la planta" : "Abrir el editor"}
      </Link>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper-100 px-2 py-2.5">
      <dt className="text-[0.6rem] tracking-[0.12em] text-ink-700/50 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 font-display text-lg font-medium text-ink-900">{value}</dd>
    </div>
  );
}
