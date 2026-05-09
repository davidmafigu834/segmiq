import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { MapPin, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ViewRecorder } from "./ViewRecorder";
import { getCategoryStyle } from "@/app/cloud/lib/category-styles";
import { ShareViewSwitcher } from "./ShareViewSwitcher";

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export const dynamic = "force-dynamic";

type MediaItem = { id: string; public_url: string; display_order: number; caption: string | null };

export async function generateMetadata({ params }: { params: { projectId: string } }): Promise<Metadata> {
  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("title, description, project_media(public_url, display_order)")
    .or(`id.eq.${params.projectId},slug.eq.${params.projectId}`)
    .maybeSingle();
  if (!project) return { title: "Project | Leadstaq Cloud" };
  const media = (project.project_media as MediaItem[] | null) ?? [];
  const cover = media.sort((a, b) => a.display_order - b.display_order)[0]?.public_url;
  return {
    title: `${project.title as string} | Leadstaq Cloud`,
    description: (project.description as string | null) ?? undefined,
    openGraph: {
      title: project.title as string,
      description: (project.description as string | null) ?? undefined,
      images: cover ? [{ url: cover }] : [],
    },
  };
}

export default async function CloudSharePage({ params }: { params: { projectId: string } }) {
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, clients(name, primary_color, slug, logo_url)")
    .or(`id.eq.${params.projectId},slug.eq.${params.projectId}`)
    .eq("is_public", true)
    .maybeSingle();

  if (!project) notFound();

  const { data: rawMedia } = await supabase
    .from("project_media")
    .select("id, public_url, display_order, caption")
    .eq("project_id", project.id as string)
    .order("display_order", { ascending: true });

  type MilestoneMedia = { id: string; public_url: string; caption: string | null; display_order: number };
  type MilestoneRow = { id: string; title: string; description: string | null; milestone_date: string; display_order: number; is_completed: boolean; project_media: MilestoneMedia[] };
  const { data: rawMilestones } = await supabase
    .from("project_milestones")
    .select("id, title, description, milestone_date, display_order, is_completed, project_media(id, public_url, caption, display_order)")
    .eq("project_id", project.id as string)
    .order("milestone_date", { ascending: true });
  const milestones = (rawMilestones ?? []) as MilestoneRow[];

  const client = project.clients as { name: string; primary_color: string | null; slug: string; logo_url: string | null } | null;
  const media = (rawMedia ?? []) as MediaItem[];
  const cover = media[0]?.public_url;

  type ClientProfileRow = {
    slug?: string;
    watermark_enabled?: boolean;
    watermark_position?: string;
    watermark_opacity?: number;
    watermark_size?: string;
  };
  const clientProfile = project.client_id
    ? await (async () => {
        const { data: cp } = await supabase
          .from("client_profiles")
          .select("slug, watermark_enabled, watermark_position, watermark_opacity, watermark_size")
          .eq("client_id", project.client_id as string)
          .maybeSingle();
        return cp as ClientProfileRow | null;
      })()
    : null;

  const profileSlug = clientProfile?.slug ?? client?.slug ?? null;
  const logoUrl = client?.logo_url ?? null;
  const watermarkConfig = clientProfile?.watermark_enabled && logoUrl
    ? {
        logoUrl,
        position: (clientProfile.watermark_position ?? "bottom-right") as "bottom-right" | "bottom-left" | "bottom-center" | "center",
        opacity: clientProfile.watermark_opacity ?? 40,
        size: (clientProfile.watermark_size ?? "small") as "small" | "medium" | "large",
      }
    : null;

  const cat = getCategoryStyle(project.category as string | null);
  const clientName = client?.name ?? "";
  const descriptionText = project.description as string | null;
  const showDescription =
    descriptionText &&
    descriptionText.trim() !== "" &&
    descriptionText.trim() !== "Everything";
  const ctaProfileSlug = profileSlug ?? client?.slug ?? null;


  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F7F4EF",
        fontFamily: "var(--fw-font-body), system-ui, sans-serif",
      }}
    >
      <style>{`
        .sp-nav { padding: 0 24px; }
        .sp-nav-lc { display: inline-flex; }
        .sp-meta { padding: 14px 24px; }
        .sp-desc-inner { padding: 28px 24px 0; }
        .sp-gallery { padding: 28px 20px; }
        .sp-cta { padding: 56px 24px; }
        .sp-footer { padding: 16px 24px; }
        @media (max-width: 600px) {
          .sp-nav { padding: 0 16px; }
          .sp-nav-lc { display: none; }
          .sp-meta { padding: 12px 16px; flex-wrap: wrap; gap: 8px !important; }
          .sp-desc-inner { padding: 20px 16px 0; max-width: 100% !important; }
          .sp-gallery { padding: 20px 16px; }
          .sp-cta { padding: 40px 20px; }
          .sp-footer { padding: 14px 16px; }
        }
      `}</style>
      <ViewRecorder projectId={project.id as string} />

      {/* ── Section 1: Navbar ── */}
      <nav
        className="sp-nav"
        style={{
          height: 56,
          background: "#FFFFFF",
          borderBottom: "0.5px solid rgba(28,20,16,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Left — logo + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#1C1410", color: "#D4FF4F",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              flexShrink: 0,
            }}
          >
            {getInitials(clientName || "L")}
          </div>
          {clientName && (
            <span
              style={{
                fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                fontSize: 13, fontWeight: 600, color: "#1C1410",
              }}
            >
              {clientName}
            </span>
          )}
        </div>

        {/* Right — brand link + CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/cloud"
            className="sp-nav-lc"
            style={{
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              fontSize: 11, color: "#8C7B6B", textDecoration: "none",
            }}
          >
            Leadstaq Cloud
          </Link>
          <a
            href="#cta"
            style={{
              height: 36, padding: "0 18px",
              background: "#1C1410", color: "#D4FF4F",
              border: "none", borderRadius: 10,
              fontSize: 12, fontWeight: 700,
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              cursor: "pointer", textDecoration: "none",
              display: "inline-flex", alignItems: "center",
            }}
          >
            Get a Quote
          </a>
        </div>
      </nav>

      {/* ── Section 2: Hero ── */}
      <div
        style={{
          width: "100%",
          height: "clamp(260px, 45vw, 420px)",
          position: "relative",
          overflow: "hidden",
          background: cover ? "#1C1410" : "linear-gradient(135deg, #1C1410 0%, #2E2218 100%)",
        }}
      >
        {cover && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={cover}
            alt={project.title as string}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
          />
        )}
        <div
          style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(28,20,16,0.85) 0%, rgba(28,20,16,0.2) 50%, transparent 100%)",
          }}
        />
        <div style={{ position: "absolute", bottom: 28, left: 28, right: 28 }}>
          <h1
            style={{
              fontFamily: "var(--fw-font-display), Georgia, serif",
              fontSize: "clamp(28px, 5vw, 44px)",
              color: "#FFFFFF", margin: 0, lineHeight: 1.1, letterSpacing: "-0.01em",
            }}
          >
            {project.title as string}
          </h1>
        </div>
      </div>

      {/* ── Section 3: Metadata row ── */}
      <div
        className="sp-meta"
        style={{
          background: "#FFFFFF",
          borderBottom: "0.5px solid rgba(28,20,16,0.06)",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}
      >
        {project.category && (
          <span
            style={{
              height: 26, padding: "0 12px",
              background: cat.sceneBg, color: cat.labelColor,
              borderRadius: 20, fontSize: 11, fontWeight: 700,
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              letterSpacing: "0.04em", textTransform: "uppercase",
              display: "inline-flex", alignItems: "center",
            }}
          >
            {project.category as string}
          </span>
        )}
        {project.location && (
          <span
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 13, color: "#4A3828",
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
            }}
          >
            <MapPin size={13} color="#8C7B6B" />
            {project.location as string}
          </span>
        )}
        {project.completion_date && (
          <span
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 13, color: "#4A3828",
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
            }}
          >
            <Calendar size={13} color="#8C7B6B" />
            {formatDate(project.completion_date as string)}
          </span>
        )}
        <span
          style={{
            marginLeft: "auto", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: "#8C7B6B",
            fontFamily: "var(--fw-font-body), system-ui, sans-serif",
          }}
        >
          {media.length} {media.length === 1 ? "Photo" : "Photos"}
        </span>
      </div>

      {/* ── Section 4: Description (conditional) ── */}
      {showDescription && (
        <div style={{ background: "#FFFFFF", paddingBottom: 28 }}>
          <div className="sp-desc-inner" style={{ maxWidth: 720, margin: "0 auto" }}>
            <p
              style={{
                fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                fontSize: 16, color: "#1C1410", lineHeight: 1.75, margin: 0,
              }}
            >
              {descriptionText}
            </p>
          </div>
        </div>
      )}

      {/* ── Section 5: Photo gallery ── */}
      {media.length > 0 && (
        <div className="sp-gallery" style={{ background: "#F7F4EF" }}>
          <p
            style={{
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#8C7B6B", margin: "0 0 16px",
            }}
          >
            Photos · {media.length}
          </p>
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <ShareViewSwitcher media={media} milestones={milestones} watermark={watermarkConfig} />
          </div>
        </div>
      )}

      {/* ── Section 6: CTA ── */}
      <div
        id="cta"
        className="sp-cta"
        style={{ background: "#1C1410", textAlign: "center" }}
      >
        <div
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(212,255,79,0.1)",
            border: "0.5px solid rgba(212,255,79,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", overflow: "hidden",
          }}
        >
          <span
            style={{
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              fontSize: 16, fontWeight: 700, color: "#D4FF4F",
            }}
          >
            {getInitials(clientName || "L")}
          </span>
        </div>

        <h2
          style={{
            fontFamily: "var(--fw-font-display), Georgia, serif",
            fontSize: "clamp(24px, 4vw, 36px)",
            color: "#FFFFFF", margin: "0 0 12px", lineHeight: 1.2,
          }}
        >
          Interested in a project like this?
        </h2>

        <p
          style={{
            fontFamily: "var(--fw-font-body), system-ui, sans-serif",
            fontSize: 15, color: "rgba(255,255,255,0.55)",
            margin: "0 auto 32px", maxWidth: 400, lineHeight: 1.6,
          }}
        >
          Get a free quote from {clientName || "us"} today.
        </p>

        {ctaProfileSlug && (
          <a
            href={`/p/${ctaProfileSlug}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              height: 52, padding: "0 28px",
              background: "#D4FF4F", color: "#1C1410",
              borderRadius: 14, fontSize: 15, fontWeight: 700,
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              textDecoration: "none",
            }}
          >
            Get a Free Quote
            <ArrowRight size={16} />
          </a>
        )}
      </div>

      {/* ── Section 7: Footer ── */}
      <div
        className="sp-footer"
        style={{
          background: "#1C1410",
          borderTop: "0.5px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <p
          style={{
            fontFamily: "var(--fw-font-body), system-ui, sans-serif",
            fontSize: 11, color: "rgba(255,255,255,0.25)", margin: 0, textAlign: "center",
          }}
        >
          {clientName} &middot; Powered by{" "}
          <a
            href="https://cloud.leadstaq.tech"
            style={{ color: "rgba(212,255,79,0.5)", textDecoration: "none" }}
          >
            Leadstaq Cloud
          </a>
        </p>
      </div>
    </div>
  );
}
