"use client";

import { Check, ChevronDown, LoaderCircle, TriangleAlert } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { z } from "zod";

import { useApi } from "@/hooks/useApi";
import { isApiError } from "@/lib/api/client";
import { createProject } from "@/lib/api/projects";
import {
  INSTALLATION_TYPE_LABELS,
  INSTALLATION_TYPES,
  type InstallationType,
} from "@/lib/schemas/plan";
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  projectCreateSchema,
  type Project,
} from "@/lib/schemas/project";
import { cn } from "@/lib/utils/cn";

/** Idle, in flight, failed or done — one state, so they cannot contradict. */
type FormStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; project: Project };

type FieldErrors = {
  name?: string[];
  description?: string[];
  installation_type?: string[];
};

const LABEL_CLASSES =
  "text-[0.7rem] font-semibold tracking-[0.14em] text-ink-700/55 uppercase";

const FIELD_CLASSES =
  "mt-2 w-full rounded-2xl border border-paper-300 bg-paper-100/60 px-4 py-3 text-sm text-ink-900 transition placeholder:text-ink-700/40 focus:border-blueprint-500 focus:bg-paper-50 focus:ring-2 focus:ring-blueprint-400/25 focus:outline-none disabled:opacity-60";

const FIELD_ERROR_CLASSES = "border-timber-500 bg-timber-300/10";

type NewProjectFormProps = {
  /** Lets the parent add the project to its list without refetching. */
  onCreated?: (project: Project) => void;
};

export function NewProjectForm({ onCreated }: NewProjectFormProps) {
  const api = useApi();
  const fieldId = useId();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [installationType, setInstallationType] =
    useState<InstallationType>("electrical");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const isLoading = status.kind === "loading";
  const nameId = `${fieldId}-name`;
  const descriptionId = `${fieldId}-description`;
  const installationTypeId = `${fieldId}-installation-type`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    // Same schema the request uses, so the rules match the backend's.
    const parsed = projectCreateSchema.safeParse({
      name,
      description,
      installation_type: installationType,
    });

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      setStatus({ kind: "error", message: "Revisá los campos marcados." });
      return;
    }

    setFieldErrors({});
    setStatus({ kind: "loading" });

    try {
      const project = await createProject(api, parsed.data);

      setStatus({ kind: "success", project });
      setName("");
      setDescription("");
      onCreated?.(project);
    } catch (error) {
      // The backend already wrote the message in Spanish for the UI.
      setStatus({
        kind: "error",
        message: isApiError(error)
          ? error.message
          : "No pudimos crear el proyecto. Intentá de nuevo.",
      });
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="rounded-3xl border border-paper-300/70 bg-paper-50 p-6 shadow-sm sm:p-8"
    >
      <p className="text-xs font-semibold tracking-[0.22em] text-timber-600 uppercase">
        Nuevo proyecto
      </p>
      <h2 className="mt-3 font-display text-3xl leading-[1.05] font-light tracking-tight text-ink-900 sm:text-4xl">
        Empezá <span className="font-semibold text-blueprint-600">por el nombre</span>
      </h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-700/80">
        Se crea con la Planta Baja y el plano de la instalación que elijas. Después
        sumás más plantas y más planos desde el editor.
      </p>

      <div className="mt-8 space-y-5">
        <div>
          <label htmlFor={nameId} className={LABEL_CLASSES}>
            Nombre
          </label>
          <input
            id={nameId}
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isLoading}
            maxLength={PROJECT_NAME_MAX_LENGTH}
            autoComplete="off"
            placeholder="Casa en Córdoba"
            aria-invalid={fieldErrors.name !== undefined}
            aria-describedby={fieldErrors.name ? `${nameId}-error` : undefined}
            className={cn(FIELD_CLASSES, fieldErrors.name && FIELD_ERROR_CLASSES)}
          />
          {fieldErrors.name ? (
            <p id={`${nameId}-error`} className="mt-1.5 text-xs text-timber-600">
              {fieldErrors.name[0]}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={installationTypeId} className={LABEL_CLASSES}>
            Instalación del primer plano
          </label>
          <div className="relative mt-2">
            <select
              id={installationTypeId}
              name="installation_type"
              value={installationType}
              onChange={(event) =>
                setInstallationType(event.target.value as InstallationType)
              }
              disabled={isLoading}
              className={cn(FIELD_CLASSES, "mt-0 appearance-none pr-11")}
            >
              {INSTALLATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {INSTALLATION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            {/* `appearance-none` drops the native arrow, so draw it back. */}
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-700/45"
            />
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={descriptionId} className={LABEL_CLASSES}>
              Descripción <span className="normal-case">(opcional)</span>
            </label>
            <span className="text-[0.7rem] text-ink-700/45">
              {description.trim().length}/{PROJECT_DESCRIPTION_MAX_LENGTH}
            </span>
          </div>
          <textarea
            id={descriptionId}
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isLoading}
            maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
            rows={4}
            placeholder="Dos plantas, terreno en esquina, instalación eléctrica y sanitaria."
            aria-invalid={fieldErrors.description !== undefined}
            aria-describedby={
              fieldErrors.description ? `${descriptionId}-error` : undefined
            }
            className={cn(
              FIELD_CLASSES,
              "resize-y",
              fieldErrors.description && FIELD_ERROR_CLASSES,
            )}
          />
          {fieldErrors.description ? (
            <p id={`${descriptionId}-error`} className="mt-1.5 text-xs text-timber-600">
              {fieldErrors.description[0]}
            </p>
          ) : null}
        </div>
      </div>

      {/* One live region for both outcomes, so a screen reader announces either. */}
      <div aria-live="polite" className="mt-6 empty:mt-0">
        {status.kind === "error" ? (
          <p className="flex items-start gap-2.5 rounded-2xl border border-timber-500/40 bg-timber-300/20 px-4 py-3 text-sm text-ink-800">
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-timber-600"
            />
            {status.message}
          </p>
        ) : null}

        {status.kind === "success" ? (
          <p className="flex items-start gap-2.5 rounded-2xl border border-blueprint-600/25 bg-blueprint-400/10 px-4 py-3 text-sm text-blueprint-700">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Listo, creamos «{status.project.name}». Ya podés crear otro.
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        aria-busy={isLoading}
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-blueprint-600 px-7 py-3.5 text-sm font-medium text-paper-50 shadow-lg shadow-blueprint-600/20 transition hover:-translate-y-0.5 hover:bg-blueprint-700 disabled:pointer-events-none disabled:opacity-60 motion-reduce:hover:translate-y-0"
      >
        {isLoading ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        {isLoading ? "Creando…" : "Crear proyecto"}
      </button>
    </form>
  );
}
