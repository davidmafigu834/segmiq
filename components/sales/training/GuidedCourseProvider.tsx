"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  canManualAdvance,
  completeCurrentStep,
  DEFAULT_CAPABILITIES,
  disableAutoWelcome,
  dismissWelcome,
  goToPreviousStep,
  hideDashboardCard,
  replayLesson,
  resolveStep,
  skipLesson,
  startCourse,
  stepAcceptsEvent,
  stepIndex,
  completedLessonCount,
  totalLessonCount,
  type CourseCapabilities,
} from "@/lib/sales/training/engine";
import {
  courseEventForPathname,
  subscribeCourseEvents,
} from "@/lib/sales/training/course-events";
import {
  fetchGuidedProgress,
  persistGuidedProgress,
} from "@/lib/sales/training/progress-client";
import {
  createPracticeSeed,
  type PracticeScenarioState,
} from "@/lib/sales/training/practice/practice-state";
import {
  defaultGuidedProgress,
  type CourseEventName,
  type CourseStep,
  type GuidedCourseUiMode,
  type GuidedLearningProgress,
  type PracticeScenarioId,
} from "@/lib/sales/training/types";
import { orderedSegmiq2Lessons } from "@/lib/sales/training/courses/segmiq-2";
import { CourseLayer } from "./CourseLayer";
import { PracticeScenarioHost } from "./practice/PracticeScenarioHost";

type GuidedCourseContextValue = {
  ready: boolean;
  progress: GuidedLearningProgress;
  uiMode: GuidedCourseUiMode;
  activeStep: CourseStep | null;
  stepProgress: { index: number; total: number };
  lessonProgressLabel: string;
  caps: CourseCapabilities;
  practice: PracticeScenarioState;
  setPractice: React.Dispatch<React.SetStateAction<PracticeScenarioState>>;
  activePracticeScenario: PracticeScenarioId | null;
  isMobile: boolean;
  start: (lessonId?: string) => void;
  continueCourse: () => void;
  pause: () => void;
  exit: () => void;
  dismissWelcomeLater: () => void;
  neverAutoShow: () => void;
  hideCard: () => void;
  next: () => void;
  back: () => void;
  skipCurrentLesson: () => void;
  replay: (lessonId: string) => void;
  acknowledgeOverlay: () => void;
};

const GuidedCourseContext = createContext<GuidedCourseContextValue | null>(null);

function useIsMobileLayout() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mobile;
}

export function GuidedCourseProvider({
  children,
  capabilities,
  isExistingUser = false,
}: {
  children: ReactNode;
  capabilities?: Partial<CourseCapabilities>;
  /** Existing upgraded users see "Meet SegmiQ 2.0" copy */
  isExistingUser?: boolean;
}) {
  const caps = useMemo(
    () => ({ ...DEFAULT_CAPABILITIES, ...capabilities }),
    [capabilities]
  );
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobileLayout();

  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<GuidedLearningProgress>(defaultGuidedProgress);
  const [uiMode, setUiMode] = useState<GuidedCourseUiMode>("idle");
  const [practice, setPractice] = useState<PracticeScenarioState>(() => createPracticeSeed());
  const [sessionWelcomeShown, setSessionWelcomeShown] = useState(false);

  const persist = useCallback((next: GuidedLearningProgress) => {
    setProgress(next);
    void persistGuidedProgress(next);
  }, []);

  const activeStep = useMemo(() => resolveStep(progress, caps), [progress, caps]);
  const stepProgress = useMemo(() => {
    if (!progress.currentLessonId || !activeStep) return { index: 0, total: 0 };
    return stepIndex(progress.currentLessonId, activeStep.id, caps);
  }, [progress.currentLessonId, activeStep, caps]);

  const lessonProgressLabel = useMemo(() => {
    const total = totalLessonCount(caps);
    const done = completedLessonCount(progress);
    const lessons = orderedSegmiq2Lessons();
    const currentIdx = lessons.findIndex((l) => l.id === progress.currentLessonId);
    const lessonNum = currentIdx >= 0 ? currentIdx + 1 : Math.min(done + 1, total);
    return `Lesson ${lessonNum} of ${total}`;
  }, [progress, caps]);

  const activePracticeScenario: PracticeScenarioId | null =
    uiMode === "active" || uiMode === "practice"
      ? activeStep?.practiceScenario ?? null
      : null;

  const applyStart = useCallback(
    (lessonId?: string) => {
      setPractice(createPracticeSeed());
      const next = startCourse(progress, caps, lessonId);
      persist(next);
      setUiMode("active");
      const step = resolveStep(next, caps);
      if (step?.route) {
        const target = step.route;
        if (!pathname.startsWith(target.replace(/\/$/, ""))) {
          router.push(target);
        }
      }
    },
    [progress, caps, persist, pathname, router]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { progress: loaded } = await fetchGuidedProgress();
      if (cancelled) return;
      setProgress(loaded);
      setReady(true);

      const debugLesson =
        process.env.NODE_ENV === "development" && typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("courseDebug")
          : null;

      if (debugLesson) {
        const next = startCourse(loaded, caps, debugLesson);
        setProgress(next);
        void persistGuidedProgress(next);
        setUiMode("active");
        return;
      }

      const shouldWelcome =
        loaded.autoShowWelcome &&
        !loaded.welcomeDismissedAt &&
        (loaded.status === "NOT_STARTED" || loaded.status === "DISMISSED") &&
        !sessionWelcomeShown;

      if (shouldWelcome) {
        setUiMode("welcome");
        setSessionWelcomeShown(true);
      } else if (loaded.status === "IN_PROGRESS" && loaded.currentStepId) {
        // Resume quietly — user continues via card / HUD, not forced overlay every load
        setUiMode("paused");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only
  }, []);

  const eventRef = useRef({ uiMode, progress, caps, persist });
  eventRef.current = { uiMode, progress, caps, persist };

  const handleCourseEvent = useCallback((event: CourseEventName) => {
    const { uiMode: mode, progress: prog, caps: c, persist: save } = eventRef.current;
    if (mode !== "active" && mode !== "practice") return;
    const step = resolveStep(prog, c);
    if (!step) return;
    if (!stepAcceptsEvent(step, event)) return;

    const next = completeCurrentStep(prog, c);
    save(next);

    const resolved = resolveStep(next, c);
    if (
      prog.currentLessonId &&
      next.completedLessonIds.includes(prog.currentLessonId) &&
      next.currentLessonId !== prog.currentLessonId
    ) {
      setUiMode("lesson_complete");
      return;
    }
    if (next.status === "COMPLETED" && (!resolved || resolved.type === "COMPLETE")) {
      setUiMode(resolved?.type === "COMPLETE" ? "active" : "course_complete");
      return;
    }
    setUiMode(resolved?.practiceScenario ? "practice" : "active");
  }, []);

  useEffect(() => subscribeCourseEvents((event) => handleCourseEvent(event)), [handleCourseEvent]);

  useEffect(() => {
    const navEvent = courseEventForPathname(pathname);
    if (!navEvent) return;
    if (uiMode !== "active" && uiMode !== "practice") return;
    handleCourseEvent(navEvent);
  }, [pathname, uiMode, handleCourseEvent]);

  // Route prefer when step becomes active
  useEffect(() => {
    if (uiMode !== "active" && uiMode !== "practice") return;
    if (!activeStep?.route) return;
    const desired = activeStep.route;
    if (pathname === desired || pathname.startsWith(`${desired}/`)) return;
    // Only auto-push for intro/explanation on dashboard start — not for NAVIGATION (user must click)
    if (activeStep.type === "INTRO" || activeStep.type === "EXPLANATION") {
      if (desired === "/sales/dashboard" && (pathname === "/solo/dashboard" || pathname === "/sales/dashboard")) {
        return;
      }
    }
  }, [activeStep, uiMode, pathname]);

  useEffect(() => {
    if (!activePracticeScenario) return;
    if (uiMode === "active") setUiMode("practice");
  }, [activePracticeScenario, uiMode]);

  const value: GuidedCourseContextValue = {
    ready,
    progress,
    uiMode,
    activeStep,
    stepProgress,
    lessonProgressLabel,
    caps,
    practice,
    setPractice,
    activePracticeScenario,
    isMobile,
    start: (lessonId) => applyStart(lessonId),
    continueCourse: () => {
      if (progress.status === "NOT_STARTED" || !progress.currentLessonId) {
        applyStart();
        return;
      }
      setUiMode(activeStep?.practiceScenario ? "practice" : "active");
    },
    pause: () => setUiMode("paused"),
    exit: () => {
      persist({ ...progress, lastSeenAt: new Date().toISOString() });
      setUiMode("paused");
    },
    dismissWelcomeLater: () => {
      persist(dismissWelcome(progress));
      setUiMode("idle");
    },
    neverAutoShow: () => {
      persist(disableAutoWelcome(dismissWelcome(progress)));
      setUiMode("idle");
    },
    hideCard: () => persist(hideDashboardCard(progress)),
    next: () => {
      const step = resolveStep(progress, caps);
      if (!step || !canManualAdvance(step)) return;
      const next = completeCurrentStep(progress, caps);
      persist(next);
      if (step.type === "COMPLETE") {
        if (next.status === "COMPLETED") {
          setUiMode("course_complete");
          return;
        }
        setUiMode("lesson_complete");
        return;
      }
      const resolved = resolveStep(next, caps);
      setUiMode(resolved?.practiceScenario ? "practice" : "active");
    },
    back: () => {
      persist(goToPreviousStep(progress, caps));
    },
    skipCurrentLesson: () => {
      if (!progress.currentLessonId) return;
      const next = skipLesson(progress, progress.currentLessonId, caps);
      persist(next);
      setUiMode(next.status === "COMPLETED" ? "course_complete" : "active");
    },
    replay: (lessonId) => {
      setPractice(createPracticeSeed());
      const next = replayLesson(progress, lessonId, caps);
      persist(next);
      setUiMode("active");
    },
    acknowledgeOverlay: () => {
      // no-op advancement — subtle cue handled in overlay
    },
  };

  return (
    <GuidedCourseContext.Provider value={value}>
      {children}
      <CourseLayer isExistingUser={isExistingUser} />
      {activePracticeScenario ? (
        <PracticeScenarioHost scenario={activePracticeScenario} />
      ) : null}
    </GuidedCourseContext.Provider>
  );
}

export function useGuidedCourse() {
  const ctx = useContext(GuidedCourseContext);
  if (!ctx) {
    throw new Error("useGuidedCourse must be used within GuidedCourseProvider");
  }
  return ctx;
}

export function useGuidedCourseOptional() {
  return useContext(GuidedCourseContext);
}
