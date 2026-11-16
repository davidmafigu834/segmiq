import QRCode from "qrcode";
import { Barlow_Condensed, IBM_Plex_Mono, Newsreader } from "next/font/google";
import { buildMagazineIssue, type IssuePage, type IssuePhoto } from "@/lib/cloud/magazine-issue";
import type { ProjectMagazineData } from "@/lib/cloud/project-magazine";

const printSerif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--issue-serif",
});

const printNameplate = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--issue-nameplate",
});

const printMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--issue-mono",
});

type PrintPageProps = {
  data: ProjectMagazineData;
  qrDataUrl: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function Folio({ name, index, total }: { name: string; index: number; total: number }) {
  return (
    <p className="print-folio">
      <span>{name}</span>
      <span>
        {pad(index)} / {pad(total)}
      </span>
    </p>
  );
}

function PrintPhoto({ photo, ratio }: { photo: IssuePhoto; ratio: "wide" | "tile" | "square" }) {
  return (
    <figure className="print-figure">
      <div className={`print-frame print-${ratio}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="print-photo" src={photo.url} alt={photo.caption || ""} />
      </div>
      {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
    </figure>
  );
}

function PrintList({
  heading,
  rows,
  note,
}: {
  heading: string;
  rows: { label: string; value: string }[];
  note: string | null;
}) {
  return (
    <div className="print-body">
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
      {note ? <p className="print-note">{note}</p> : null}
    </div>
  );
}

function PrintSheet({
  page,
  index,
  total,
  clientName,
  qrDataUrl,
  livePageUrl,
}: {
  page: IssuePage;
  index: number;
  total: number;
  clientName: string;
  qrDataUrl: string;
  livePageUrl: string;
}) {
  const folio = <Folio name={clientName} index={index} total={total} />;

  let body = null;
  switch (page.id) {
    case "cover":
      body = (
        <div className="print-cover">
          {page.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="print-cover-img" src={page.imageUrl} alt="" />
          ) : (
            <div className="print-cover-fallback">{page.clientName}</div>
          )}
          <div className="print-band">
            <p className="print-kicker">{page.kicker}</p>
            <h1>{page.title}</h1>
            {page.lead ? <p className="print-deck">{page.lead}</p> : null}
            {folio}
          </div>
        </div>
      );
      break;
    case "record":
      body = (
        <>
          <div className="print-body">
            <h2>On record.</h2>
            <div className="print-story">
              <div>
                {page.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {page.quote ? (
                <blockquote>
                  {page.quote}
                  {page.quoteBy ? <cite>{page.quoteBy}</cite> : null}
                </blockquote>
              ) : null}
            </div>
          </div>
          {folio}
        </>
      );
      break;
    case "plate":
      body = (
        <>
          <figure className="print-plate">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="print-photo" src={page.photo.url} alt={page.photo.caption || ""} />
            {page.photo.caption ? <figcaption>{page.photo.caption}</figcaption> : null}
          </figure>
          {folio}
        </>
      );
      break;
    case "pair":
    case "later":
      body = (
        <>
          <div className="print-body print-pair">
            {page.photos.map((photo, photoIndex) => (
              <PrintPhoto
                key={photo.id}
                photo={photo}
                ratio={page.id === "pair" && photoIndex === 1 ? "square" : "tile"}
              />
            ))}
          </div>
          {folio}
        </>
      );
      break;
    case "specs":
    case "timeline":
    case "capability":
      body = (
        <>
          <PrintList heading={page.heading} rows={page.rows} note={page.note} />
          {folio}
        </>
      );
      break;
    case "result":
      body = (
        <>
          <div className="print-body">
            <h2>The outcome.</h2>
            {page.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {folio}
        </>
      );
      break;
    case "testimonial":
      body = (
        <>
          <blockquote className="print-closer">
            {page.quote}
            {page.by ? <cite>{page.by}</cite> : null}
          </blockquote>
          {folio}
        </>
      );
      break;
    case "close":
      body = (
        <>
          <div className="print-body print-close">
            <h2>Request a quote.</h2>
            <p>{page.clientName}. The next job starts with a conversation.</p>
            <div className="print-close-row">
              <div>
                <p className="print-url">{livePageUrl}</p>
                <p className="print-note">{[page.country, "Powered by Segmiq"].filter(Boolean).join(". ")}</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="print-qr" src={qrDataUrl} alt="QR code for this project" />
            </div>
          </div>
          {folio}
        </>
      );
      break;
    default: {
      const unreachable: never = page;
      body = unreachable;
    }
  }

  return <section className="print-sheet">{body}</section>;
}

export function ProjectMagazinePrint({ data, qrDataUrl }: PrintPageProps) {
  const pages = buildMagazineIssue(data);

  return (
    <article className={`print-issue ${printSerif.variable} ${printNameplate.variable} ${printMono.variable}`}>
      {pages.map((page, index) => (
        <PrintSheet
          key={`${page.id}-${index}`}
          page={page}
          index={index + 1}
          total={pages.length}
          clientName={data.client.name}
          qrDataUrl={qrDataUrl}
          livePageUrl={data.livePageUrl}
        />
      ))}
      <style>{`
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-issue {
          width: 794px;
          margin: 0 auto;
          color: oklch(20% 0.022 255);
          font-family: var(--issue-serif), Georgia, serif;
          font-size: 16px;
          line-height: 1.45;
        }
        .print-sheet {
          width: 794px;
          height: 1123px;
          overflow: hidden;
          background: oklch(96.5% 0.006 250);
          display: flex;
          flex-direction: column;
          page-break-after: always;
          break-after: page;
        }
        .print-sheet:last-child { page-break-after: auto; break-after: auto; }
        .print-cover { height: 100%; display: flex; flex-direction: column; min-height: 0; }
        .print-cover-img, .print-cover-fallback { flex: 1; min-height: 0; width: 100%; object-fit: cover; object-position: 58% 46%; }
        .print-cover-fallback {
          display: flex;
          align-items: flex-end;
          padding: 36px;
          background: oklch(20% 0.022 255);
          color: oklch(96.5% 0.006 250);
          font-family: var(--issue-nameplate), "Arial Narrow", sans-serif;
          font-size: 48px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .print-band { padding: 28px 40px 32px; }
        .print-kicker, .print-folio, .print-note, .print-figure figcaption, .print-plate figcaption, blockquote cite {
          font-family: var(--issue-mono), ui-monospace, monospace;
          font-size: 11px;
          font-style: normal;
          color: oklch(34% 0.02 255);
        }
        .print-kicker, .print-deck, .print-note { margin: 0; }
        h1, h2 { margin: 0; font-weight: 600; letter-spacing: -0.03em; line-height: 0.96; font-style: normal; }
        h1 { margin-top: 8px; font-size: 54px; max-width: 14ch; }
        h2 { font-size: 36px; max-width: 16ch; margin-bottom: 28px; }
        .print-deck { margin-top: 12px; font-size: 18px; max-width: 36ch; line-height: 1.3; }
        .print-body { padding: 48px 48px 0; flex: 1; min-height: 0; }
        .print-body p { margin: 0 0 12px; max-width: 62ch; }
        .print-story { display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 28px; align-items: end; }
        .print-story blockquote, .print-closer {
          margin: 0;
          font-size: 22px;
          line-height: 1.15;
          letter-spacing: -0.02em;
        }
        .print-story blockquote::before {
          content: "";
          display: block;
          width: 42px;
          height: 3px;
          background: oklch(68% 0.155 58);
          margin-bottom: 12px;
        }
        blockquote cite { display: block; margin-top: 10px; }
        .print-plate { margin: 0; flex: 1; min-height: 0; display: flex; flex-direction: column; }
        .print-plate img { width: 100%; flex: 1; min-height: 0; object-fit: cover; }
        .print-plate figcaption, .print-figure figcaption { margin: 8px 40px 0; }
        .print-pair { display: grid; grid-template-columns: 1.35fr 0.75fr; gap: 20px; align-items: start; }
        .print-figure { margin: 0; }
        .print-frame { overflow: hidden; background: oklch(93.2% 0.008 250); }
        .print-tile { aspect-ratio: 4 / 3; }
        .print-square { aspect-ratio: 1; }
        .print-frame img { width: 100%; height: 100%; object-fit: cover; }
        dl { margin: 0; }
        dt {
          font-family: var(--issue-nameplate), "Arial Narrow", sans-serif;
          font-weight: 700;
          font-size: 32px;
          line-height: 0.95;
          letter-spacing: -0.015em;
          padding-top: 16px;
        }
        div:first-child > dt { padding-top: 0; }
        dd {
          margin: 6px 0 0;
          padding-bottom: 16px;
          border-bottom: 1px solid oklch(20% 0.02 255 / 0.18);
          color: oklch(34% 0.02 255);
        }
        .print-closer { padding: 72px 48px 0; max-width: 16ch; font-size: 40px; font-weight: 600; letter-spacing: -0.03em; line-height: 1.02; }
        .print-close-row { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; margin-top: 36px; }
        .print-url { font-family: var(--issue-mono), ui-monospace, monospace; font-size: 11px; word-break: break-all; }
        .print-qr { width: 108px; height: 108px; background: #fff; padding: 6px; }
        .print-folio {
          margin-top: auto;
          padding: 16px 40px 28px;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border-top: 1px solid oklch(20% 0.02 255 / 0.18);
        }
        .print-band .print-folio { margin: 16px 0 0; padding: 12px 0 0; width: auto; }
      `}</style>
    </article>
  );
}

export async function generatePrintQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 180,
    color: { dark: "#24303A", light: "#F4F5F6" },
  });
}
