"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import {
  CALENDAR,
  COMPANIES,
  CUSTOMERS,
  INSTALL_STEPS,
  MILESTONES,
  OPPORTUNITIES,
  PACKAGES,
  PRODUCTS,
  PROJECTS,
  QUOTES,
  STAGES,
  TEAM,
  WORK,
  companyById,
  type CompanyId,
  type StageId,
} from "./desk";
import type { Screen } from "./nav";
import { Bones, EmptyNote, Head, Panel, QuietRow, WorkRow, backBtn, field, inkBtn, limeBtn, lineBtn } from "./primitives";

export function ScreenBody({
  screen,
  loading,
  focus,
  dark,
  companyId,
  onToggleDark,
  onOpen,
}: {
  screen: Screen;
  loading: boolean;
  focus: string | null;
  dark: boolean;
  companyId: CompanyId;
  onToggleDark: () => void;
  onOpen: (screen: Screen, id?: string) => void;
}) {
  const company = companyById(companyId);
  const filled = companyId === "sunline";

  if (screen === "signin") return <SignIn dark={dark} onToggleDark={onToggleDark} onEnter={() => onOpen("dashboard")} />;
  if (!filled && screen !== "settings" && screen !== "states" && screen !== "team") {
    return (
      <div className="space-y-8">
        <Head kicker={company.preset} title={company.name} detail={`${company.place}. This desk has no open solar jobs yet. Sunline Solar carries the sample.`} />
        <Panel title="Open work">
          <EmptyNote title="Nothing waiting" detail="Switch back to Sunline Solar to walk a lead through visit, quotation, installation, and handover." />
        </Panel>
      </div>
    );
  }
  if (screen === "dashboard") return <Dashboard loading={loading} onOpen={onOpen} />;
  if (screen === "pipeline") return <Pipeline loading={loading} onOpen={onOpen} />;
  if (screen === "opportunity") return <Opportunity focus={focus} onOpen={onOpen} />;
  if (screen === "whatsapp") return <WhatsApp onOpen={onOpen} />;
  if (screen === "visit") return <Visit focus={focus} onOpen={onOpen} />;
  if (screen === "projects") return <Projects key={focus ?? "list"} loading={loading} startAdding={focus === "add"} onOpen={onOpen} />;
  if (screen === "project") return <ProjectRecord focus={focus} onOpen={onOpen} />;
  if (screen === "quote") return <Quote focus={focus} onOpen={onOpen} />;
  if (screen === "customer") return <Customer focus={focus} onOpen={onOpen} />;
  if (screen === "work") return <MyWork loading={loading} onOpen={onOpen} />;
  if (screen === "calendar") return <Calendar loading={loading} onOpen={onOpen} />;
  if (screen === "quotations") return <Quotes key={focus ?? "list"} loading={loading} startAdding={focus === "add"} onOpen={onOpen} />;
  if (screen === "leads") return <Leads key={focus ?? "list"} loading={loading} startAdding={focus === "add"} onOpen={onOpen} />;
  if (screen === "customers") return <Customers loading={loading} onOpen={onOpen} />;
  if (screen === "settings") return <Settings companyName={company.name} />;
  if (screen === "states") return <States />;
  if (screen === "social") return <Social onOpen={onOpen} />;
  if (screen === "products" || screen === "inventory") return <Stock loading={loading} kind={screen} />;
  if (screen === "packages") return <Packages loading={loading} />;
  if (screen === "team") return <TeamPage loading={loading} />;
  if (screen === "reports") return <Reports onOpen={onOpen} />;
  if (screen === "command" || screen === "agent") return <Ask title={screen === "command" ? "Command Center" : "SegmiQ Agent"} />;
  if (screen === "documents") return <Documents />;
  if (screen === "billing") return <Billing />;
  return null;
}

function Dashboard({ loading, onOpen }: { loading: boolean; onOpen: (screen: Screen, id?: string) => void }) {
  return (
    <div className="space-y-8">
      <Head
        kicker="Sunline Solar"
        title="Dashboard"
        detail="Monday 16 November. One installation is scheduled without the inverter issued."
      />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.85fr)]">
        <Panel title="Needs you" count={loading ? undefined : 3}>
          {loading ? (
            <Bones />
          ) : (
            <ul>
              <WorkRow name="Farai Dube" meta="Installation · Mount Pleasant" detail="Scheduled today. The inverter is not issued." mark="overdue" action="Open project" onAction={() => onOpen("project", "farai")} />
              <WorkRow name="Rudo Ncube" meta="Site visit · 09:30" detail="Pre-sale visit. The assessment is still empty." mark="today" action="Open visit" onAction={() => onOpen("visit", "rudo")} />
              <WorkRow name="Chipo Ndlovu" meta="Quality check" detail="Physical work is complete. QA is not recorded." mark="today" action="Open project" onAction={() => onOpen("project", "chipo")} />
            </ul>
          )}
        </Panel>
        <Panel title="Today" count={loading ? undefined : CALENDAR.length}>
          {loading ? (
            <Bones />
          ) : (
            <ul>
              {CALENDAR.map((row) => (
                <QuietRow key={row.time} name={`${row.time} · ${row.name}`} detail={row.detail} action="Open" onAction={() => onOpen(row.name === "Nyasha Moyo" ? "opportunity" : row.name === "Rudo Ncube" ? "visit" : "project", row.name === "Nyasha Moyo" ? "nyasha" : row.name === "Rudo Ncube" ? "rudo" : "farai")} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface sm:grid-cols-4">
        <Metric label="Open leads" value="5" />
        <Metric label="Visits today" value="1" />
        <Metric label="Projects" value="3" attention />
        <Metric label="Handover" value="1" />
      </div>
    </div>
  );
}

function Metric({ label, value, attention }: { label: string; value: string; attention?: boolean }) {
  return (
    <div className="border-b border-r border-sales-border-subtle px-4 py-4">
      <p className="text-[12px] text-sales-text-muted">{label}</p>
      <p className={`mt-1 font-display text-[24px] font-semibold leading-none ${attention ? "text-sales-danger-fg" : ""}`}>{value}</p>
    </div>
  );
}

function Pipeline({ loading, onOpen }: { loading: boolean; onOpen: (screen: Screen, id?: string) => void }) {
  const [stage, setStage] = useState<StageId | "all">("all");
  const visible = stage === "all" ? STAGES : STAGES.filter((item) => item.id === stage);
  return (
    <div className="space-y-8">
      <Head kicker="Sales" title="Solar Pipeline" detail="Stage is derived from the lead, the visit, the quotation, and the deal. Dragging is not how a stage becomes true." />
      <div className="re-chips flex gap-2" role="tablist" aria-label="Stages">
        <button type="button" className={stage === "all" ? inkBtn : lineBtn} aria-pressed={stage === "all"} onClick={() => setStage("all")}>All</button>
        {STAGES.map((item) => (
          <button key={item.id} type="button" className={stage === item.id ? inkBtn : lineBtn} aria-pressed={stage === item.id} onClick={() => setStage(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="re-bone h-64 rounded-[12px]" />
      ) : (
        <div className="so-board">
          {visible.map((item) => {
            const cards = OPPORTUNITIES.filter((row) => row.stage === item.id);
            return (
              <section key={item.id} className="so-col" aria-label={item.label}>
                <header className="flex items-center justify-between gap-2 border-b border-sales-border-subtle px-3 py-3">
                  <h2 className="text-[13px] font-semibold">{item.label}</h2>
                  <span className="text-[12px] tabular-nums text-sales-text-muted">{cards.length}</span>
                </header>
                {cards.length === 0 ? (
                  <p className="px-3 py-4 text-[13px] text-sales-text-secondary">No opportunities.</p>
                ) : (
                  <ul>
                    {cards.map((card) => (
                      <li key={card.id} className="border-t border-sales-border-subtle px-3 py-3">
                        <p className="text-[14px] font-semibold">{card.name}</p>
                        <p className="text-[12px] text-sales-text-muted">{card.suburb}</p>
                        <p className="mt-1 text-[13px] text-sales-text-secondary">{card.detail}</p>
                        <button type="button" className={`${lineBtn} mt-3`} onClick={() => onOpen(card.projectId ? "project" : "opportunity", card.projectId ?? card.id)}>
                          {card.projectId ? "Open project" : "Open"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Opportunity({ focus, onOpen }: { focus: string | null; onOpen: (screen: Screen, id?: string) => void }) {
  const card = OPPORTUNITIES.find((row) => row.id === focus) ?? OPPORTUNITIES.find((row) => row.id === "nyasha")!;
  const stage = STAGES.find((item) => item.id === card.stage);
  return (
    <div className="space-y-8">
      <button type="button" onClick={() => onOpen("pipeline")} className={backBtn}>Back to pipeline</button>
      <Head kicker="Solar opportunity" title={card.name} detail={`${card.address}. ${card.detail}`} />
      <ol className="so-steps" aria-label="Solar journey">
        {STAGES.filter((item) => item.id !== "LOST").map((item) => {
          const index = STAGES.findIndex((row) => row.id === item.id);
          const at = STAGES.findIndex((row) => row.id === card.stage);
          const done = card.stage !== "LOST" && index < at;
          const current = item.id === card.stage;
          return (
            <li key={item.id} className="so-step" aria-current={current ? "step" : undefined}>
              <p className="text-[12px] text-sales-text-muted">{done ? "Done" : current ? "Now" : "Later"}</p>
              <p className="mt-1 text-[13px] font-semibold">{item.label}</p>
            </li>
          );
        })}
      </ol>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
        <Panel title="Still needed">
          <ul>
            <QuietRow name="Stage" detail={stage?.label ?? card.stage} />
            <QuietRow name="Visit" detail={card.visit ?? "No site visit yet"} action={card.visit ? "Open visit" : undefined} onAction={card.id === "rudo" ? () => onOpen("visit", "rudo") : undefined} />
            <QuietRow name="Quotation" detail={card.quote ?? "No quotation yet"} action={card.quote ? "Open quote" : undefined} onAction={card.quote ? () => onOpen("quote", card.id === "nyasha" ? "q1042" : "q1038") : undefined} />
            <QuietRow name="Next" detail={card.next} />
          </ul>
        </Panel>
        <Panel title="Actions">
          <ul>
            <QuietRow name="Schedule visit" detail="Creates a sales site visit. It does not complete the stage." action="Schedule" onAction={() => onOpen("visit", "rudo")} />
            <QuietRow name="Mark won" detail="Only after the customer accepts. A won deal can open a project." action={card.projectId ? "Open project" : "Won"} onAction={() => onOpen("project", card.projectId ?? "farai")} />
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function WhatsApp({ onOpen }: { onOpen: (screen: Screen, id?: string) => void }) {
  return (
    <div className="space-y-8">
      <Head kicker="Sales" title="WhatsApp Sales Hub" detail="The solar opportunity sits beside the thread. A manager on the company inbox does not get this rail in the live product yet. This desk shows it." />
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <Panel title="Threads">
          <ul>
            <QuietRow name="Nyasha Moyo" detail="Quote sent" action="Open" onAction={() => onOpen("opportunity", "nyasha")} />
            <QuietRow name="Amina Cruz" detail="New lead" action="Open" onAction={() => onOpen("opportunity", "amina")} />
            <QuietRow name="Rudo Ncube" detail="Visit tomorrow" action="Open" onAction={() => onOpen("visit", "rudo")} />
          </ul>
        </Panel>
        <section className="min-w-0 rounded-[12px] border border-sales-border bg-sales-surface">
          <header className="border-b border-sales-border-subtle px-4 py-3">
            <h2 className="text-[15px] font-semibold">Nyasha Moyo</h2>
            <p className="text-[12px] text-sales-text-muted">Borrowdale · Quote Sent</p>
          </header>
          <div className="space-y-3 px-4 py-4">
            <p className="max-w-[36ch] rounded-[12px] bg-sales-surface-subtle px-3 py-2 text-[14px]">Can you send the backup quote again? I want to check the battery size.</p>
            <p className="ml-auto max-w-[36ch] rounded-[12px] bg-sales-text-primary px-3 py-2 text-[14px] text-sales-surface">Q-1042 is the one we sent after the site visit. 5 kW inverter and one 5 kWh battery.</p>
          </div>
          <form className="border-t border-sales-border-subtle p-3" onSubmit={(event) => event.preventDefault()}>
            <label className="sr-only" htmlFor="reply">Reply</label>
            <input id="reply" className={field} placeholder="Reply on this desk" />
          </form>
        </section>
        <Panel title="Solar opportunity">
          <ul>
            <QuietRow name="Journey" detail="Quote Sent" action="Open" onAction={() => onOpen("opportunity", "nyasha")} />
            <QuietRow name="Visit" detail="Completed · suitable to proceed" />
            <QuietRow name="Quotation" detail="Q-1042 · US$4,800 · sent" action="Open" onAction={() => onOpen("quote", "q1042")} />
            <QuietRow name="Existing system" detail="None recorded" />
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Visit({ focus, onOpen }: { focus: string | null; onOpen: (screen: Screen, id?: string) => void }) {
  const sections = ["Site", "Power", "Loads", "Roof", "Equipment", "Photos", "Outcome"] as const;
  const [section, setSection] = useState<(typeof sections)[number]>("Site");
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const who = focus === "rudo" || !focus ? "Rudo Ncube" : "Rudo Ncube";

  function complete(event: FormEvent) {
    event.preventDefault();
    if (!outcome) {
      setError("Choose an assessment outcome.");
      setSaved(null);
      return;
    }
    setError(null);
    setSaved("Assessment completed on this desk. The live visit moves the stage to Site Visit Completed only when the visit and the assessment are both completed.");
  }

  return (
    <div className="space-y-8">
      <button type="button" onClick={() => onOpen("work")} className={backBtn}>Back to my work</button>
      <Head kicker="Site visit" title={who} detail="6 Avondale · scheduled tomorrow 09:30. Passing the time does not complete the visit." />
      <div className="re-nav flex gap-2" role="tablist" aria-label="Assessment">
        {sections.map((item) => (
          <button key={item} type="button" className={section === item ? inkBtn : lineBtn} aria-pressed={section === item} onClick={() => setSection(item)}>
            {item}
          </button>
        ))}
      </div>
      <form onSubmit={complete} className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
        <h2 className="text-[15px] font-semibold">{section}</h2>
        {section === "Outcome" ? (
          <fieldset className="mt-4 space-y-2">
            <legend className="text-[13px] font-medium">Outcome</legend>
            {[
              ["suitable", "Suitable to proceed"],
              ["technical_review", "Requires technical review"],
              ["another_visit", "Requires another visit"],
              ["site_issue", "Customer or site issue"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-[14px]">
                <input type="radio" name="outcome" value={value} checked={outcome === value} onChange={() => setOutcome(value)} />
                {label}
              </label>
            ))}
          </fieldset>
        ) : (
          <label className="mt-4 block">
            <span className="text-[13px] font-medium">{section === "Site" ? "Installation address" : `${section} notes`}</span>
            <input className={field} defaultValue={section === "Site" ? "6 Avondale" : ""} />
          </label>
        )}
        {section === "Photos" ? <p className="mt-3 text-[13px] text-sales-text-secondary">Photo slots follow the live categories: roof, DB board, meter, inverter location, battery location, existing solar, site.</p> : null}
        {error ? <p className="mt-3 text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}
        {saved ? <p className="mt-3 text-[13px] text-sales-text-secondary" role="status">{saved}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={lineBtn} onClick={() => setSaved("Draft kept on this desk.")}>Save draft</button>
          <button type="submit" className={limeBtn}>Complete assessment</button>
        </div>
      </form>
    </div>
  );
}

function Projects({ loading, startAdding, onOpen }: { loading: boolean; startAdding: boolean; onOpen: (screen: Screen, id?: string) => void }) {
  return (
    <Register
      kicker="Field & delivery"
      title="Projects"
      detail="A won solar deal becomes a project. Status runs from planning through handover. Installation is a tab on the project, not a separate list."
      create="New project"
      startAdding={startAdding}
      loading={loading}
      rows={PROJECTS.map((row) => ({ name: row.name, meta: `${row.status} · ${row.installation}`, detail: row.attention, mark: row.mark, action: "Open", onAction: () => onOpen("project", row.id) }))}
    />
  );
}

function ProjectRecord({ focus, onOpen }: { focus: string | null; onOpen: (screen: Screen, id?: string) => void }) {
  const project = PROJECTS.find((row) => row.id === focus) ?? PROJECTS[0];
  const sections = ["Overview", "Work", "Commercial", "Delivery", "Assets"] as const;
  const [section, setSection] = useState<(typeof sections)[number]>(project.id === "chipo" ? "Delivery" : "Overview");
  const [step, setStep] = useState<(typeof INSTALL_STEPS)[number]>(project.id === "chipo" ? "QA" : project.id === "tendai" ? "Handover" : "Equipment");
  const milestoneAt = project.id === "tendai" ? 4 : project.id === "chipo" ? 3 : 3;

  return (
    <div className="space-y-8">
      <button type="button" onClick={() => onOpen("projects")} className={backBtn}>Back to projects</button>
      <Head kicker={project.status} title={project.customer} detail={`${project.address}. ${project.attention}`} />
      <ol className="so-steps" aria-label="Delivery">
        {MILESTONES.map((label, index) => (
          <li key={label} className="so-step" aria-current={index === milestoneAt ? "step" : undefined}>
            <p className="text-[12px] text-sales-text-muted">{index < milestoneAt ? "Done" : index === milestoneAt ? "Now" : "Later"}</p>
            <p className="mt-1 text-[13px] font-semibold">{label}</p>
          </li>
        ))}
      </ol>
      <div className="re-nav flex gap-2" role="tablist" aria-label="Project">
        {sections.map((item) => (
          <button key={item} type="button" className={section === item ? inkBtn : lineBtn} aria-pressed={section === item} onClick={() => setSection(item)}>
            {item}
          </button>
        ))}
      </div>
      {section === "Delivery" ? (
        <div className="space-y-4">
          <div className="re-chips flex gap-2" role="tablist" aria-label="Installation">
            {INSTALL_STEPS.map((item) => (
              <button key={item} type="button" className={step === item ? inkBtn : lineBtn} aria-pressed={step === item} onClick={() => setStep(item)}>
                {item}
              </button>
            ))}
          </div>
          <Panel title={step}>
            {step === "Equipment" ? (
              <ul>
                <QuietRow name="5 kWh battery" detail="2 reserved" />
                <QuietRow name="5 kW hybrid inverter" detail="Serial required · not issued" />
              </ul>
            ) : null}
            {step === "QA" ? (
              <ul>
                <QuietRow name="Visual installation inspection" detail="Not recorded" />
                <QuietRow name="Inverter powers correctly" detail="Not recorded" />
                <QuietRow name="PV input detected" detail="Not recorded" />
              </ul>
            ) : null}
            {step === "Handover" ? (
              <ul>
                <QuietRow name="System operation explained" detail={project.id === "tendai" ? "Still to record" : "Waiting on QA"} />
                <QuietRow name="Customer balance" detail={project.id === "tendai" ? "Still outstanding" : "Not at handover"} />
              </ul>
            ) : null}
            {step !== "Equipment" && step !== "QA" && step !== "Handover" ? (
              <EmptyNote title={step} detail="Site access, mounting, cable routing, and photos live on this step in the live installation panel." />
            ) : null}
          </Panel>
        </div>
      ) : null}
      {section === "Overview" ? (
        <Panel title="Next">
          <ul>
            <QuietRow name={project.next} detail={project.attention} />
            <QuietRow name="Workflow" detail="Solar Installation" />
            <QuietRow name="Sales" detail="Won deal and accepted quotation" action="Open quote" onAction={() => onOpen("quote", "q1011")} />
          </ul>
        </Panel>
      ) : null}
      {section === "Work" ? (
        <Panel title="Assigned">
          <ul>
            <QuietRow name="Tapiwa Banda" detail="Installer · on site today" />
            <QuietRow name="Rumbidzai Ncube" detail="Project manager" />
          </ul>
        </Panel>
      ) : null}
      {section === "Commercial" ? (
        <Panel title="Commercial">
          <ul>
            <QuietRow name="Payment gate" detail={project.id === "tendai" ? "Balance still outstanding at handover" : "Deposit recorded"} />
            <QuietRow name="Quotation" detail="Q-1011 · accepted" action="Open" onAction={() => onOpen("quote", "q1011")} />
          </ul>
        </Panel>
      ) : null}
      {section === "Assets" ? (
        <Panel title="Installed system">
          <EmptyNote title="No system registered" detail="Serials, warranties, and the customer portal asset appear after handover. Staff do not have a company-wide asset list yet." />
        </Panel>
      ) : null}
    </div>
  );
}

function MyWork({ loading, onOpen }: { loading: boolean; onOpen: (screen: Screen, id?: string) => void }) {
  return (
    <div className="space-y-8">
      <Head kicker="Field & delivery" title="My work" detail="Assigned project tasks and visits. The pre-sale visit is listed here on this desk so the day is in one place." />
      <Panel title="Today" count={loading ? undefined : WORK.length}>
        {loading ? <Bones /> : (
          <ul>
            {WORK.map((row) => (
              <WorkRow key={row.id} name={row.name} meta={row.meta} detail={row.detail} mark={row.mark} action={row.action} onAction={() => onOpen(row.screen, row.id)} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Calendar({ loading, onOpen }: { loading: boolean; onOpen: (screen: Screen, id?: string) => void }) {
  return (
    <div className="space-y-8">
      <Head kicker="Field & delivery" title="Calendar" detail="Company calendar merges operational visits and installation starts for solar companies." />
      <Panel title="Monday 16 November" count={loading ? undefined : CALENDAR.length}>
        {loading ? <Bones /> : (
          <ul>
            {CALENDAR.map((row) => (
              <QuietRow key={row.time} name={`${row.time} · ${row.name}`} detail={row.detail} action="Open" onAction={() => onOpen(row.name === "Rudo Ncube" ? "visit" : row.name === "Nyasha Moyo" ? "opportunity" : "project", row.name === "Nyasha Moyo" ? "nyasha" : row.name === "Rudo Ncube" ? "rudo" : "farai")} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Quotes({ loading, startAdding, onOpen }: { loading: boolean; startAdding: boolean; onOpen: (screen: Screen, id?: string) => void }) {
  return (
    <Register
      kicker="Sales"
      title="Quotations"
      detail="A draft quotation displays Proposal Prepared. A sent quotation displays Quote Sent, unless the deal is negotiating."
      create="New quotation"
      startAdding={startAdding}
      loading={loading}
      rows={QUOTES.map((row) => ({ name: row.name, meta: row.meta, detail: row.detail, mark: "waiting" as const, action: "Open", onAction: () => onOpen(row.screen, row.id) }))}
    />
  );
}

function Quote({ focus, onOpen }: { focus: string | null; onOpen: (screen: Screen, id?: string) => void }) {
  const row = QUOTES.find((item) => item.id === focus) ?? QUOTES[0];
  return (
    <div className="space-y-8">
      <button type="button" onClick={() => onOpen("quotations")} className={backBtn}>Back to quotations</button>
      <Head kicker="Quotation" title={row.name} detail={row.detail} />
      <Panel title="Solar template">
        <ul>
          <QuietRow name="System" detail="Home backup 5 kW" />
          <QuietRow name="Inverter" detail="5 kW hybrid · serial required" />
          <QuietRow name="Battery" detail="5 kWh · serial required" />
          <QuietRow name="Panels" detail="8 × 550 W" />
          <QuietRow name="Status" detail={row.meta} />
        </ul>
      </Panel>
    </div>
  );
}

function Leads({ loading, startAdding, onOpen }: { loading: boolean; startAdding: boolean; onOpen: (screen: Screen, id?: string) => void }) {
  const rows = OPPORTUNITIES.filter((row) => row.stage !== "WON" && row.stage !== "LOST");
  return (
    <Register
      kicker="Sales"
      title="Leads"
      detail="New, contacted, and qualified stay on those stages until a visit or a quotation exists."
      create="New lead"
      startAdding={startAdding}
      loading={loading}
      rows={rows.map((row) => ({
        name: row.name,
        meta: STAGES.find((stage) => stage.id === row.stage)?.label ?? row.stage,
        detail: row.detail,
        mark: "waiting" as const,
        action: "Open",
        onAction: () => onOpen("opportunity", row.id),
      }))}
    />
  );
}

function Customers({ loading, onOpen }: { loading: boolean; onOpen: (screen: Screen, id?: string) => void }) {
  return (
    <div className="space-y-8">
      <Head kicker="Customers" title="Customers" detail="On a solar company, the customer record lists projects and installed systems. There is no second customer product." />
      <Panel title="Customers" count={loading ? undefined : CUSTOMERS.length}>
        {loading ? <Bones /> : (
          <ul>
            {CUSTOMERS.map((row) => (
              <QuietRow key={row.id} name={row.name} detail={row.detail} action="Open" onAction={() => onOpen("customer", row.id)} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Customer({ focus, onOpen }: { focus: string | null; onOpen: (screen: Screen, id?: string) => void }) {
  const row = CUSTOMERS.find((item) => item.id === focus) ?? CUSTOMERS[0];
  const project = PROJECTS.find((item) => item.id === row.id);
  return (
    <div className="space-y-8">
      <button type="button" onClick={() => onOpen("customers")} className={backBtn}>Back to customers</button>
      <Head kicker="Customer" title={row.name} detail={row.detail} />
      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Projects">
          {project ? (
            <ul>
              <QuietRow name={project.status} detail={project.attention} action="Open" onAction={() => onOpen("project", project.id)} />
            </ul>
          ) : (
            <EmptyNote title="No project" detail="A project starts when the solar deal is won." />
          )}
        </Panel>
        <Panel title="Installed systems">
          <EmptyNote title="None yet" detail="The system is registered at handover and then shows on the customer and in the portal." />
        </Panel>
      </div>
    </div>
  );
}

function Social({ onOpen }: { onOpen: (screen: Screen, id?: string) => void }) {
  return (
    <div className="space-y-8">
      <Head kicker="Sales" title="Social Inbox" detail="Shared inbox. A social lead opens the same solar opportunity once a lead exists." />
      <Panel title="Waiting">
        <ul>
          <QuietRow name="Amina Cruz" detail="Facebook message about backup power. Lead is New Lead." action="Open lead" onAction={() => onOpen("opportunity", "amina")} />
        </ul>
      </Panel>
    </div>
  );
}

function Stock({ loading, kind }: { loading: boolean; kind: "products" | "inventory" }) {
  return (
    <div className="space-y-8">
      <Head kicker="Products & stock" title={kind === "products" ? "Products" : "Inventory"} detail="Inverters and batteries need serials. Panels do not. A scheduled installation warns when reserved equipment is not issued." />
      <Panel title={kind === "products" ? "Catalogue" : "On hand"} count={loading ? undefined : PRODUCTS.length}>
        {loading ? <Bones /> : (
          <ul>
            {PRODUCTS.map((row) => (
              <QuietRow key={row.name} name={row.name} detail={row.detail} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Packages({ loading }: { loading: boolean }) {
  return (
    <div className="space-y-8">
      <Head kicker="Products & stock" title="Packages" detail="Packages are what a solar quotation is built from." />
      <Panel title="Packages" count={loading ? undefined : PACKAGES.length}>
        {loading ? <Bones /> : (
          <ul>
            {PACKAGES.map((row) => (
              <QuietRow key={row.name} name={row.name} detail={row.detail} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function TeamPage({ loading }: { loading: boolean }) {
  return (
    <div className="space-y-8">
      <Head kicker="Management" title="Team" detail="Sales owns the pipeline. Field roles are project manager, engineer, technician, and installer. There is no separate technician login." />
      <Panel title="Sunline Solar" count={loading ? undefined : TEAM.length}>
        {loading ? <Bones /> : (
          <ul>
            {TEAM.map((row) => (
              <QuietRow key={row.name} name={row.name} detail={row.detail} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Reports({ onOpen }: { onOpen: (screen: Screen, id?: string) => void }) {
  return (
    <div className="space-y-8">
      <Head kicker="Intelligence" title="Reports" detail="Shared reports. Solar stage counts below are the board, not a separate delivery report." />
      <Panel title="Pipeline">
        <ul>
          {STAGES.map((stage) => {
            const count = OPPORTUNITIES.filter((row) => row.stage === stage.id).length;
            return <QuietRow key={stage.id} name={stage.label} detail={`${count} on this desk`} action="Open" onAction={() => onOpen("pipeline")} />;
          })}
        </ul>
      </Panel>
    </div>
  );
}

function Ask({ title }: { title: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  return (
    <div className="space-y-8">
      <Head kicker="Intelligence" title={title} detail="Ask about a solar job already on this desk. This does not call the live agent." />
      <form
        className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          const text = question.trim();
          if (text.length < 2) return;
          setAnswer("Farai Dube is in progress. The installation is scheduled and the inverter is not issued.");
        }}
      >
        <label className="block">
          <span className="text-[13px] font-medium">Question</span>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} className={field} placeholder="What needs attention on Farai Dube?" />
        </label>
        <button type="submit" className={`${limeBtn} mt-4`}>Ask</button>
        {answer ? <p className="mt-4 text-[14px] text-sales-text-secondary" role="status">{answer}</p> : null}
      </form>
    </div>
  );
}

function Documents() {
  return (
    <div className="space-y-8">
      <Head kicker="Management" title="Documents" detail="Assessment photos, installation photos, warranties, and manuals stay on the visit or the project." />
      <Panel title="Recent">
        <ul>
          <QuietRow name="Chipo Ndlovu · completed installation" detail="Installation photograph · not a QA record" />
          <QuietRow name="Nyasha Moyo · roof" detail="Site visit photo · assessment completed" />
        </ul>
      </Panel>
    </div>
  );
}

function Billing() {
  return (
    <div className="space-y-8">
      <Head kicker="Management" title="Billing" detail="Company plan billing. Customer installation balances sit on the project, not here." />
      <Panel title="Plan">
        <ul>
          <QuietRow name="Sunline Solar" detail="Solar Installation preset · sample desk" />
        </ul>
      </Panel>
    </div>
  );
}

function Settings({ companyName }: { companyName: string }) {
  const [preset, setPreset] = useState<"SOLAR_INSTALLATION" | "GENERAL_TRADES">("SOLAR_INSTALLATION");
  return (
    <div className="space-y-8">
      <Head kicker="Management" title="Settings" detail={`${companyName}. The sales workflow preset decides whether the pipeline is the solar board and whether projects and my work appear.`} />
      <form className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4" onSubmit={(event) => event.preventDefault()}>
        <fieldset className="space-y-2">
          <legend className="text-[15px] font-semibold">Sales workflow</legend>
          <label className="mt-3 flex items-center gap-2 text-[14px]">
            <input type="radio" name="preset" checked={preset === "SOLAR_INSTALLATION"} onChange={() => setPreset("SOLAR_INSTALLATION")} />
            Solar Installation
          </label>
          <label className="flex items-center gap-2 text-[14px]">
            <input type="radio" name="preset" checked={preset === "GENERAL_TRADES"} onChange={() => setPreset("GENERAL_TRADES")} />
            General Trades
          </label>
        </fieldset>
        <p className="mt-4 text-[14px] text-sales-text-secondary" role="status">
          {preset === "SOLAR_INSTALLATION"
            ? "Pipeline uses the ten derived solar stages. Projects and My work stay in the menu."
            : "Pipeline would return to the general trades board. Projects and My work leave the menu. This desk does not switch the shell."}
        </p>
      </form>
    </div>
  );
}

function States() {
  return (
    <div className="space-y-8">
      <Head kicker="Studio" title="Screen states" detail="Empty, error, and loading, using the same rows as the solar desk." />
      <Panel title="Empty">
        <EmptyNote title="No open projects" detail="Won deals become projects. Nothing is waiting on this view." />
      </Panel>
      <Panel title="Error">
        <div className="px-4 py-6">
          <p className="text-[15px] font-semibold" role="alert">The project could not be loaded.</p>
          <button type="button" className={`${lineBtn} mt-3`} data-state="error">Try again</button>
        </div>
      </Panel>
      <Panel title="Loading">
        <Bones />
      </Panel>
    </div>
  );
}

function SignIn({ dark, onToggleDark, onEnter }: { dark: boolean; onToggleDark: () => void; onEnter: () => void }) {
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[13px] font-medium text-sales-text-muted">Sunline Solar</p>
        <button type="button" className={lineBtn} aria-pressed={dark} onClick={onToggleDark}>
          {dark ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
          {dark ? "Light" : "Dark"}
        </button>
      </div>
      <h1 className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">Sign in</h1>
      <p className="mt-2 text-[14px] text-sales-text-secondary">Solar installation desk. Any password of 4 characters opens the mock.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const password = String(data.get("password") ?? "");
          if (password.length < 4) {
            setError("Enter a password of at least 4 characters.");
            return;
          }
          setError(null);
          onEnter();
        }}
      >
        <label className="block">
          <span className="text-[13px] font-medium">Email</span>
          <input name="email" type="email" defaultValue="tatenda@sunline.example" className={field} />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Password</span>
          <span className="relative mt-1.5 block">
            <input name="password" type={show ? "text" : "password"} className={`${field} mt-0 pr-11`} />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[8px] p-2" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((value) => !value)}>
              {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            </button>
          </span>
        </label>
        {error ? <p className="text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}
        <button type="submit" className={`${limeBtn} w-full`}>Enter the desk</button>
      </form>
      <p className="mt-6 text-[12px] text-sales-text-muted">Companies on this desk: {COMPANIES.map((company) => company.name).join(", ")}.</p>
    </div>
  );
}

function Register({
  kicker,
  title,
  detail,
  create,
  startAdding,
  loading,
  rows,
}: {
  kicker: string;
  title: string;
  detail: string;
  create?: string;
  startAdding?: boolean;
  loading: boolean;
  rows: Array<{ name: string; meta: string; detail: string; mark: "overdue" | "today" | "waiting"; action: string; onAction: () => void }>;
}) {
  const [adding, setAdding] = useState(Boolean(startAdding));
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function add(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    if (next.length < 2) {
      setError("Enter a name.");
      setSaved(null);
      return;
    }
    setError(null);
    setSaved(`${next} is noted on this desk. The live product writes the record.`);
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="space-y-8">
      <Head kicker={kicker} title={title} detail={detail} action={adding ? undefined : create} onAction={create ? () => { setAdding(true); setSaved(null); } : undefined} />
      {adding ? (
        <form onSubmit={add} className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          <h2 className="text-[15px] font-semibold">{create}</h2>
          <label className="mt-4 block">
            <span className="text-[13px] font-medium">Name</span>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} className={field} />
          </label>
          {error ? <p className="mt-2 text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" className={`${inkBtn} h-11 px-4 text-[14px]`}>Save on this desk</button>
            <button type="button" onClick={() => setAdding(false)} className={`${lineBtn} h-11 px-4 text-[14px]`}>Close</button>
          </div>
        </form>
      ) : null}
      {saved ? <p className="text-[14px] text-sales-text-secondary" role="status">{saved}</p> : null}
      <Panel title="Register" count={loading ? undefined : rows.length}>
        {loading ? <Bones /> : rows.length === 0 ? <EmptyNote title="Nothing waiting" detail="When a solar job needs a decision, it shows up here." /> : (
          <ul>
            {rows.map((row) => (
              <WorkRow key={row.name} name={row.name} meta={row.meta} detail={row.detail} mark={row.mark} action={row.action} onAction={row.onAction} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
