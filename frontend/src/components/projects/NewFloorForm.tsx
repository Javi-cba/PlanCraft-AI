"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { TemplatePicker } from "@/components/editor/TemplatePicker";
import { useApi } from "@/hooks/useApi";
import { isApiError } from "@/lib/api/client";
import { createFloor } from "@/lib/api/floors";
import { DEFAULT_TEMPLATE_ID, findTemplate, instantiateTemplate } from "@/lib/plans/templates";
import {
  FLOOR_MAX_LEVEL,
  FLOOR_MIN_LEVEL,
  FLOOR_NAME_MAX_LENGTH,
  defaultFloorName,
} from "@/lib/schemas/floor";
import { emptyLayout } from "@/lib/schemas/layout";

/**
 * Adds a storey to a project, already drawn.
 *
 * The template travels with the request, so picking "Casa 3 dormitorios" is one
 * call that lands a floor with its walls — not a blank floor plus a save the
 * user would have to remember to make.
 */
export function NewFloorForm({
  projectId,
  suggestedLevel,
}: {
  projectId: string;
  /** One above the highest storey the project already has. */
  suggestedLevel: number;
}) {
  const api = useApi();
  const router = useRouter();

  const [level, setLevel] = useState(suggestedLevel);
  const [name, setName] = useState(defaultFloorName(suggestedLevel));
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Renaming by hand wins; until then the name follows the level. */
  const [nameTouched, setNameTouched] = useState(false);

  function handleLevelChange(value: number) {
    setLevel(value);
    if (!nameTouched) setName(defaultFloorName(value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setError(null);

    const template = findTemplate(templateId);

    try {
      await createFloor(api, projectId, {
        name: name.trim() || defaultFloorName(level),
        level,
        layout: template ? instantiateTemplate(template) : emptyLayout(),
      });

      setNameTouched(false);
      setTemplateId(DEFAULT_TEMPLATE_ID);
      router.refresh();
    } catch (cause) {
      setError(
        isApiError(cause) ? cause.message : "No pudimos crear el piso. Probá de nuevo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-paper-300/70 bg-paper-50 p-6 shadow-sm"
    >
      <p className="text-xs font-semibold tracking-[0.22em] text-timber-600 uppercase">
        Nueva planta
      </p>
      <h2 className="mt-3 font-display text-2xl leading-tight font-light tracking-tight text-ink-900">
        Sumá un <span className="font-semibold text-blueprint-600">piso</span>
      </h2>

      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_7rem]">
        <label className="block">
          <span className="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-700/55 uppercase">
            Nombre
          </span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameTouched(true);
            }}
            maxLength={FLOOR_NAME_MAX_LENGTH}
            disabled={isSaving}
            className="mt-2 w-full rounded-2xl border border-paper-300 bg-paper-100/60 px-4 py-2.5 text-sm text-ink-900 transition focus:border-blueprint-500 focus:bg-paper-50 focus:ring-2 focus:ring-blueprint-400/25 focus:outline-none disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-700/55 uppercase">
            Nivel
          </span>
          <input
            type="number"
            value={level}
            min={FLOOR_MIN_LEVEL}
            max={FLOOR_MAX_LEVEL}
            step={1}
            disabled={isSaving}
            onChange={(event) => handleLevelChange(Number(event.target.value) || 0)}
            className="mt-2 w-full rounded-2xl border border-paper-300 bg-paper-100/60 px-4 py-2.5 text-sm text-ink-900 transition focus:border-blueprint-500 focus:bg-paper-50 focus:ring-2 focus:ring-blueprint-400/25 focus:outline-none disabled:opacity-60"
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-ink-700/55">
        0 es la planta baja, 1 la primera planta y −1 un subsuelo.
      </p>

      <div className="mt-6">
        <span className="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-700/55 uppercase">
          Plantilla
        </span>
        <p className="mt-1 mb-3 text-xs text-ink-700/60">
          Arranca con las paredes ya dibujadas. Después ajustás todo en el editor.
        </p>
        <TemplatePicker
          value={templateId}
          onChange={setTemplateId}
          disabled={isSaving}
          columns="grid-cols-1"
        />
      </div>

      <div aria-live="polite" className="mt-5 empty:mt-0">
        {error ? (
          <p className="flex items-start gap-2.5 rounded-2xl border border-timber-500/40 bg-timber-300/20 px-4 py-3 text-sm text-ink-800">
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-timber-600"
            />
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSaving}
        aria-busy={isSaving}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-blueprint-600 px-7 py-3 text-sm font-medium text-paper-50 shadow-lg shadow-blueprint-600/20 transition hover:bg-blueprint-700 disabled:pointer-events-none disabled:opacity-60"
      >
        {isSaving ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        {isSaving ? "Creando…" : "Crear planta"}
      </button>
    </form>
  );
}
