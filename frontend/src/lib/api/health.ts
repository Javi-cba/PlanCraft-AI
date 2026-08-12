import { api } from "./client";

export type HealthResponse = {
  status: "ok";
  service: string;
  version: string;
};

/** Round-trip against the backend. Useful to verify connectivity and CORS. */
export function getHealth(): Promise<HealthResponse> {
  return api.get<HealthResponse>("/health");
}
