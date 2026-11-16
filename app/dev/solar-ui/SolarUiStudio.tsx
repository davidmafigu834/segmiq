"use client";

import { useEffect, useState } from "react";
import { COMPANIES, type CompanyId } from "./desk";
import { MockFrame } from "./MockFrame";
import { asScreen, type Screen } from "./nav";
import { ScreenBody } from "./screens";
import "../real-estate-ui/mock.css";
import "./studio.css";

export function SolarUiStudio({ initialScreen }: { initialScreen?: string }) {
  const [screen, setScreen] = useState<Screen>(asScreen(initialScreen));
  const [focus, setFocus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);
  const [companyId, setCompanyId] = useState<CompanyId>(COMPANIES[0].id);

  useEffect(() => {
    setDark(window.localStorage.getItem("solar-mock-theme") === "dark");
  }, []);

  function toggleDark() {
    setDark((value) => {
      const next = !value;
      window.localStorage.setItem("solar-mock-theme", next ? "dark" : "light");
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
    <MockFrame screen={screen} dark={dark} companyId={companyId} onCompany={setCompanyId} onNavigate={open} onToggleDark={toggleDark} onReplay={replay}>
      <ScreenBody screen={screen} loading={loading} focus={focus} dark={dark} companyId={companyId} onToggleDark={toggleDark} onOpen={open} />
    </MockFrame>
  );
}
