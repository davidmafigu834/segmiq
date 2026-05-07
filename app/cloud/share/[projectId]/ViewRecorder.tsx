"use client";

import { useEffect } from "react";

export function ViewRecorder({ projectId }: { projectId: string }) {
  useEffect(() => {
    const visitorKey = "lq_vid";
    let visitorId = localStorage.getItem(visitorKey);
    if (!visitorId) {
      visitorId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(visitorKey, visitorId);
    }
    fetch(`/api/cloud/projects/${projectId}/views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitor_id: visitorId,
        referrer: document.referrer || null,
      }),
    }).catch(() => {});
  }, [projectId]);

  return null;
}
