import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  ShieldAlert,
} from "lucide-react";
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
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
              Commercial release decision
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
              {go ? "GO candidate" : "NO-GO"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Missing or stale evidence fails closed. This screen does not infer
              readiness from tables, routes, or feature flags alone.
            </p>
          </div>
          <div className="text-right text-sm text-[var(--text-secondary)]">
            <p>{data.environmentLabel}</p>
            <p className="mt-1 font-mono text-xs">
              {data.deployedRevision?.slice(0, 12) ?? "Revision unknown"}
            </p>
            <p className="mt-1 text-xs">
              Observed {new Date(data.observedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="release-status-heading">
        <h2
          id="release-status-heading"
          className="text-lg font-semibold text-[var(--text-primary)]"
        >
          Release evidence
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.releases.map((release) => (
            <article
              key={release.release}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{release.release}</h3>
                <Status value={release.status} />
              </div>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                Schema: {release.schemaPresent ? "present" : "missing"}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
                {release.blocker ?? "No recorded blocker."}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="live-counts-heading">
        <h2
          id="live-counts-heading"
          className="text-lg font-semibold text-[var(--text-primary)]"
        >
          Observable counts
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Object.entries(data.counts).map(([key, count]) => (
            <article
              key={key}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
            >
              <p className="text-2xl font-semibold tabular-nums">
                {value(count)}
              </p>
              <p className="mt-1 break-words text-xs text-[var(--text-tertiary)]">
                {key.replace(/([A-Z])/g, " $1")}
              </p>
            </article>
          ))}
        </div>
      </section>

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
