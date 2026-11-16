"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Barlow_Condensed, IBM_Plex_Mono, Newsreader } from "next/font/google";
import {
  buildProjectPdfFilename,
} from "@/lib/cloud/magazine-format";
import { buildMagazineIssue, type IssuePage, type IssuePhoto } from "@/lib/cloud/magazine-issue";
import type { ProjectMagazineData } from "@/lib/cloud/project-magazine";
import { ProjectPdfDownloadButton } from "@/components/profile/project-magazine/ProjectPdfDownloadButton";
import "./project-magazine-issue.css";

const issueSerif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--issue-serif",
});

const issueNameplate = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--issue-nameplate",
});

const issueMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--issue-mono",
});

type IssuePage = {
  id: string;
  title: string;
  node: ReactNode;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function Folio({ name, index, total }: { name: string; index: number; total: number }) {
  return (
    <p className="issue-folio">
      <span>{name}</span>
      <span>
        {pad(index)} / {pad(total)}
      </span>
    </p>
  );
}

function PhotoFrame({
  photo,
  ratio,
}: {
  photo: IssuePhoto;
  ratio: "wide" | "tile" | "square";
}) {
  return (
    <figure>
      <div className={`issue-frame issue-${ratio}`}>
        <img src={photo.url} alt={photo.caption || ""} />
      </div>
      {photo.caption ? <figcaption className="issue-caption">{photo.caption}</figcaption> : null}
    </figure>
  );
}

function DecisionList({
  heading,
  rows,
  note,
}: {
  heading: string;
  rows: { label: string; value: string }[];
  note?: string | null;
}) {
  return (
    <section className="issue-inner issue-body issue-list">
      <h2>{heading}</h2>
      {rows.length > 0 ? (
        <dl>
          {rows.map((row, index) => (
            <div key={`${row.label}-${index}`}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {note ? <p className="issue-note">{note}</p> : null}
    </section>
  );
}

function renderIssuePage(page: IssuePage, folio: ReactNode, data: ProjectMagazineData): ReactNode {
  switch (page.id) {
    case "cover":
      return (
        <section className="issue-cover">
          {page.imageUrl ? (
            <div className="issue-cover-frame">
              <img src={page.imageUrl} alt="" />
            </div>
          ) : (
            <div className="issue-cover-fallback">{page.clientName}</div>
          )}
          <div className="issue-band">
            <p className="issue-kicker">{page.kicker}</p>
            <h1>{page.title}</h1>
            {page.lead ? <p className="issue-deck">{page.lead}</p> : null}
            {folio}
          </div>
        </section>
      );
    case "record":
      return (
        <>
          <section className="issue-inner issue-body issue-story">
            <h2>On record.</h2>
            <div className="issue-grid">
              <div className="issue-prose">
                {page.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {page.quote ? (
                <blockquote className="issue-marginal">
                  {page.quote}
                  {page.quoteBy ? <cite className="issue-by">{page.quoteBy}</cite> : null}
                </blockquote>
              ) : null}
            </div>
          </section>
          {folio}
        </>
      );
    case "plate":
      return (
        <>
          <figure className="issue-wide issue-frame">
            <img src={page.photo.url} alt={page.photo.caption || ""} />
          </figure>
          {page.photo.caption ? <figcaption className="issue-caption">{page.photo.caption}</figcaption> : null}
          {folio}
        </>
      );
    case "pair":
    case "later":
      return (
        <>
          <section className="issue-inner issue-body">
            <div className="issue-pair">
              {page.photos.map((photo, index) => (
                <PhotoFrame
                  key={photo.id}
                  photo={photo}
                  ratio={page.id === "pair" && index === 1 ? "square" : page.id === "pair" ? "tile" : "tile"}
                />
              ))}
            </div>
          </section>
          {folio}
        </>
      );
    case "specs":
    case "timeline":
    case "capability":
      return (
        <>
          <DecisionList heading={page.heading} rows={page.rows} note={page.note} />
          {folio}
        </>
      );
    case "result":
      return (
        <>
          <section className="issue-inner issue-body issue-story">
            <h2>The outcome.</h2>
            <div className="issue-prose">
              {page.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
          {folio}
        </>
      );
    case "testimonial":
      return (
        <>
          <section>
            <blockquote className="issue-closer">{page.quote}</blockquote>
            {page.by ? <p className="issue-closer-note issue-by">{page.by}</p> : null}
          </section>
          {folio}
        </>
      );
    case "close":
      return (
        <>
          <section className="issue-inner issue-body issue-close">
            <h2>Request a quote.</h2>
            <div className="issue-split">
              <div className="issue-copy">
                <p>{page.clientName}. The next job starts with a conversation.</p>
                <div className="issue-actions">
                  <a className="issue-quote" href={page.contactPath}>
                    Request a quote
                  </a>
                  <Link className="issue-text-link" href={page.projectsPath}>
                    See more projects
                  </Link>
                  <ProjectPdfDownloadButton
                    className="issue-text-link"
                    pdfDownloadUrl={data.pdfDownloadUrl}
                    pdfDirectUrl={data.pdfDirectUrl}
                    fileName={buildProjectPdfFilename(data.project.title)}
                  />
                </div>
              </div>
            </div>
            <p className="issue-disclaimer">
              {[page.country, "Powered by Segmiq"].filter(Boolean).join(". ")}
            </p>
          </section>
          {folio}
        </>
      );
    default: {
      const unreachable: never = page;
      return unreachable;
    }
  }
}

function buildPages(data: ProjectMagazineData): { id: string; title: string; node: ReactNode }[] {
  const issue = buildMagazineIssue(data);
  return issue.map((page, index) => ({
    id: page.id,
    title: page.title,
    node: renderIssuePage(
      page,
      <Folio name={data.client.name} index={index + 1} total={issue.length} />,
      data
    ),
  }));
}

export function ProjectMagazineScreen({ data }: { data: ProjectMagazineData }) {
  const pages = useMemo(() => buildPages(data), [data]);
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, Math.max(pages.length - 1, 0));
  const page = pages[safeIndex];

  useEffect(() => {
    setIndex(0);
  }, [data.project.id]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [safeIndex]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select")) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((current) => Math.min(current + 1, pages.length - 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((current) => Math.max(current - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages.length]);

  if (!page) return null;

  const progress = pages.length > 0 ? (safeIndex + 1) / pages.length : 1;
  const barIssue = data.project.location || data.project.category || "Project issue";

  return (
    <article
      className={`issue ${issueSerif.variable} ${issueNameplate.variable} ${issueMono.variable}`}
    >
      <header className="issue-bar">
        <Link className="issue-nameplate" href={`/p/${data.slug}/projects`}>
          {data.client.name}
        </Link>
        <p className="issue-bar-issue">{barIssue}</p>
        <p className="issue-count">
          {pad(safeIndex + 1)} of {pad(pages.length)}
        </p>
        <nav className="issue-nav" aria-label="Issue pages">
          <button type="button" onClick={() => setIndex((current) => Math.max(current - 1, 0))} disabled={safeIndex === 0}>
            Prev
          </button>
          <button
            type="button"
            className="is-next"
            onClick={() => setIndex((current) => Math.min(current + 1, pages.length - 1))}
            disabled={safeIndex === pages.length - 1}
          >
            Next
          </button>
        </nav>
      </header>
      <div className="issue-progress" style={{ ["--issue-progress" as string]: String(progress) }}>
        <span />
      </div>
      <p className="issue-sr" aria-live="polite">
        {page.title}. Page {safeIndex + 1} of {pages.length}.
      </p>
      {pages.map((item, itemIndex) => (
        <div key={item.id} className="issue-sheet" hidden={itemIndex !== safeIndex}>
          {item.node}
        </div>
      ))}
    </article>
  );
}
