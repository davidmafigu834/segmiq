"use client";

import { Fraunces, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { EditableZone } from "@/components/landing/EditableZone";
import type { NorthfieldContent, NorthfieldTheme } from "@/types/templates/northfield";
import styles from "./northfield/Northfield.module.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-fraunces",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

type Props = {
  content: NorthfieldContent;
  theme: NorthfieldTheme;
  leadFormSlot: React.ReactNode;
  isPreview?: boolean;
};

function MarqueeLine({ text, accentWord }: { text: string; accentWord: string | null }) {
  if (!accentWord) return <span>{text}</span>;
  const lower = text.toLowerCase();
  const w = accentWord.toLowerCase();
  const i = lower.indexOf(w);
  if (i < 0) return <span>{text}</span>;
  return (
    <>
      {text.slice(0, i)}
      <em>{text.slice(i, i + accentWord.length)}</em>
      {text.slice(i + accentWord.length)}
    </>
  );
}

export function NorthfieldConstruction({ content, theme, leadFormSlot, isPreview }: Props) {
  const p = theme.paper_color || "#EFEAE0";
  const i = theme.ink_color || "#1A1815";
  const a = theme.primary_color || "#FF6B1F";
  const marqueeDup = [...content.marquee.items, ...content.marquee.items];

  return (
    <div
      className={`northfield-template ${fraunces.variable} ${jetbrains.variable} ${styles.northfieldTemplate}`}
      style={
        {
          "--template-paper": p,
          "--template-ink": i,
          "--template-accent": a,
        } as React.CSSProperties
      }
    >
      <div className={styles.nfInner}>
        <header className={styles.nfTopBar}>
          <EditableZone path="top_bar.license_text" mode="text" isEmpty={!content.top_bar.license_text.trim()} label="License line">
            <span>{content.top_bar.license_text}</span>
          </EditableZone>
          <EditableZone path="top_bar.availability_text" mode="text" label="Availability">
            <span>{content.top_bar.availability_text}</span>
          </EditableZone>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <EditableZone path="top_bar.phone_display" mode="text" label="Phone">
              <span>{content.top_bar.phone_display}</span>
            </EditableZone>
            <EditableZone path="top_bar.company_name" mode="text" label="Company name">
              <strong>{content.top_bar.company_name}</strong>
            </EditableZone>
          </div>
        </header>

        <section className={styles.nfHero}>
          <div>
            <p className={styles.nfEyebrow}>
              <EditableZone path="hero.eyebrow" mode="text" label="Eyebrow" as="span">
                <span>{content.hero.eyebrow}</span>
              </EditableZone>
            </p>
            <h1 className={styles.nfHeadline}>
              <EditableZone path="hero.headline_line_1" mode="text" label="Headline line 1">
                <span>{content.hero.headline_line_1} </span>
              </EditableZone>
              <EditableZone path="hero.headline_italic_word" mode="text" label="Italic accent word">
                <em>{content.hero.headline_italic_word}</em>
              </EditableZone>{" "}
              <EditableZone path="hero.headline_line_2" mode="text" label="Headline line 2">
                <span>{content.hero.headline_line_2}</span>
              </EditableZone>{" "}
              <EditableZone path="hero.headline_line_3" mode="text" label="Headline line 3">
                <span>{content.hero.headline_line_3} </span>
              </EditableZone>
              <EditableZone path="hero.headline_underlined" mode="text" label="Underlined phrase">
                <span className={styles.nfUnderline}>{content.hero.headline_underlined}</span>
              </EditableZone>
            </h1>
            <div className={styles.nfLede}>
              <EditableZone path="hero.lede" mode="textarea" label="Lead paragraph">
                <p>{content.hero.lede}</p>
              </EditableZone>
            </div>
            <dl className={styles.nfMeta}>
              {content.hero.meta_stats.map((s, idx) => (
                <div key={`${s.label}-${idx}`}>
                  <dt>
                    <EditableZone path={`hero.meta_stats[${idx}].label`} mode="text" label={`Stat ${idx + 1} label`}>
                      <span>{s.label}</span>
                    </EditableZone>
                  </dt>
                  <dd>
                    <EditableZone path={`hero.meta_stats[${idx}].value`} mode="text" label={`Stat ${idx + 1} value`}>
                      <span>{s.value}</span>
                    </EditableZone>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <aside className={styles.nfQuoteCard}>
            <div className={styles.nfQuoteTag}>
              <EditableZone path="quote_card.tag" mode="text" label="Form tag">
                {content.quote_card.tag}
              </EditableZone>
            </div>
            <div className={styles.nfQuoteTitle}>
              <EditableZone path="quote_card.title" mode="text" label="Form title">
                {content.quote_card.title}
              </EditableZone>
            </div>
            <p className={styles.nfQuoteSub}>
              <EditableZone path="quote_card.subtitle" mode="text" label="Form subtitle" as="span">
                {content.quote_card.subtitle}
              </EditableZone>
            </p>
            <div className="nfFormSlot">{leadFormSlot}</div>
            <p className={styles.nfQuoteSub} style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              <EditableZone path="quote_card.caption" mode="text" label="Form caption" as="span">
                {content.quote_card.caption}
              </EditableZone>
            </p>
          </aside>
        </section>

        <div className={styles.nfMarqueeWrap} aria-hidden={!isPreview}>
          <div className={styles.nfMarquee}>
            {marqueeDup.map((item, idx) => (
              <span key={`${item.text}-${idx}`}>
                <MarqueeLine text={item.text} accentWord={item.accent_word} />
                <span style={{ opacity: 0.25 }}> · </span>
              </span>
            ))}
          </div>
        </div>

        <section className={styles.nfSection}>
          <p className={styles.nfSectionLabel}>{content.stats.section_number}</p>
          <h2 className={styles.nfSectionTitle}>
            <EditableZone path="stats.section_title_prefix" mode="text" label="Stats title prefix">
              <span>{content.stats.section_title_prefix} </span>
            </EditableZone>
            <EditableZone path="stats.section_title_italic" mode="text" label="Stats italic">
              <em>{content.stats.section_title_italic}</em>
            </EditableZone>{" "}
            <EditableZone path="stats.section_title_suffix" mode="text" label="Stats suffix">
              <span>{content.stats.section_title_suffix}</span>
            </EditableZone>
          </h2>
          <div className={styles.nfStatsGrid}>
            {content.stats.items.map((st, idx) => (
              <div key={st.number} className={styles.nfStatCard}>
                <div className={styles.nfStatNum}>
                  <EditableZone path={`stats.items[${idx}].number`} mode="text" label="Stat number">
                    {st.number}
                  </EditableZone>
                  {st.superscript ? (
                    <sup>
                      <EditableZone path={`stats.items[${idx}].superscript`} mode="text" label="Superscript">
                        {st.superscript}
                      </EditableZone>
                    </sup>
                  ) : null}
                </div>
                <div className={styles.nfStatLabel}>
                  <EditableZone path={`stats.items[${idx}].label`} mode="textarea" label="Stat label">
                    {st.label}
                  </EditableZone>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.nfSection}>
          <p className={styles.nfSectionLabel}>{content.services.section_number}</p>
          <h2 className={styles.nfSectionTitle}>
            <EditableZone path="services.section_title_prefix" mode="text" label="Services title prefix">
              <span>{content.services.section_title_prefix} </span>
            </EditableZone>
            <EditableZone path="services.section_title_italic" mode="text" label="Services italic">
              <em>{content.services.section_title_italic}</em>
            </EditableZone>{" "}
            <EditableZone path="services.section_title_suffix" mode="text" label="Services suffix">
              <span>{content.services.section_title_suffix}</span>
            </EditableZone>
          </h2>
          <div className={styles.nfServicesIntro}>
            <EditableZone path="services.intro" mode="textarea" label="Services intro">
              <p>{content.services.intro}</p>
            </EditableZone>
          </div>
          <div className={styles.nfServiceGrid}>
            {content.services.items.map((svc, idx) => (
              <article key={svc.number} className={styles.nfServiceCard}>
                <div className={styles.nfServiceNum}>{svc.number}</div>
                <h3 className={styles.nfServiceTitle}>
                  <EditableZone path={`services.items[${idx}].title_prefix`} mode="text" label="Service title prefix">
                    <span>{svc.title_prefix} </span>
                  </EditableZone>
                  <EditableZone path={`services.items[${idx}].title_italic`} mode="text" label="Service italic">
                    <em>{svc.title_italic}</em>
                  </EditableZone>
                  {svc.title_suffix ? (
                    <EditableZone path={`services.items[${idx}].title_suffix`} mode="text" label="Service suffix">
                      <span> {svc.title_suffix}</span>
                    </EditableZone>
                  ) : null}
                </h3>
                <p style={{ marginTop: "0.65rem", fontSize: "0.9rem", lineHeight: 1.55, opacity: 0.78 }}>
                  <EditableZone path={`services.items[${idx}].description`} mode="textarea" label="Service description" as="span">
                    {svc.description}
                  </EditableZone>
                </p>
                <div className={styles.nfTags}>
                  {svc.tags.map((t, ti) => (
                    <span key={`${t}-${ti}`} className={styles.nfTag}>
                      {t}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.nfSection}>
          <p className={styles.nfSectionLabel}>{content.projects.section_number}</p>
          <h2 className={styles.nfSectionTitle}>
            <EditableZone path="projects.section_title_prefix" mode="text" label="Projects title prefix">
              <span>{content.projects.section_title_prefix} </span>
            </EditableZone>
            <EditableZone path="projects.section_title_italic" mode="text" label="Projects italic">
              <em>{content.projects.section_title_italic}</em>
            </EditableZone>{" "}
            <EditableZone path="projects.section_title_suffix" mode="text" label="Projects suffix">
              <span>{content.projects.section_title_suffix}</span>
            </EditableZone>
          </h2>
          <div className={styles.nfProjectsGrid}>
            {content.projects.items.map((pr, idx) => (
              <article key={pr.number} className={styles.nfProject}>
                <div className={styles.nfProjectMedia}>
                  {pr.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote client-uploaded URLs
                    <img src={pr.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : null}
                  <div className={styles.nfProjectWire} aria-hidden />
                </div>
                <div className={styles.nfProjectBody}>
                  <div style={{ fontFamily: "var(--font-jetbrains)", fontSize: 10, letterSpacing: "0.12em", opacity: 0.5 }}>
                    <EditableZone path={`projects.items[${idx}].number`} mode="text" label="Project number">
                      {pr.number}
                    </EditableZone>
                  </div>
                  <h3 className={styles.nfServiceTitle} style={{ marginTop: "0.35rem" }}>
                    <EditableZone path={`projects.items[${idx}].name_prefix`} mode="text" label="Project name">
                      <span>{pr.name_prefix} </span>
                    </EditableZone>
                    <EditableZone path={`projects.items[${idx}].name_italic`} mode="text" label="Project location">
                      <em>{pr.name_italic}</em>
                    </EditableZone>
                  </h3>
                  <p style={{ fontSize: "0.85rem", marginTop: "0.35rem", opacity: 0.8 }}>
                    <EditableZone path={`projects.items[${idx}].type_heading`} mode="text" label="Type heading" as="span">
                      <strong>{pr.type_heading}</strong>
                    </EditableZone>
                    <br />
                    <EditableZone path={`projects.items[${idx}].type_detail`} mode="text" label="Type detail" as="span">
                      {pr.type_detail}
                    </EditableZone>
                  </p>
                  <p style={{ fontSize: "0.8rem", marginTop: "0.5rem", opacity: 0.65 }}>
                    <EditableZone path={`projects.items[${idx}].completed_heading`} mode="text" label="Completed heading" as="span">
                      <strong>{pr.completed_heading}</strong>
                    </EditableZone>{" "}
                    <EditableZone path={`projects.items[${idx}].completed_detail`} mode="text" label="Completed detail" as="span">
                      {pr.completed_detail}
                    </EditableZone>
                  </p>
                  <p style={{ marginTop: "auto", paddingTop: "0.75rem", fontFamily: "var(--font-fraunces)", fontSize: "1.25rem" }}>
                    <EditableZone path={`projects.items[${idx}].value`} mode="text" label="Project value" as="span">
                      {pr.value}
                    </EditableZone>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.nfSection}>
          <p className={styles.nfSectionLabel}>{content.process.section_number}</p>
          <h2 className={styles.nfSectionTitle}>
            <EditableZone path="process.section_title_prefix" mode="text" label="Process title prefix">
              <span>{content.process.section_title_prefix} </span>
            </EditableZone>
            <EditableZone path="process.section_title_italic" mode="text" label="Process italic">
              <em>{content.process.section_title_italic}</em>
            </EditableZone>{" "}
            <EditableZone path="process.section_title_suffix" mode="text" label="Process suffix">
              <span>{content.process.section_title_suffix}</span>
            </EditableZone>
          </h2>
          <div className={styles.nfProcess}>
            {content.process.steps.map((st, idx) => (
              <div key={st.number} className={styles.nfProcessCard}>
                <div style={{ fontFamily: "var(--font-jetbrains)", fontSize: 10, opacity: 0.45 }}>{st.number}</div>
                <h3 className={styles.nfServiceTitle} style={{ marginTop: "0.35rem" }}>
                  <EditableZone path={`process.steps[${idx}].title_prefix`} mode="text" label="Step title prefix">
                    <span>{st.title_prefix} </span>
                  </EditableZone>
                  <EditableZone path={`process.steps[${idx}].title_italic`} mode="text" label="Step italic">
                    <em>{st.title_italic}</em>
                  </EditableZone>
                  {st.title_suffix ? (
                    <EditableZone path={`process.steps[${idx}].title_suffix`} mode="text" label="Step suffix">
                      <span> {st.title_suffix}</span>
                    </EditableZone>
                  ) : null}
                </h3>
                <p style={{ marginTop: "0.5rem", fontSize: "0.88rem", lineHeight: 1.55, opacity: 0.78 }}>
                  <EditableZone path={`process.steps[${idx}].description`} mode="textarea" label="Step description" as="span">
                    {st.description}
                  </EditableZone>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.nfSection}>
          <div className={styles.nfTestimonial}>
            <q>
              <EditableZone path="testimonial.quote_parts.opening" mode="textarea" label="Quote opening">
                <span>{content.testimonial.quote_parts.opening} </span>
              </EditableZone>
              <EditableZone path="testimonial.quote_parts.italic_1" mode="text" label="Quote italic 1">
                <em>{content.testimonial.quote_parts.italic_1}</em>
              </EditableZone>
              <EditableZone path="testimonial.quote_parts.middle" mode="textarea" label="Quote middle">
                <span> {content.testimonial.quote_parts.middle} </span>
              </EditableZone>
              <EditableZone path="testimonial.quote_parts.italic_2" mode="text" label="Quote italic 2">
                <em>{content.testimonial.quote_parts.italic_2}</em>
              </EditableZone>
              <EditableZone path="testimonial.quote_parts.closing" mode="textarea" label="Quote closing">
                <span> {content.testimonial.quote_parts.closing}</span>
              </EditableZone>
            </q>
            <div className={styles.nfAvatar}>
              <EditableZone path="testimonial.author_initials" mode="text" label="Initials">
                {content.testimonial.author_initials}
              </EditableZone>
            </div>
            <p style={{ marginTop: "0.5rem", fontWeight: 600 }}>
              <EditableZone path="testimonial.author_name" mode="text" label="Author name" as="span">
                {content.testimonial.author_name}
              </EditableZone>
            </p>
            <p style={{ fontSize: "0.85rem", opacity: 0.65 }}>
              <EditableZone path="testimonial.author_role" mode="text" label="Author role" as="span">
                {content.testimonial.author_role}
              </EditableZone>
            </p>
          </div>
        </section>

        <section className={styles.nfCta}>
          <h2 className={styles.nfSectionTitle} style={{ margin: "0 auto", maxWidth: "28ch" }}>
            <EditableZone path="cta.title_prefix" mode="text" label="CTA title prefix">
              <span>{content.cta.title_prefix} </span>
            </EditableZone>
            <EditableZone path="cta.title_italic" mode="text" label="CTA italic">
              <em>{content.cta.title_italic}</em>
            </EditableZone>
          </h2>
          <p style={{ marginTop: "0.75rem", maxWidth: "40rem", marginInline: "auto", opacity: 0.75 }}>
            <EditableZone path="cta.subtitle" mode="textarea" label="CTA subtitle" as="span">
              {content.cta.subtitle}
            </EditableZone>
          </p>
          <p style={{ marginTop: "1.25rem", fontFamily: "var(--font-fraunces)", fontSize: "1.35rem" }}>
            <EditableZone path="cta.phone_display" mode="text" label="CTA phone" as="span">
              {content.cta.phone_display}
            </EditableZone>
          </p>
          <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.65, whiteSpace: "pre-line" }}>
            <EditableZone path="cta.hours_text" mode="textarea" label="Hours" as="span">
              {content.cta.hours_text}
            </EditableZone>
          </p>
          <Link
            href={`tel:${content.cta.phone_display.replace(/[^\d+]/g, "")}`}
            className="mt-4 inline-block rounded-md px-6 py-3 text-sm font-semibold"
            style={{ background: a, color: i }}
          >
            <EditableZone path="cta.action_label" mode="text" label="Action label">
              {content.cta.action_label}
            </EditableZone>
          </Link>
        </section>

        <footer className={styles.nfFooter}>
          <p style={{ maxWidth: "36rem", marginBottom: "1.5rem", lineHeight: 1.55, opacity: 0.78 }}>
            <EditableZone path="footer.tagline" mode="textarea" label="Footer tagline" as="span">
              {content.footer.tagline}
            </EditableZone>
          </p>
          <div className={styles.nfFooterGrid}>
            {content.footer.columns.map((col, ci) => (
              <div key={col.title} className={styles.nfFooterCol}>
                <h4>
                  <EditableZone path={`footer.columns[${ci}].title`} mode="text" label="Column title">
                    {col.title}
                  </EditableZone>
                </h4>
                {col.links.map((ln, li) => (
                  <Link key={`${ln.href}-${li}`} href={ln.href}>
                    <EditableZone path={`footer.columns[${ci}].links[${li}].label`} mode="text" label="Link label">
                      {ln.label}
                    </EditableZone>
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <p style={{ marginTop: "1.5rem", fontSize: "0.85rem", opacity: 0.55 }}>
            <EditableZone path="footer.copyright" mode="text" label="Copyright" as="span">
              {content.footer.copyright}
            </EditableZone>
          </p>
          <div className={styles.nfLegal}>
            {content.footer.legal_links.map((ln, li) => (
              <Link key={`${ln.label}-${li}`} href={ln.href} style={{ color: "inherit" }}>
                <EditableZone path={`footer.legal_links[${li}].label`} mode="text" label="Legal label">
                  {ln.label}
                </EditableZone>
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
