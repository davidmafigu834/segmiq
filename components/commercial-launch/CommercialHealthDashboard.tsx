import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  ShieldAlert,
} from "lucide-react";
import { Fact, Panel, QuietRow, WorkRow } from "@/components/platform/workbench";
import { LaunchModeForm } from "./LaunchModeForm";
import type {
  CommercialHealthSnapshot,
  ReadinessStatus,
} from "@/lib/commercial-launch/types";

function Status({ value }: { value: ReadinessStatus | string }) {
  const pass = value === "PASS" || value === "LIVE_VERIFIED";
  const unknown = value === "UNKNOWN";
  const Icon = pass ? CheckCircle2 : unknown ? CircleHelp : ShieldAlert;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
      <Icon
        size={13}
        aria-hidden="true"
        className={
          pass
            ? "text-[var(--success)]"
            : unknown
              ? "text-[var(--warning)]"
              : "text-[var(--error)]"
        }
      />
      {value.replaceAll("_", " ")}
    </span>
  );
}

function value(value: number | null): string {
  return value == null ? "Unknown" : value.toLocaleString();
}

export function CommercialHealthDashboard({
  data,
}: {
  data: CommercialHealthSnapshot;
}) {
  const go =
    data.releases.every(
      (release) =>
        release.status === "END_TO_END_VERIFIED" ||
        release.status === "LIVE_VERIFIED",
    ) && data.readiness.every((check) => check.status === "PASS");
  const failed = data.readiness.find((check) => check.status !== "PASS");
  return (
    <div className="space-y-8">
      <Fact
        name={go ? "This release is a GO candidate." : "This release is NO-GO."}
        detail={
          failed
            ? `${failed.label}. ${failed.detail}`
            : `${data.environmentLabel}. Missing or stale evidence fails closed.`
        }
        action="Open commercial"
        href="/dashboard/commercial"
      />
      <Panel title="Release evidence" count={data.releases.length}>
        <ul>
          {data.releases.map((release) => {
            const clear =
              release.status === "END_TO_END_VERIFIED" || release.status === "LIVE_VERIFIED";
            return (
              <WorkRow
                key={release.release}
                name={release.release}
                meta={release.status.replaceAll("_", " ")}
                detail={release.blocker ?? (release.schemaPresent ? "Schema present." : "Schema missing.")}
                mark={clear ? "waiting" : "overdue"}
                action="Open commercial"
                href="/dashboard/commercial"
              />
            );
          })}
        </ul>
      </Panel>
      <Panel title="Observable counts">
        <ul>
          {Object.entries(data.counts).map(([key, count]) => (
            <QuietRow
              key={key}
              name={value(count)}
              detail={key.replace(/([A-Z])/g, " $1")}
            />
          ))}
        </ul>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <section
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
          aria-labelledby="readiness-heading"
        >
          <h2 id="readiness-heading" className="font-semibold">
            Readiness gates
          </h2>
          <div className="mt-3 divide-y divide-[var(--border)]">
            {data.readiness.map((check) => (
              <article key={check.key} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium">{check.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                      {check.detail}
                    </p>
                    {check.evidenceRef ? (
                      check.evidenceRef.startsWith("https://") ? (
                        <a
                          className="mt-1 inline-block break-all text-xs text-[var(--accent)] underline underline-offset-2"
                          href={check.evidenceRef}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open evidence
                        </a>
                      ) : (
                        <p className="mt-1 break-all font-mono text-xs text-[var(--text-tertiary)]">
                          Evidence: {check.evidenceRef}
                        </p>
                      )
                    ) : null}
                  </div>
                  <Status value={check.status} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
          aria-labelledby="features-heading"
        >
          <h2 id="features-heading" className="font-semibold">
            Server feature gates
          </h2>
          <div className="mt-3 divide-y divide-[var(--border)]">
            {data.features.map((feature) => (
              <div
                key={feature.key}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {feature.key.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    {feature.detail}
                  </p>
                </div>
                <Status value={feature.active ? "PASS" : "OFF"} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <LaunchModeForm
        currentMode={data.control.mode}
        version={data.control.version}
        writesEnabled={data.control.writesEnabled}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <section
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
          aria-labelledby="reconciliation-heading"
        >
          <h2 id="reconciliation-heading" className="font-semibold">
            Open reconciliation findings
          </h2>
          {data.reconciliation.length ? (
            <div className="mt-3 divide-y divide-[var(--border)]">
              {data.reconciliation.map((finding) => (
                <article key={finding.id} className="py-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>{finding.findingType.replaceAll("_", " ")}</span>
                    <Status value={finding.status} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    {finding.detail}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <AlertCircle
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              />
              No findings source is available. This is unknown, not a passing
              reconciliation.
            </p>
          )}
        </section>

        <section
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
          aria-labelledby="audit-heading"
        >
          <h2 id="audit-heading" className="font-semibold">
            Commercial audit stream
          </h2>
          {data.audit.length ? (
            <div className="mt-3 divide-y divide-[var(--border)]">
              {data.audit.map((event) => (
                <div key={event.id} className="py-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>{event.eventType.replaceAll("_", " ")}</span>
                    <time className="text-xs text-[var(--text-tertiary)]">
                      {new Date(event.recordedAt).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-1 break-all text-xs text-[var(--text-tertiary)]">
                    {event.subject}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              No matching audit events are available.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
