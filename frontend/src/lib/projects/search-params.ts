import { z } from "zod";

import {
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_PAGE_SIZE,
  PROJECT_SORTS,
  type ProjectListQuery,
  type ProjectSort,
} from "@/lib/schemas/project";

/**
 * The URL is the state of the projects list: `/projects?q=casa&sort=name&page=2`
 * is shareable, survives a refresh and makes the back button work.
 *
 * People edit URLs, so parsing is forgiving on purpose: every field falls back
 * to its default instead of failing the page. The API, in contrast, rejects a
 * bad parameter with a 422 — it is a contract, not a link somebody typed.
 */

export const PROJECTS_PATH = "/projects";

/** What the page reads from the URL. `page` is 1-based, offsets are for the API. */
export type ProjectsSearchState = {
  q?: string;
  sort: ProjectSort;
  page: number;
};

const searchStateSchema = z.object({
  q: z.string().trim().max(PROJECT_NAME_MAX_LENGTH).optional().catch(undefined),
  sort: z.enum(PROJECT_SORTS).catch("recent"),
  page: z.coerce.number().int().min(1).catch(1),
});

/** Next hands over `string | string[] | undefined` per key; only strings count. */
type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseProjectsSearch(raw: RawSearchParams): ProjectsSearchState {
  const parsed = searchStateSchema.parse({
    q: first(raw.q),
    sort: first(raw.sort),
    page: first(raw.page),
  });

  // "?q=" and "?q=%20" mean no filter, not an empty search.
  return { ...parsed, q: parsed.q || undefined };
}

/** Translates the URL state into the API's query string. */
export function projectsListQuery(state: ProjectsSearchState): ProjectListQuery {
  return {
    q: state.q,
    sort: state.sort,
    limit: PROJECT_PAGE_SIZE,
    offset: (state.page - 1) * PROJECT_PAGE_SIZE,
  };
}

/**
 * Href for a partial change of the state, dropping the defaults so the common
 * case stays a clean `/projects`. Any change other than the page itself sends
 * the reader back to page 1 — page 4 of a new search is a dead end.
 */
export function projectsHref(
  state: ProjectsSearchState,
  changes: Partial<ProjectsSearchState> = {},
): string {
  const next: ProjectsSearchState = {
    ...state,
    ...changes,
    page: changes.page ?? (hasFilterChange(changes) ? 1 : state.page),
  };

  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.sort !== "recent") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));

  const query = params.toString();
  return query ? `${PROJECTS_PATH}?${query}` : PROJECTS_PATH;
}

/** Range shown as "1–12 de 25", and whether there is a page on either side. */
export function projectsPageInfo(state: ProjectsSearchState, total: number) {
  const offset = (state.page - 1) * PROJECT_PAGE_SIZE;
  const lastPage = Math.max(1, Math.ceil(total / PROJECT_PAGE_SIZE));

  return {
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(offset + PROJECT_PAGE_SIZE, total),
    lastPage,
    hasPrevious: state.page > 1,
    hasNext: state.page < lastPage,
  };
}

/** `in` and not `!== undefined`: clearing the search is `{ q: undefined }`. */
function hasFilterChange(changes: Partial<ProjectsSearchState>): boolean {
  return "q" in changes || "sort" in changes;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
