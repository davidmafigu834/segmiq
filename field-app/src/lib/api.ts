import { CapacitorHttp } from "@capacitor/core";
import { getToken } from "./session";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "https://cloud.segmiq.com").replace(/\/$/, "");

/** Capacitor Android skips the POST body unless content-type is lowercase. */
const JSON_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "content-type": "application/json",
};

export type ApiResponse<T> = {
  ok: boolean;
  status: number;
  data: T;
};

/** Capacitor Android sometimes returns JSON as a string — coerce before use. */
function normalizeResponseData<T>(data: unknown): T {
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed) as T;
      } catch {
        /* use raw string */
      }
    }
  }
  return data as T;
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
  auth = true
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await CapacitorHttp.request({
    url: `${API_BASE}${path}`,
    method,
    headers,
    responseType: "json",
    ...(body !== undefined ? { data: body } : {}),
  });

  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    data: normalizeResponseData<T>(response.data),
  };
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>("GET", path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const payload =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : { value: body };
  return request<T>("POST", path, payload);
}

/** Unauthenticated POST — used for login before a token exists. */
export async function apiPostPublic<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const payload =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : { value: body };
  return request<T>("POST", path, payload, false);
}

export { API_BASE };
