/**
 * Single entry point for every call to the REST backend.
 * No component should ever call `fetch` directly.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Returns the Clerk session token, or a nullish value when signed out. */
export type TokenProvider = () => Promise<string | null | undefined>;

/**
 * Codes this layer produces on its own. Everything else comes straight from the
 * backend envelope (`PROJECT_NOT_FOUND`, `TOKEN_EXPIRED`, `VALIDATION_ERROR`…).
 */
export const CLIENT_ERROR_CODES = {
  /** The request never reached the backend (offline, DNS, CORS, timeout). */
  network: "NETWORK_ERROR",
  /** The response failed but carried no `{ error: { … } }` envelope. */
  http: "HTTP_ERROR",
  /** The response was OK but did not match the expected schema. */
  invalidResponse: "INVALID_RESPONSE",
} as const;

/** Spanish fallbacks, for the failures the backend never got to describe. */
export const CLIENT_ERROR_MESSAGES = {
  [CLIENT_ERROR_CODES.network]:
    "No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.",
  [CLIENT_ERROR_CODES.http]:
    "No pudimos procesar la solicitud. Intentá de nuevo en unos minutos.",
  [CLIENT_ERROR_CODES.invalidResponse]:
    "El servidor respondió algo inesperado. Intentá de nuevo en unos minutos.",
} as const;

/**
 * Every failure of an API call, with the backend's own `code` and `message`.
 *
 * `message` is the Spanish text the backend wrote for the UI: show it as is in
 * a banner or a toast. Branch on `code`, never on the message.
 *
 * `status` is the HTTP status, or `0` when the failure was local and there was
 * no usable response (offline, or a body that did not match the schema).
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Narrows an unknown `catch` binding. Safer than `instanceof` across bundles. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError || (error as Error | null)?.name === "ApiError";
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
    return response.json().catch(() => null);
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

type BackendError = { code: string; message: string; details: unknown };

/**
 * Reads the backend's error envelope: `{ error: { code, message, details } }`.
 * Returns `null` for anything else (a proxy's HTML 502, an empty body…), so the
 * caller falls back to a generic Spanish message instead of showing raw noise.
 */
function readErrorEnvelope(payload: unknown): BackendError | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) {
    return null;
  }

  const { error } = payload as { error: unknown };
  if (typeof error !== "object" || error === null) return null;

  const { code, message, details } = error as Record<string, unknown>;
  if (typeof code !== "string" || typeof message !== "string") return null;

  return { code, message, details: details ?? null };
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

    let response: Response;
    try {
      response = await fetch(buildUrl(path, query), {
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
    } catch (cause) {
      // `fetch` only rejects when the request never completed. Wrapping it means
      // callers handle a single error type no matter what went wrong.
      throw new ApiError(
        CLIENT_ERROR_CODES.network,
        CLIENT_ERROR_MESSAGES[CLIENT_ERROR_CODES.network],
        0,
        cause,
      );
    }

    const payload = await parseBody(response);

    if (!response.ok) {
      const backendError = readErrorEnvelope(payload);

      throw new ApiError(
        backendError?.code ?? CLIENT_ERROR_CODES.http,
        backendError?.message ?? CLIENT_ERROR_MESSAGES[CLIENT_ERROR_CODES.http],
        response.status,
        backendError?.details ?? payload,
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
