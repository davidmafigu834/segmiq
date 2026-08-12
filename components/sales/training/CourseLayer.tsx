"use client";

import { useEffect, useState } from "react";
import { useGuidedCourse } from "./GuidedCourseProvider";
import { CourseWelcomeModal } from "./CourseWelcomeModal";
import { CourseCoachmark } from "./CourseCoachmark";
import { CourseSpotlight } from "./CourseSpotlight";
import { CourseHud } from "./CourseHud";
import { CourseProgressPanel } from "./CourseProgressPanel";
import { CourseLessonComplete } from "./CourseLessonComplete";
import { CourseCompletionModal } from "./CourseCompletionModal";
import { findCourseTarget } from "@/lib/sales/training/course-targets";

export function CourseLayer({ isExistingUser }: { isExistingUser?: boolean }) {
  const {
    ready,
    uiMode,
    activeStep,
    isMobile,
    pause,
  } = useGuidedCourse();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const [overlayNudge, setOverlayNudge] = useState(false);

  const targetId =
    activeStep && (uiMode === "active" || uiMode === "practice")
      ? isMobile && activeStep.mobileTarget
        ? activeStep.mobileTarget
        : activeStep.target
      : undefined;

  useEffect(() => {
    if (!targetId) {
      setTargetRect(null);
      setTargetMissing(false);
      return;
    }

    let attempts = 0;
    let raf = 0;
    let ro: ResizeObserver | null = null;

    const measure = () => {
      const el = findCourseTarget(targetId);
      if (!el) {
        attempts += 1;
        if (attempts > 40) {
          setTargetMissing(true);
          setTargetRect(null);
          if (process.env.NODE_ENV === "development") {
            console.warn("[guided-learning] target missing", {
              targetId,
              step: activeStep?.id,
              lesson: activeStep?.lessonId,
            });
          }
          return;
        }
        raf = window.requestAnimationFrame(measure);
        return;
      }
      setTargetMissing(false);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const rect = el.getBoundingClientRect();
      const inView =
        rect.top >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.left >= 0 &&
        rect.right <= window.innerWidth;
      if (!inView) {
        el.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: reduceMotion ? "auto" : "smooth",
        });
      }
      setTargetRect(el.getBoundingClientRect());
      el.focus?.({ preventScroll: true });
    };

    measure();
    const onRefresh = () => measure();
    window.addEventListener("resize", onRefresh);
    window.addEventListener("scroll", onRefresh, true);
    ro = new ResizeObserver(onRefresh);
    ro.observe(document.body);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onRefresh);
      window.removeEventListener("scroll", onRefresh, true);
      ro?.disconnect();
    };
  }, [targetId, activeStep?.id, activeStep?.lessonId]);

  useEffect(() => {
    if (uiMode !== "active" && uiMode !== "practice") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        pause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [uiMode, pause]);

  if (!ready) return null;

  return (
    <>
      {uiMode === "welcome" ? <CourseWelcomeModal isExistingUser={isExistingUser} /> : null}

      {(uiMode === "active" || uiMode === "practice") && activeStep ? (
        <>
          <CourseSpotlight
            rect={targetRect}
            missing={targetMissing}
            onBlockedClick={() => {
              setOverlayNudge(true);
              window.setTimeout(() => setOverlayNudge(false), 1800);
            }}
          />
          <CourseCoachmark
            step={activeStep}
            rect={targetRect}
            targetMissing={targetMissing}
            overlayNudge={overlayNudge}
          />
          <CourseHud />
          {!isMobile ? <CourseProgressPanel /> : null}
        </>
      ) : null}

      {uiMode === "paused" ? <CourseHud collapsed /> : null}
      {uiMode === "lesson_complete" ? <CourseLessonComplete /> : null}
      {uiMode === "course_complete" ? <CourseCompletionModal /> : null}
    </>
  );
}
