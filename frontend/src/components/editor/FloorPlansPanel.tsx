"use client";

import { LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useApi } from "@/hooks/useApi";
import { isApiError } from "@/lib/api/client";
import { createPlan, deletePlan } from "@/lib/api/plans";
import {
  INSTALLATION_TYPES,
  INSTALLATION_TYPE_LABELS,
  PLAN_NAME_MAX_LENGTH,
  type InstallationType,
  type Plan,
} from "@/lib/schemas/plan";
import { cn } from "@/lib/utils/cn";

/**
 * The plans drawn over this floor.
 *
 * A plan is one installation — electrical, sanitary, gas — traced on the walls
 * next to it. The symbols themselves are not here yet, so what this panel does
 * today is manage the set of plans a floor has; the canvas draws the walls all
 * three of them share.
 */
export function FloorPlansPanel({
  floorId,
  plans,
  floorName,
}: {
  floorId: string;
  plans: Plan[];
  floorName: string;
}) {
  const api = useApi();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [installationType, setInstallationType] =
    useState<InstallationType>("electrical");
  const [name, setName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      await createPlan(api, floorId, {
        name:
          name.trim() ||
          `${INSTALLATION_TYPE_LABELS[installationType]} — ${floorName}`,
        installation_type: installationType,
        canvas_meta: {},
      });

      setName("");
      setIsOpen(false);
      router.refresh();
    } catch (cause) {
      setError(
        isApiError(cause) ? cause.message : "No pudimos crear el plano. Probá de nuevo.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(plan: Plan) {
    setBusyId(plan.id);
    setError(null);

    try {
      await deletePlan(api, plan.id);
      router.refresh();
    } catch (cause) {
      setError(
        isApiError(cause) ? cause.message : "No pudimos borrar el plano. Probá de nuevo.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="border-t border-paper-300/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-700/55 uppercase">
            Planos del piso
          </p>
          <p className="mt-1 text-xs text-ink-700/60">
            {plans.length === 0
              ? "Todavía no hay ninguno."
              : `${plans.length} ${plans.length === 1 ? "instalación" : "instalaciones"} sobre estas paredes.`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          className="rounded-xl border border-blueprint-600/25 p-2 text-blueprint-700 transition hover:border-blueprint-600/60 hover:bg-paper-100"
        >
          <Plus
            aria-hidden="true"
            className={cn("size-4 transition-transform", isOpen && "rotate-45")}
          />
          <span className="sr-only">Nuevo plano</span>
        </button>
      </div>

      {isOpen ? (
        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <select
            value={installationType}
            onChange={(event) =>
              setInstallationType(event.target.value as InstallationType)
            }
            aria-label="Tipo de instalación"
            className="w-full rounded-xl border border-paper-300 bg-paper-50 px-3 py-2 text-sm text-ink-900 focus:border-blueprint-500 focus:ring-2 focus:ring-blueprint-400/25 focus:outline-none"
          >
            {INSTALLATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {INSTALLATION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={PLAN_NAME_MAX_LENGTH}
            placeholder={`${INSTALLATION_TYPE_LABELS[installationType]} — ${floorName}`}
            aria-label="Nombre del plano"
            className="w-full rounded-xl border border-paper-300 bg-paper-50 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-700/40 focus:border-blueprint-500 focus:ring-2 focus:ring-blueprint-400/25 focus:outline-none"
          />

          <button
            type="submit"
            disabled={isCreating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blueprint-600 px-4 py-2 text-sm font-medium text-paper-50 transition hover:bg-blueprint-700 disabled:opacity-60"
          >
            {isCreating ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            Crear plano
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-timber-500/40 bg-timber-300/20 px-3 py-2 text-xs text-ink-800">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-timber-600" />
          {error}
        </p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {plans.map((plan) => (
          <li
            key={plan.id}
            className="flex items-center gap-2 rounded-xl border border-paper-300/70 bg-paper-50 px-3 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink-900">{plan.name}</span>
              <span className="text-[0.7rem] tracking-[0.08em] text-timber-600 uppercase">
                {INSTALLATION_TYPE_LABELS[plan.installation_type]}
              </span>
            </span>

            <button
              type="button"
              onClick={() => handleDelete(plan)}
              disabled={busyId === plan.id}
              title={`Borrar «${plan.name}»`}
              className="rounded-lg p-1.5 text-ink-700/45 transition hover:bg-timber-300/20 hover:text-timber-600 disabled:opacity-40"
            >
              {busyId === plan.id ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" className="size-4" />
              )}
              <span className="sr-only">Borrar el plano</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
