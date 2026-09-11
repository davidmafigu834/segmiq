"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { shouldTreatApi401AsSessionExpiry } from "@/lib/auth/session-expiry-client";

const LOGOUT_CHANNEL = "segmiq-auth";
const EXPIRED_EVENT = "segmiq:session-expired";

const PUBLIC_PREFIXES = [
  "/login",
  "/cloud/login",
  "/signup",
  "/cloud/signup",
  "/p/",
  "/quote/",
  "/proposal/",
  "/lead/",
  "/forgot-password",
  "/reset-password",
  "/blog",
];

function isPublicPath(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p));
}

/**
 * Central session-expired UX: redirect once, multi-tab logout signal, API 401 handling.
 * Does not wipe in-progress local React state until navigation — drafts in uncontrolled
 * inputs may still be lost on hard redirect; prefer showing the banner first.
 */
export function SessionLifecycle() {
  const { data: session, status } = useSession();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [banner, setBanner] = useState(false);
  const handling = useRef(false);
  const wasAuthed = useRef(false);

  useEffect(() => {
    if (status === "authenticated" && session?.userId) {
      wasAuthed.current = true;
    }
  }, [status, session?.userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onExpired = () => {
      if (handling.current || isPublicPath(pathname)) return;
      handling.current = true;
      setBanner(true);
      try {
        localStorage.setItem("segmiq:logout", String(Date.now()));
        const bc = new BroadcastChannel(LOGOUT_CHANNEL);
        bc.postMessage({ type: "logout" });
        bc.close();
      } catch {
        /* ignore */
      }
      void signOut({
        callbackUrl: `/login?reason=session&next=${encodeURIComponent(pathname)}`,
      });
    };

    window.addEventListener(EXPIRED_EVENT, onExpired);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "segmiq:logout") onExpired();
    };
    window.addEventListener("storage", onStorage);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(LOGOUT_CHANNEL);
      bc.onmessage = (ev) => {
        if (ev.data?.type === "logout") onExpired();
      };
    } catch {
      /* ignore */
    }

    const origFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await origFetch(...args);
      if (res.status === 401 && wasAuthed.current && !isPublicPath(pathname)) {
        const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : "";
        if (shouldTreatApi401AsSessionExpiry(url)) {
          window.dispatchEvent(new Event(EXPIRED_EVENT));
        }
      }
      return res;
    };

    return () => {
      window.removeEventListener(EXPIRED_EVENT, onExpired);
      window.removeEventListener("storage", onStorage);
      window.fetch = origFetch;
      bc?.close();
    };
  }, [pathname, router]);

  useEffect(() => {
    if (status === "unauthenticated" && wasAuthed.current && !isPublicPath(pathname)) {
      window.dispatchEvent(new Event(EXPIRED_EVENT));
    }
  }, [status, pathname]);

  if (!banner) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
    >
      Your session has expired. Please sign in again.
    </div>
  );
}

/** Call before next-auth signOut so the server session is revoked. */
export async function secureSignOut(callbackUrl = "/login"): Promise<void> {
  try {
    await fetch("/api/auth/session/logout", { method: "POST", credentials: "include" });
  } catch {
    /* still clear client cookie */
  }
  try {
    localStorage.setItem("segmiq:logout", String(Date.now()));
    const bc = new BroadcastChannel(LOGOUT_CHANNEL);
    bc.postMessage({ type: "logout" });
    bc.close();
  } catch {
    /* ignore */
  }
  await signOut({ callbackUrl });
}
