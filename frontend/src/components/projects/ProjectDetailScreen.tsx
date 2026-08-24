import { ArrowLeft, Layers } from "lucide-react";
import Link from "next/link";

import { FloorCard } from "@/components/projects/FloorCard";
import { NewFloorForm } from "@/components/projects/NewFloorForm";
import { PROJECTS_PATH } from "@/lib/projects/search-params";
import type { ProjectDetail } from "@/lib/schemas/project";
import { formatDay } from "@/lib/utils/date";

/**
 * A project, storey by storey. `app/projects/[projectId]/page.tsx` does the
 * auth and the fetching; this only renders.
 */
export function ProjectDetailScreen({ project }: { project: ProjectDetail }) {
  const floors = project.floors;
  const totalArea = floors.reduce((sum, floor) => sum + floor.summary.area_m2, 0);
  const totalPlans = floors.reduce((sum, floor) => sum + floor.plans.length, 0);
  // One above the top storey, so "add a floor" means the obvious thing.
  const nextLevel = floors.reduce((top, floor) => Math.max(top, floor.level + 1), 0);

  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 grid-paper text-blueprint-600 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
      />

      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:py-16">
        <Link
          href={PROJECTS_PATH}
          className="inline-flex items-center gap-2 text-sm text-ink-700/70 transition-colors hover:text-blueprint-700"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Mis proyectos
        </Link>

        <header className="mt-6">
          <p className="text-xs font-semibold tracking-[0.22em] text-timber-600 uppercase">
            Proyecto · creado el {formatDay(project.created_at)}
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] font-light tracking-tight text-ink-900 sm:text-5xl">
            {project.name}
          </h1>
          {project.description ? (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-700/80">
              {project.description}
            </p>
          ) : null}

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            <Summary
              label="Plantas"
              value={`${floors.length} ${floors.length === 1 ? "piso" : "pisos"}`}
            />
            <Summary
              label="Planos"
              value={`${totalPlans} ${totalPlans === 1 ? "instalación" : "instalaciones"}`}
            />
            <Summary
              label="Superficie"
              value={totalArea > 0 ? `${Math.round(totalArea * 10) / 10} m²` : "sin dibujar"}
            />
          </dl>
        </header>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10">
          <section aria-label="Plantas del proyecto" className="order-2 lg:order-1">
            {floors.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {floors.map((floor) => (
                  <li key={floor.id}>
                    <FloorCard
                      projectId={project.id}
                      floor={floor}
                      canDelete={floors.length > 1}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-3xl border border-dashed border-paper-300 bg-paper-50/60 px-6 py-14 text-center">
                <Layers aria-hidden="true" className="mx-auto size-8 text-ink-700/30" />
                <p className="mt-4 text-sm text-ink-700/80">
                  Este proyecto se quedó sin plantas. Creá una con el formulario de al
                  lado y elegí una plantilla para arrancar.
                </p>
              </div>
            )}
          </section>

          <div className="order-1 lg:order-2 lg:sticky lg:top-24">
            <NewFloorForm projectId={project.id} suggestedLevel={nextLevel} />
          </div>
        </div>
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.65rem] tracking-[0.14em] text-ink-700/50 uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-display text-xl font-medium text-ink-900">{value}</dd>
    </div>
  );
}
