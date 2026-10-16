"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ReFetchState<T> =
  | { status: "loading"; data: null; httpStatus: null; reload: () => void }
  | { status: "error"; data: null; httpStatus: number | null; reload: () => void }
  | { status: "ready"; data: T; httpStatus: number; reload: () => void };

/**
 * GET a JSON endpoint for a dashboard section. A failed request is reported as
 * an error, never as an empty result, so the UI can avoid showing fake zeros.
 * Pass `null` to skip the request.
 */
export function useReFetch<T>(url: string | null): ReFetchState<T> {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; data: T | null; httpStatus: number | null }>({
    status: "loading",
    data: null,
    httpStatus: null,
  });
  const seq = useRef(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!url) return;
    const id = ++seq.current;
    const controller = new AbortController();
    setState({ status: "loading", data: null, httpStatus: null });
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as T | null;
        if (id !== seq.current) return;
        if (!res.ok || json == null) {
          setState({ status: "error", data: null, httpStatus: res.status });
          return;
        }
        setState({ status: "ready", data: json, httpStatus: res.status });
      })
      .catch(() => {
        if (controller.signal.aborted || id !== seq.current) return;
        setState({ status: "error", data: null, httpStatus: null });
      });
    return () => controller.abort();
  }, [url, nonce]);

  if (state.status === "ready") {
    return { status: "ready", data: state.data as T, httpStatus: state.httpStatus ?? 200, reload };
  }
  if (state.status === "error") {
    return { status: "error", data: null, httpStatus: state.httpStatus, reload };
  }
  return { status: "loading", data: null, httpStatus: null, reload };
}
