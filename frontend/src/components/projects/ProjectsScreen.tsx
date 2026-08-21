import { FolderOpen, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { NewProjectPanel } from "@/components/projects/NewProjectPanel";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectFilters } from "@/components/projects/ProjectFilters";
import { ProjectsPagination } from "@/components/projects/ProjectsPagination";
import { projectsHref, type ProjectsSearchState } from "@/lib/projects/search-params";
import type { Project } from "@/lib/schemas/project";

/**
 * The count under the title is the count of what is on screen: with a filter on
 * it talks about matches, not about everything the user has.
 */
function summarize(total: number, q?: string): string {
  if (q) {
    if (total === 0) return `Ningún proyecto coincide con «${q}».`;
    return total === 1
      ? `1 proyecto coincide con «${q}».`
      : `${total} proyectos coinciden con «${q}».`;
  }

  if (total === 0) {
    return "Todavía no hay nada acá. Creá tu primer proyecto y arrancá a dibujar.";
  }

  return `Tenés ${total} ${total === 1 ? "proyecto" : "proyectos"}. Buscá por nombre o cambiá el orden; el filtro queda en la URL.`;
}

type ProjectsScreenProps = {
  projects: Project[];
  total: number;
  state: ProjectsSearchState;
  /** Spanish message from the backend when the list could not be loaded. */
  error?: string | null;
};

/**
 * The whole projects screen, data in through props. `app/projects/page.tsx`
 * does the auth and the fetching; this only renders.
 */
export function ProjectsScreen({
  projects,
  total,
  state,
  error = null,
}: ProjectsScreenProps) {
  const isFiltered = Boolean(state.q);

  return (
    <main className="relative overflow-hidden">
      {/* Plan paper behind the header, fading downwards. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 grid-paper text-blueprint-600 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
      />

      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:py-16">
        <header>
          <p className="text-xs font-semibold tracking-[0.22em] text-timber-600 uppercase">
            Mis proyectos
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] font-light tracking-tight text-ink-900 sm:text-5xl">
            Cada obra, con sus{" "}
            <span className="font-semibold text-blueprint-600">plantas y planos</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-700/80">
            {summarize(total, state.q)}
          </p>
        </header>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-10">
          <div className="lg:sticky lg:top-24">
            <NewProjectPanel />
          </div>

          <section aria-label="Listado de proyectos">
            <ProjectFilters state={state} />

            {error ? (
              <p className="mt-6 flex items-start gap-2.5 rounded-2xl border border-timber-500/40 bg-timber-300/20 px-4 py-3 text-sm text-ink-800">
                <TriangleAlert
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-timber-600"
                />
                {error}
              </p>
            ) : null}

            {!error && projects.length > 0 ? (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {projects.map((project) => (
                  <li key={project.id}>
                    <ProjectCard project={project} />
                  </li>
                ))}
              </ul>
            ) : null}

            {!error && projects.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-paper-300 bg-paper-50/60 px-6 py-14 text-center">
                <FolderOpen
                  aria-hidden="true"
                  className="mx-auto size-8 text-ink-700/30"
                />
                {isFiltered ? (
                  <>
                    <p className="mt-4 text-sm text-ink-700/80">
                      No encontramos proyectos que coincidan con «{state.q}».
                    </p>
                    <Link
                      href={projectsHref(state, { q: undefined })}
                      className="mt-4 inline-block rounded-full border border-blueprint-600/25 px-5 py-2.5 text-sm font-medium text-blueprint-700 transition hover:border-blueprint-600/60 hover:bg-paper-50"
                    >
                      Ver todos los proyectos
                    </Link>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-ink-700/80">
                    Todavía no tenés proyectos. Creá el primero con el formulario
                    «Nuevo proyecto».
                  </p>
                )}
              </div>
            ) : null}

            {!error ? <ProjectsPagination state={state} total={total} /> : null}
          </section>
        </div>
      </div>
    </main>
  );
}
