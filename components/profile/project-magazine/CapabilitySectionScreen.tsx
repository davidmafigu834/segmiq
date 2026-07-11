import {
  formatCapabilityStatedAsOf,
  getInitialsFromName,
  type ClientCapabilityProfile,
} from "@/lib/cloud/client-capability";

type Props = {
  clientName: string;
  brandColor: string;
  capability: ClientCapabilityProfile;
  publicProjectCount: number;
};

export function CapabilitySectionScreen({
  clientName,
  brandColor,
  capability,
  publicProjectCount,
}: Props) {
  const certs = capability.certifications.filter((c) => c.name || c.issuing_body || c.issued_year);
  const team = capability.team_members.filter((m) => m.name);
  const stats = capability.capability_stats;
  const showGlance =
    capability.years_in_operation ||
    publicProjectCount > 0 ||
    capability.industries_served.length > 0;

  return (
    <section className="border-t border-[rgba(28,20,16,0.10)] py-16">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--fw-text-tertiary)]">
        Company capability
      </p>
      <h2 className="mt-2.5 text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.08] tracking-[-0.02em] [font-family:var(--fw-font-display)]">
        {clientName}
      </h2>
      {capability.capability_tagline && (
        <p className="mt-3 max-w-[56ch] text-[16px] leading-[1.65] text-[var(--fw-text-secondary)]">
          {capability.capability_tagline}
        </p>
      )}

      {showGlance && (
        <div className="mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fw-text-tertiary)]">
            At a glance
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {capability.years_in_operation && (
              <div className="rounded-[14px] border border-[rgba(28,20,16,0.10)] bg-white px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fw-text-tertiary)]">
                  Years in operation
                </p>
                <p className="mt-1 text-[22px] font-bold [font-family:var(--fw-font-display)]">
                  {capability.years_in_operation}
                </p>
              </div>
            )}
            {publicProjectCount > 0 && (
              <div className="rounded-[14px] border border-[rgba(28,20,16,0.10)] bg-white px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fw-text-tertiary)]">
                  Completed projects
                </p>
                <p className="mt-1 text-[22px] font-bold [font-family:var(--fw-font-display)]">
                  {publicProjectCount}
                </p>
              </div>
            )}
          </div>
          {capability.industries_served.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {capability.industries_served.map((ind) => (
                <span
                  key={ind}
                  className="rounded-full border border-[rgba(28,20,16,0.10)] bg-[rgba(28,20,16,0.03)] px-3 py-1 text-[12px] text-[var(--fw-text-secondary)]"
                >
                  {ind}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {certs.length > 0 && (
        <div className="mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fw-text-tertiary)]">
            Certifications
          </p>
          <div className="mt-4 grid gap-4 min-[621px]:grid-cols-2">
            {certs.map((cert, index) => (
              <div
                key={`${cert.name}-${index}`}
                className="overflow-hidden rounded-[16px] border border-[rgba(28,20,16,0.10)] bg-white"
              >
                {cert.certificate_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cert.certificate_url}
                    alt={cert.name || "Certificate"}
                    className="h-36 w-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="p-4">
                  {cert.name && (
                    <p className="text-[16px] font-bold [font-family:var(--fw-font-display)]">{cert.name}</p>
                  )}
                  {(cert.issuing_body || cert.issued_year) && (
                    <p className="mt-1 text-[13px] text-[var(--fw-text-secondary)]">
                      {[cert.issuing_body, cert.issued_year].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {team.length > 0 && (
        <div className="mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fw-text-tertiary)]">
            Team
          </p>
          <div className="mt-4 grid gap-4 min-[621px]:grid-cols-2">
            {team.map((member, index) => (
              <div
                key={`${member.name}-${index}`}
                className="rounded-[16px] border border-[rgba(28,20,16,0.10)] bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  {member.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.photo_url}
                      alt={member.name}
                      className="h-14 w-14 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-[var(--brand-ink)]"
                      style={{ background: brandColor }}
                    >
                      {getInitialsFromName(member.name)}
                    </div>
                  )}
                  <div>
                    <p className="text-[16px] font-bold [font-family:var(--fw-font-display)]">{member.name}</p>
                    {member.role && (
                      <p className="mt-0.5 text-[12px] text-[var(--fw-text-tertiary)]">{member.role}</p>
                    )}
                    {member.bio && (
                      <p className="mt-2 text-[14px] leading-[1.6] text-[var(--fw-text-secondary)]">
                        {member.bio}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.length > 0 && (
        <div className="mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fw-text-tertiary)]">
            Track record
          </p>
          <ul className="mt-4 space-y-3">
            {stats.map((stat, index) => (
              <li
                key={`${stat.label}-${index}`}
                className="rounded-[14px] border border-[rgba(28,20,16,0.10)] bg-white px-4 py-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fw-text-tertiary)]">
                  {stat.label}
                </p>
                <p className="mt-1 text-[15px] leading-[1.55] text-[var(--fw-text-primary)]">
                  {stat.value}
                  <span className="text-[var(--fw-text-tertiary)]">
                    {" "}
                    — as of {formatCapabilityStatedAsOf(stat.stated_as_of)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
