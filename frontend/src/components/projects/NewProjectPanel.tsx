"use client";

import { useRouter } from "next/navigation";

import { NewProjectForm } from "@/components/projects/NewProjectForm";
import { PROJECTS_PATH } from "@/lib/projects/search-params";

/**
 * Wires the form to the list: after creating, it goes back to the unfiltered
 * first page and refreshes it, so the new project is actually on screen even if
 * you were on page 3 of a search. A Server Component cannot pass this callback
 * down, hence this thin client wrapper.
 */
export function NewProjectPanel() {
  const router = useRouter();

  return (
    <NewProjectForm
      onCreated={() => {
        router.push(PROJECTS_PATH);
        router.refresh();
      }}
    />
  );
}
