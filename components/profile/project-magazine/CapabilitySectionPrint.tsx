import {
  formatCapabilityStatedAsOf,
  getInitialsFromName,
  type ClientCapabilityProfile,
} from "@/lib/cloud/client-capability";
import { printImageUrl } from "@/lib/cloud/project-magazine";

type Props = {
  clientName: string;
  brandColor: string;
  capability: ClientCapabilityProfile;
  publicProjectCount: number;
};

export function CapabilitySectionPrint({
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
    <div className="print-capability-block">
      <h2 className="print-section-title">Company capability</h2>
      <p className="print-capability-client">{clientName}</p>
      {capability.capability_tagline && (
        <p className="print-capability-tagline">{capability.capability_tagline}</p>
      )}

      {showGlance && (
        <div className="print-capability-subsection">
          <p className="print-capability-label">At a glance</p>
          <div className="print-capability-glance">
            {capability.years_in_operation && (
              <div className="print-capability-stat-card">
                <p className="print-capability-stat-label">Years in operation</p>
                <p className="print-capability-stat-value">{capability.years_in_operation}</p>
              </div>
            )}
            {publicProjectCount > 0 && (
              <div className="print-capability-stat-card">
                <p className="print-capability-stat-label">Completed projects</p>
                <p className="print-capability-stat-value">{publicProjectCount}</p>
              </div>
            )}
          </div>
          {capability.industries_served.length > 0 && (
            <div className="print-capability-tags">
              {capability.industries_served.map((ind) => (
                <span key={ind} className="print-capability-tag">
                  {ind}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {certs.length > 0 && (
        <div className="print-capability-subsection">
          <p className="print-capability-label">Certifications</p>
          <div className="print-capability-cert-grid">
            {certs.map((cert, index) => (
              <div key={`${cert.name}-${index}`} className="print-capability-cert-card">
                {cert.certificate_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={printImageUrl(cert.certificate_url)}
                    alt={cert.name || "Certificate"}
                    className="print-capability-cert-img"
                    loading="eager"
                    decoding="sync"
                  />
                )}
                <div className="print-capability-cert-body">
                  {cert.name && <p className="print-capability-cert-name">{cert.name}</p>}
                  {(cert.issuing_body || cert.issued_year) && (
                    <p className="print-capability-cert-meta">
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
        <div className="print-capability-subsection">
          <p className="print-capability-label">Team</p>
          <div className="print-capability-team-grid">
            {team.map((member, index) => (
              <div key={`${member.name}-${index}`} className="print-capability-team-card">
                {member.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={printImageUrl(member.photo_url)}
                    alt={member.name}
                    className="print-capability-team-photo"
                    loading="eager"
                    decoding="sync"
                  />
                ) : (
                  <div
                    className="print-capability-team-fallback"
                    style={{ background: brandColor }}
                  >
                    {getInitialsFromName(member.name)}
                  </div>
                )}
                <div>
                  <p className="print-capability-team-name">{member.name}</p>
                  {member.role && <p className="print-capability-team-role">{member.role}</p>}
                  {member.bio && <p className="print-capability-team-bio">{member.bio}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.length > 0 && (
        <div className="print-capability-subsection">
          <p className="print-capability-label">Track record</p>
          <ul className="print-capability-stats">
            {stats.map((stat, index) => (
              <li key={`${stat.label}-${index}`} className="print-capability-stat-row">
                <p className="print-capability-stat-label">{stat.label}</p>
                <p className="print-capability-stat-text">
                  {stat.value}
                  <span className="print-capability-stat-date">
                    {" "}
                    — as of {formatCapabilityStatedAsOf(stat.stated_as_of)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
