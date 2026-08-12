import {
  GUIDED_COURSE_ID,
  GUIDED_COURSE_VERSION,
  type GuidedLearningProgress,
} from "./types";
import { normalizeProgress } from "./engine";

const LOCAL_KEY = "segmiq-guided-learning-v2";

export function loadLocalGuidedProgress(): GuidedLearningProgress {
  if (typeof window === "undefined") return normalizeProgress(null);
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return normalizeProgress(null);
    return normalizeProgress(JSON.parse(raw) as Partial<GuidedLearningProgress>);
  } catch {
    return normalizeProgress(null);
  }
}

export function saveLocalGuidedProgress(progress: GuidedLearningProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(progress));
  } catch {
    // ignore quota errors
  }
}

export function clearLocalGuidedProgress(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    // ignore
  }
}

export type GuidedProgressApiPayload = {
  progress: GuidedLearningProgress;
  source: "db" | "local" | "default";
  schemaMissing?: boolean;
};

export async function fetchGuidedProgress(): Promise<GuidedProgressApiPayload> {
  try {
    const res = await fetch("/api/sales/guided-learning", { method: "GET", cache: "no-store" });
    if (!res.ok) {
      const local = loadLocalGuidedProgress();
      return { progress: local, source: "local" };
    }
    const data = (await res.json()) as {
      progress?: GuidedLearningProgress;
      schemaMissing?: boolean;
    };
    const progress = normalizeProgress(data.progress);
    saveLocalGuidedProgress(progress);
    return {
      progress,
      source: data.schemaMissing ? "local" : "db",
      schemaMissing: data.schemaMissing,
    };
  } catch {
    return { progress: loadLocalGuidedProgress(), source: "local" };
  }
}

export async function persistGuidedProgress(
  progress: GuidedLearningProgress
): Promise<{ ok: boolean; schemaMissing?: boolean }> {
  saveLocalGuidedProgress(progress);
  try {
    const res = await fetch("/api/sales/guided-learning", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        progress: {
          ...progress,
          courseId: GUIDED_COURSE_ID,
          courseVersion: GUIDED_COURSE_VERSION,
        },
      }),
    });
    if (res.status === 503) {
      return { ok: true, schemaMissing: true };
    }
    return { ok: res.ok };
  } catch {
    return { ok: true, schemaMissing: true };
  }
}
