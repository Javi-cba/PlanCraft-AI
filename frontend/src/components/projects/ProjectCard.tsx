import type { Project } from "@/lib/schemas/project";
import { formatDay } from "@/lib/utils/date";

/**
 * One project in the list. No link yet: the editor route does not exist, and a
 * card that navigates to a 404 is worse than a card that does not navigate.
 */
export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-paper-300/70 bg-paper-50 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl motion-reduce:hover:translate-y-0">
      <h3 className="font-display text-xl leading-tight font-medium text-ink-900">
        {project.name}
      </h3>

      {project.description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-700/75">
          {project.description}
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-700/45 italic">Sin descripción</p>
      )}

      <p className="mt-auto pt-5 text-[0.7rem] tracking-[0.1em] text-ink-700/50 uppercase">
        Creado el {formatDay(project.created_at)}
      </p>
    </article>
  );
}
