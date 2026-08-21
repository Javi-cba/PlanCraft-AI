"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";

import { projectsHref, type ProjectsSearchState } from "@/lib/projects/search-params";
import {
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_SORT_LABELS,
  PROJECT_SORTS,
  type ProjectSort,
} from "@/lib/schemas/project";

/**
 * Search and ordering. Both write to the URL instead of to local state, so the
 * server re-renders the list, the back button works and the link is shareable.
 *
 * The inputs are uncontrolled and keyed by the current URL value: a navigation
 * (back button, "clear search") remounts them with the right value, which keeps
 * them in sync without a `setState` inside an effect.
 */
export function ProjectFilters({ state }: { state: ProjectsSearchState }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function go(href: string) {
    startTransition(() => router.push(href));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("q");
    const q = typeof value === "string" ? value.trim() : "";
    go(projectsHref(state, { q: q || undefined }));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      aria-busy={isPending}
    >
      <div className="relative flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-700/40"
        />
        <input
          key={state.q ?? ""}
          type="search"
          name="q"
          defaultValue={state.q ?? ""}
          maxLength={PROJECT_NAME_MAX_LENGTH}
          placeholder="Buscar por nombre o descripción"
          aria-label="Buscar proyectos"
          className="w-full rounded-full border border-paper-300 bg-paper-50 py-2.5 pr-4 pl-11 text-sm text-ink-900 transition placeholder:text-ink-700/40 focus:border-blueprint-500 focus:ring-2 focus:ring-blueprint-400/25 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="projects-sort" className="sr-only">
          Ordenar proyectos
        </label>
        <select
          id="projects-sort"
          key={state.sort}
          name="sort"
          defaultValue={state.sort}
          onChange={(event) =>
            go(projectsHref(state, { sort: event.target.value as ProjectSort }))
          }
          className="rounded-full border border-paper-300 bg-paper-50 px-4 py-2.5 text-sm text-ink-800 transition focus:border-blueprint-500 focus:ring-2 focus:ring-blueprint-400/25 focus:outline-none"
        >
          {PROJECT_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {PROJECT_SORT_LABELS[sort]}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="rounded-full border border-blueprint-600/25 px-5 py-2.5 text-sm font-medium text-blueprint-700 transition hover:border-blueprint-600/60 hover:bg-paper-50"
        >
          Buscar
        </button>

        {state.q ? (
          <Link
            href={projectsHref(state, { q: undefined })}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2.5 text-sm text-ink-700/70 transition hover:text-blueprint-700"
          >
            <X aria-hidden="true" className="size-3.5" />
            Limpiar
          </Link>
        ) : null}

        {isPending ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-4 animate-spin text-blueprint-600"
          />
        ) : null}
      </div>
    </form>
  );
}
