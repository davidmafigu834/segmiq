"use client";

import { useEffect, useState } from "react";
import { asScreen, type Screen } from "./nav";
import { MockFrame } from "./MockFrame";
import { ScreenBody } from "./screens";
import "../real-estate-ui/mock.css";
import "./studio.css";

export function SuperadminUiStudio({ initialScreen }: { initialScreen?: string }) {
  const [screen, setScreen] = useState<Screen>(asScreen(initialScreen));
  const [focus, setFocus] = useState<string | null>(initialScreen === "organisation" ? "charter" : null);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(window.localStorage.getItem("sa-mock-theme") === "dark");
  }, []);

  function toggleDark() {
    setDark((value) => {
      const next = !value;
      window.localStorage.setItem("sa-mock-theme", next ? "dark" : "light");
      return next;
    });
  }

  function open(next: Screen, id?: string) {
    setFocus(id ?? null);
    setScreen(next);
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("screen") !== screen) {
      url.searchParams.set("screen", screen);
      window.history.replaceState(null, "", url.toString());
    }
    document.querySelector(".re-scroll")?.scrollTo({ top: 0 });
    const timer = window.setTimeout(() => setLoading(false), 700);
    return () => window.clearTimeout(timer);
  }, [screen]);

  function replay() {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 700);
  }

  return (
    <MockFrame screen={screen} dark={dark} onNavigate={open} onToggleDark={toggleDark} onReplay={replay}>
      <ScreenBody screen={screen} loading={loading} focus={focus} dark={dark} onToggleDark={toggleDark} onOpen={open} />
    </MockFrame>
  );
}
