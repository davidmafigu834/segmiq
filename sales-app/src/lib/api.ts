import { CapacitorHttp } from "@capacitor/core";
import { clearSession, getToken } from "./session";

export const AUTH_EXPIRED_EVENT = "segmiq-sales:auth-expired";

/** Apex segmiq.com 307-redirects to www; Capacitor Android drops POST bodies on redirect. */
function normalizeApiBase(raw: string): string {
  const trimmed = raw.replace(/\/$/, "");
  try {
    const url = new URL(trimmed);
    if (url.hostname === "segmiq.com") url.hostname = "www.segmiq.com";
    return url.origin;
  } catch {
    return trimmed === "https://segmiq.com" ? "https://www.segmiq.com" : trimmed;
  }
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE ?? "https://www.segmiq.com");

const JSON_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "content-type": "application/json",
};

export type ApiResponse<T> = {
  ok: boolean;
  status: number;
  data: T;
};

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
  method: "GET" | "POST" | "PATCH",
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

  if (response.status === 401 && auth && typeof window !== "undefined") {
    await clearSession();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }

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

export async function apiPatch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const payload =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : { value: body };
  return request<T>("PATCH", path, payload);
}

export async function apiPostPublic<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const payload =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : { value: body };
  return request<T>("POST", path, payload, false);
}

export { API_BASE };
