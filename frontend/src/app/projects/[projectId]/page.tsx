import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProjectDetailScreen } from "@/components/projects/ProjectDetailScreen";
import { isApiError } from "@/lib/api/client";
import { getProject } from "@/lib/api/projects";
import { getServerApi } from "@/lib/auth/server";
import type { ProjectDetail } from "@/lib/schemas/project";

/**
 * One project with its storeys. Protected by `proxy.ts`, so there is always a
 * session here: the token travels server-side to FastAPI, which derives the
 * owner from it — a project that is not yours answers 404, and so does this.
 */

async function loadProject(projectId: string): Promise<ProjectDetail> {
  try {
    return await getProject(getServerApi(), projectId);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/projects/[projectId]">): Promise<Metadata> {
  const { projectId } = await params;

  try {
    const project = await getProject(getServerApi(), projectId);
    return { title: `${project.name} — PlanCraft AI` };
  } catch {
    // The page itself reports the failure; the tab title is not the place.
    return { title: "Proyecto — PlanCraft AI" };
  }
}

export default async function ProjectPage({ params }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const project = await loadProject(projectId);

  return <ProjectDetailScreen project={project} />;
}
