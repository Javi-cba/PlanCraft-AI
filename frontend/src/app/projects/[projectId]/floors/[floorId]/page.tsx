import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlanEditor } from "@/components/editor/PlanEditor";
import { isApiError } from "@/lib/api/client";
import { getFloor } from "@/lib/api/floors";
import { getProject } from "@/lib/api/projects";
import { getServerApi } from "@/lib/auth/server";
import type { FloorDetail } from "@/lib/schemas/floor";
import type { ProjectDetail } from "@/lib/schemas/project";

/**
 * The editor. The floor arrives with its layout and its plans already loaded,
 * so the canvas has something to draw on the first paint instead of flashing
 * empty while a client fetch lands.
 */

type EditorData = { project: ProjectDetail; floor: FloorDetail };

async function loadEditorData(
  projectId: string,
  floorId: string,
): Promise<EditorData> {
  const api = getServerApi();

  try {
    // Independent requests: the project for the breadcrumb, the floor for the
    // canvas. Both are scoped to the caller by the backend.
    const [project, floor] = await Promise.all([
      getProject(api, projectId),
      getFloor(api, floorId),
    ]);

    // A floor id from another project would otherwise open here under the
    // wrong name — both belong to the caller, but they are not related.
    if (floor.project_id !== project.id) notFound();

    return { project, floor };
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/projects/[projectId]/floors/[floorId]">): Promise<Metadata> {
  const { floorId } = await params;

  try {
    const floor = await getFloor(getServerApi(), floorId);
    return { title: `${floor.name} — PlanCraft AI` };
  } catch {
    return { title: "Editor — PlanCraft AI" };
  }
}

export default async function FloorEditorPage({
  params,
}: PageProps<"/projects/[projectId]/floors/[floorId]">) {
  const { projectId, floorId } = await params;
  const { project, floor } = await loadEditorData(projectId, floorId);

  return <PlanEditor project={project} floor={floor} />;
}
