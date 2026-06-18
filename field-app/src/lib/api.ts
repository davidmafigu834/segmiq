import { CapacitorHttp } from "@capacitor/core";
import { getToken } from "./session";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "https://cloud.segmiq.com").replace(/\/$/, "");

export type ApiResponse<T> = {
  ok: boolean;
  status: number;
  data: T;
};

async function parseBody<T>(response: { status: number; data: unknown }): Promise<ApiResponse<T>> {
  const data = response.data as T;
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    data,
  };
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const token = await getToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await CapacitorHttp.get({
    url: `${API_BASE}${path}`,
    headers,
  });
  return parseBody<T>(response);
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const token = await getToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await CapacitorHttp.post({
    url: `${API_BASE}${path}`,
    headers,
    data: body,
  });
  return parseBody<T>(response);
}

/** Unauthenticated POST — used for login before a token exists. */
export async function apiPostPublic<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const response = await CapacitorHttp.post({
    url: `${API_BASE}${path}`,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    data: body,
  });
  return parseBody<T>(response);
}

export { API_BASE };
