import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import {
  projectsHref,
  projectsPageInfo,
  type ProjectsSearchState,
} from "@/lib/projects/search-params";

const BUTTON_CLASSES =
  "inline-flex items-center gap-1.5 rounded-full border border-blueprint-600/25 px-4 py-2 text-sm font-medium text-blueprint-700 transition hover:border-blueprint-600/60 hover:bg-paper-50";

const DISABLED_CLASSES =
  "inline-flex items-center gap-1.5 rounded-full border border-paper-300/70 px-4 py-2 text-sm font-medium text-ink-700/35";

/** Prev/next as real links, so a page is a URL you can share or reload. */
export function ProjectsPagination({
  state,
  total,
}: {
  state: ProjectsSearchState;
  total: number;
}) {
  const { from, to, lastPage, hasPrevious, hasNext } = projectsPageInfo(state, total);

  if (lastPage <= 1) return null;

  return (
    <nav
      aria-label="Paginación de proyectos"
      className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-paper-300/70 pt-6"
    >
      <p className="text-xs tracking-[0.1em] text-ink-700/55 uppercase">
        {from}–{to} de {total} · página {state.page} de {lastPage}
      </p>

      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <Link
            href={projectsHref(state, { page: state.page - 1 })}
            className={BUTTON_CLASSES}
            rel="prev"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Anterior
          </Link>
        ) : (
          <span className={DISABLED_CLASSES} aria-disabled="true">
            <ChevronLeft aria-hidden="true" className="size-4" />
            Anterior
          </span>
        )}

        {hasNext ? (
          <Link
            href={projectsHref(state, { page: state.page + 1 })}
            className={BUTTON_CLASSES}
            rel="next"
          >
            Siguiente
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        ) : (
          <span className={DISABLED_CLASSES} aria-disabled="true">
            Siguiente
            <ChevronRight aria-hidden="true" className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
