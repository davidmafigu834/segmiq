"use client";

import Image from "next/image";
import { AlertTriangle, LogOut, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import {
  PRELOADER_COPY,
  type SegmiQPreloaderVariant,
} from "./preloader-copy";
import styles from "./SegmiQPreloader.module.css";

export { PRELOADER_COPY } from "./preloader-copy";
export type { SegmiQPreloaderVariant } from "./preloader-copy";
export type SegmiQPreloaderState = "loading" | "error" | "offline";

type SegmiQPreloaderProps = {
  active?: boolean;
  variant?: SegmiQPreloaderVariant;
  state?: SegmiQPreloaderState;
  title?: string;
  description?: string;
  onRetry?: () => void;
  onSignOut?: () => void;
};

type Visibility = "hidden" | "waiting" | "visible" | "exiting";

const SHOW_DELAY_MS = 180;
const EXIT_DURATION_MS = 200;

function PipelineJourney() {
  return (
    <div className={styles.pipelineWrap} aria-hidden="true">
      <svg
        className={styles.pipeline}
        viewBox="0 0 640 126"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="segmiq-loader-line" x1="0" x2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.08" />
            <stop offset="0.12" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="0.88" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        <path className={styles.baseLine} d="M48 45H592" />
        <path className={styles.liveLine} d="M320 45H456" />

        <g className={styles.inactiveNode} transform="translate(48 45)">
          <circle className={styles.nodeOuter} r="10" />
          <circle className={styles.nodeInnerStrong} r="5" />
        </g>
        <g className={styles.inactiveNode} transform="translate(184 45)">
          <circle className={styles.nodeOuter} r="10" />
          <circle className={styles.nodeInnerStrong} r="5" />
        </g>

        <g className={styles.activeRings} transform="translate(320 45)">
          <circle className={`${styles.pulseRing} ${styles.pulseRingOne}`} r="18" />
          <circle className={`${styles.pulseRing} ${styles.pulseRingTwo}`} r="29" />
          <circle className={`${styles.pulseRing} ${styles.pulseRingThree}`} r="41" />
        </g>
        <g className={styles.activeNode} transform="translate(320 45)">
          <circle className={styles.activeHalo} r="15" />
          <circle className={styles.activeOuter} r="11" />
          <circle className={styles.activeInner} r="6" />
        </g>

        <g className={styles.inactiveNode} transform="translate(456 45)">
          <circle className={styles.nodeOuter} r="10" />
          <circle className={styles.nodeInner} r="4.5" />
          <circle className={styles.receiveGlow} r="13" />
        </g>
        <g className={styles.futureNode} transform="translate(592 45)">
          <circle className={styles.futureOuter} r="10" />
          <circle className={styles.futureInner} r="3.5" />
        </g>

        <path
          className={styles.heartbeatBase}
          d="M330 45H350L357 36L365 54L374 25L383 55L391 40L399 45H422"
        />
        <path
          className={styles.heartbeat}
          pathLength="1"
          d="M330 45H350L357 36L365 54L374 25L383 55L391 40L399 45H422"
        />
        <circle className={styles.signalDot} cx="48" cy="45" r="3.5" />

        <g className={styles.stageLabels}>
          <text x="48" y="105" textAnchor="middle">
            Capture
          </text>
          <text x="184" y="105" textAnchor="middle">
            Qualify
          </text>
          <rect className={styles.activeLabelPill} x="289" y="88" width="62" height="25" rx="12.5" />
          <text className={styles.activeLabel} x="320" y="105" textAnchor="middle">
            Deal
          </text>
          <text x="456" y="105" textAnchor="middle">
            Follow up
          </text>
          <text x="592" y="105" textAnchor="middle">
            Close
          </text>
        </g>
      </svg>
    </div>
  );
}

function BrandWordmark() {
  return (
    <div className={styles.wordmark} aria-label="SegmiQ">
      <Image
        className={styles.logoLight}
        src="/segmiq-wordmark-black.png"
        alt="SegmiQ"
        width={400}
        height={100}
        priority
      />
      <Image
        className={styles.logoDark}
        src="/segmiq-wordmark.png"
        alt=""
        width={400}
        height={100}
        priority
        aria-hidden="true"
      />
    </div>
  );
}

export function SegmiQPreloader({
  active = true,
  variant = "workspace",
  state = "loading",
  title,
  description,
  onRetry,
  onSignOut,
}: SegmiQPreloaderProps) {
  const [visibility, setVisibility] = useState<Visibility>(active ? "waiting" : "hidden");
  const copy = PRELOADER_COPY[variant];
  const isLoading = state === "loading";
  const resolvedTitle =
    title ??
    (state === "error"
      ? "We couldn't prepare your workspace."
      : state === "offline"
        ? "You're offline"
        : copy.title);
  const resolvedDescription =
    description ??
    (state === "error"
      ? "Check your connection and try again."
      : state === "offline"
        ? "Reconnect to continue loading SegmiQ."
        : copy.description);

  useEffect(() => {
    if (active) {
      setVisibility("waiting");
      const showTimer = window.setTimeout(() => setVisibility("visible"), SHOW_DELAY_MS);
      return () => window.clearTimeout(showTimer);
    }

    setVisibility((current) => (current === "visible" ? "exiting" : "hidden"));
    const exitTimer = window.setTimeout(() => setVisibility("hidden"), EXIT_DURATION_MS);
    return () => window.clearTimeout(exitTimer);
  }, [active]);

  if (visibility === "hidden" || visibility === "waiting") return null;

  return (
    <div
      className={styles.root}
      data-visibility={visibility}
      data-loader-state={state}
      role="status"
      aria-live="polite"
      aria-busy={isLoading}
      aria-label={
        isLoading ? "Preparing your SegmiQ workspace." : `${resolvedTitle} ${resolvedDescription}`
      }
    >
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.dotField} aria-hidden="true" />

      <div className={styles.content}>
        <BrandWordmark />

        {isLoading ? (
          <PipelineJourney />
        ) : (
          <div className={styles.errorVisual} aria-hidden="true">
            {state === "offline" ? <WifiOff /> : <AlertTriangle />}
          </div>
        )}

        <div className={styles.copy}>
          <h1>{resolvedTitle}</h1>
          <p>{resolvedDescription}</p>
        </div>

        {isLoading ? (
          <div className={styles.statusDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className={styles.actions}>
            {onRetry ? (
              <button type="button" className={styles.primaryAction} onClick={onRetry}>
                <RefreshCw aria-hidden="true" />
                Try again
              </button>
            ) : null}
            {onSignOut ? (
              <button type="button" className={styles.secondaryAction} onClick={onSignOut}>
                <LogOut aria-hidden="true" />
                Sign out
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default SegmiQPreloader;
