import { ArrowRight, Layers } from "lucide-react";
import Link from "next/link";

import type { Project } from "@/lib/schemas/project";
import { formatDay } from "@/lib/utils/date";

/** One project in the list. The whole card is the link into its storeys. */
export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex h-full flex-col rounded-3xl border border-paper-300/70 bg-paper-50 p-5 shadow-sm transition hover:-translate-y-1 hover:border-blueprint-600/30 hover:shadow-xl motion-reduce:hover:translate-y-0"
    >
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

      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <p className="text-[0.7rem] tracking-[0.1em] text-ink-700/50 uppercase">
          Creado el {formatDay(project.created_at)}
        </p>

        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-blueprint-700">
          <Layers aria-hidden="true" className="size-4" />
          Abrir
          <ArrowRight
            aria-hidden="true"
            className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
          />
        </span>
      </div>
    </Link>
  );
}
