import type { Metadata } from "next";

import { ProjectsScreen } from "@/components/projects/ProjectsScreen";
import { isApiError } from "@/lib/api/client";
import { listProjects } from "@/lib/api/projects";
import { getServerApi } from "@/lib/auth/server";
import {
  parseProjectsSearch,
  projectsListQuery,
  type ProjectsSearchState,
} from "@/lib/projects/search-params";
import type { Project } from "@/lib/schemas/project";

export const metadata: Metadata = {
  title: "Mis proyectos — PlanCraft AI",
};

type LoadResult = {
  projects: Project[];
  total: number;
  error: string | null;
};

/**
 * A backend that is down or answering an error should not blank the screen: the
 * form still works and the message the API wrote is shown as is. The catch stays
 * around the fetch only — never around JSX, which React renders later.
 */
async function loadProjects(state: ProjectsSearchState): Promise<LoadResult> {
  try {
    const page = await listProjects(getServerApi(), projectsListQuery(state));
    return { projects: page.items, total: page.total, error: null };
  } catch (error) {
    if (!isApiError(error)) throw error;
    return { projects: [], total: 0, error: error.message };
  }
}

/**
 * The projects dashboard. Protected by `proxy.ts`, so there is always a session
 * here: the token travels server-side to FastAPI, which is the one deriving the
 * owner from it.
 *
 * The page only orchestrates — read the URL, fetch, render — as `app/` should.
 */
export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const state = parseProjectsSearch(await searchParams);
  const { projects, total, error } = await loadProjects(state);

  return (
    <ProjectsScreen
      projects={projects}
      total={total}
      state={state}
      error={error}
    />
  );
}
