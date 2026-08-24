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

function PulseRing({
  delay,
  from,
  to,
}: {
  delay: string;
  from: number;
  to: number;
}) {
  return (
    <circle className={styles.pulseRing} cx="320" cy="45" r={from} opacity="0">
      <animate attributeName="r" values={`${from};${to}`} dur="2.2s" begin={delay} repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;0.2;0" dur="2.2s" begin={delay} repeatCount="indefinite" />
    </circle>
  );
}

function PipelineJourney() {
  const beat = "M330 45H350L357 36L365 54L374 25L383 55L391 40L399 45H422";

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

        <circle className={styles.nodeOuter} cx="48" cy="45" r="10" />
        <circle className={styles.nodeInnerStrong} cx="48" cy="45" r="5" />
        <circle className={styles.nodeOuter} cx="184" cy="45" r="10" />
        <circle className={styles.nodeInnerStrong} cx="184" cy="45" r="5" />

        <PulseRing delay="0s" from={12} to={22} />
        <PulseRing delay="0.36s" from={16} to={32} />
        <PulseRing delay="0.72s" from={22} to={42} />

        <circle className={styles.activeHalo} cx="320" cy="45" r="15" />
        <circle className={styles.activeOuter} cx="320" cy="45" r="11" />
        <circle className={styles.activeInner} cx="320" cy="45" r="6" />

        <circle className={styles.receiveGlow} cx="456" cy="45" r="10">
          <animate
            attributeName="r"
            values="10;18;10"
            dur="2.45s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;0;0.28;0;0"
            keyTimes="0;0.58;0.67;0.84;1"
            dur="2.45s"
            repeatCount="indefinite"
          />
        </circle>
        <circle className={styles.nodeOuter} cx="456" cy="45" r="10" />
        <circle className={styles.nodeInner} cx="456" cy="45" r="4.5" />

        <circle className={styles.futureOuter} cx="592" cy="45" r="10" />
        <circle className={styles.futureInner} cx="592" cy="45" r="3.5" />

        <path className={styles.heartbeatBase} d={beat} />
        <path
          className={styles.heartbeat}
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset="1"
          d={beat}
        >
          <animate
            attributeName="stroke-dashoffset"
            values="1;1;0;-1;-1"
            keyTimes="0;0.16;0.62;0.78;1"
            dur="2.45s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;0;1;1;0;0"
            keyTimes="0;0.16;0.28;0.62;0.78;1"
            dur="2.45s"
            repeatCount="indefinite"
          />
        </path>

        <g opacity="0">
          <animate
            attributeName="opacity"
            values="0;0;0.9;0.9;0;0"
            keyTimes="0;0.08;0.14;0.48;0.55;1"
            dur="6s"
            repeatCount="indefinite"
          />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0 0;544 0;544 0"
            keyTimes="0;0.08;0.55;1"
            dur="6s"
            repeatCount="indefinite"
          />
          <circle className={styles.signalDot} cx="48" cy="45" r="3.5" />
        </g>

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
      data-allow-motion=""
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
