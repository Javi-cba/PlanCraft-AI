/**
 * Single entry point for every call to the REST backend.
 * No component should ever call `fetch` directly.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Returns the Clerk session token, or a nullish value when signed out. */
export type TokenProvider = () => Promise<string | null | undefined>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body" | "method"> & {
  /** Serialized as JSON unless it is already a `FormData`/`Blob`. */
  body?: unknown;
  /** Appended to the URL as a query string, skipping nullish values. */
  query?: Record<string, string | number | boolean | undefined | null>;
};

export type ApiClient = {
  get: <T>(path: string, options?: RequestOptions) => Promise<T>;
  post: <T>(path: string, options?: RequestOptions) => Promise<T>;
  put: <T>(path: string, options?: RequestOptions) => Promise<T>;
  patch: <T>(path: string, options?: RequestOptions) => Promise<T>;
  delete: <T>(path: string, options?: RequestOptions) => Promise<T>;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.replace(/^\//, ""), `${BASE_URL.replace(/\/$/, "")}/`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

function extractMessage(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object" && "detail" in payload) {
    const { detail } = payload as { detail: unknown };
    if (typeof detail === "string") return detail;
  }
  return null;
}

/**
 * Builds an API client. Pass a `TokenProvider` to authenticate the requests:
 * the Clerk JWT travels in `Authorization: Bearer <token>` and the backend
 * validates it against Clerk's JWKS.
 *
 * Prefer `useApi()` in client components and `getServerApi()` on the server
 * over calling this directly.
 */
export function createApi(getToken?: TokenProvider): ApiClient {
  async function request<T>(
    method: string,
    path: string,
    { body, query, headers, ...init }: RequestOptions = {},
  ): Promise<T> {
    const isRawBody = body instanceof FormData || body instanceof Blob;
    const token = getToken ? await getToken() : null;

    const response = await fetch(buildUrl(path, query), {
      ...init,
      method,
      // Auth rides in the Authorization header, so no cookies are needed.
      // This also keeps the request out of CORS' credentialed mode.
      credentials: "omit",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined && !isRawBody
          ? { "Content-Type": "application/json" }
          : {}),
        ...headers,
      },
      body: isRawBody ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });

    const payload = await parseBody(response);

    if (!response.ok) {
      throw new ApiError(
        response.status,
        payload,
        extractMessage(payload) ?? `${method} ${path} failed (${response.status})`,
      );
    }

    return payload as T;
  }

  return {
    get: (path, options) => request("GET", path, options),
    post: (path, options) => request("POST", path, options),
    put: (path, options) => request("PUT", path, options),
    patch: (path, options) => request("PATCH", path, options),
    delete: (path, options) => request("DELETE", path, options),
  };
}

/** Unauthenticated client, for public endpoints such as `/health`. */
export const api = createApi();
