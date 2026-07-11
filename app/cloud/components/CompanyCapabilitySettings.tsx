"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Camera, Loader2, Plus, Save, X } from "lucide-react";
import type {
  ClientCapabilityProfile,
  ClientCapabilityStat,
  ClientCertification,
  ClientTeamMember,
} from "@/lib/cloud/client-capability";

const inputCls =
  "w-full rounded-xl border border-black/[0.1] bg-[#F5F5F0] px-4 py-3 text-[13px] text-[#0a0a0a] placeholder-[#9CA3AF] outline-none focus:border-black/[0.2] font-cloud-body";
const labelCls =
  "mb-1.5 block text-[12px] font-semibold text-[#666660] uppercase tracking-[0.06em] font-cloud-body";
const saveBtnCls =
  "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold disabled:opacity-60 transition-opacity font-cloud-body cursor-pointer bg-[var(--fw-soil)] text-[var(--fw-lime)]";
const sectionCardCls =
  "rounded-[20px] border p-5 space-y-4 bg-white border-[var(--fw-border)]";

async function uploadCapabilityImage(clientId: string, file: File): Promise<string> {
  const res = await fetch("/api/storage/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      clientId,
      purpose: "capability",
      fileSize: file.size,
    }),
  });
  const payload = (await res.json()) as { uploadUrl?: string; publicUrl?: string; error?: string };
  if (!res.ok || !payload.uploadUrl || !payload.publicUrl) {
    throw new Error(payload.error ?? "Upload failed");
  }
  await fetch(payload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  return payload.publicUrl;
}

export function CompanyCapabilitySettings() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [tagline, setTagline] = useState("");
  const [years, setYears] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [industryDraft, setIndustryDraft] = useState("");
  const [certifications, setCertifications] = useState<ClientCertification[]>([]);
  const [teamMembers, setTeamMembers] = useState<ClientTeamMember[]>([]);
  const [stats, setStats] = useState<ClientCapabilityStat[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const applyProfile = useCallback((profile: ClientCapabilityProfile) => {
    setTagline(profile.capability_tagline ?? "");
    setYears(profile.years_in_operation ? String(profile.years_in_operation) : "");
    setIndustries(profile.industries_served);
    setCertifications(
      profile.certifications.length > 0
        ? profile.certifications
        : [{ name: "", issuing_body: "", issued_year: "", certificate_url: "" }]
    );
    setTeamMembers(
      profile.team_members.length > 0
        ? profile.team_members
        : [{ name: "", role: "", bio: "", photo_url: "" }]
    );
    setStats(
      profile.capability_stats.length > 0
        ? profile.capability_stats
        : [{ label: "", value: "", stated_as_of: "" }]
    );
  }, []);

  useEffect(() => {
    if (!session?.clientId) return;
    setLoading(true);
    fetch("/api/cloud/settings/capability")
      .then((r) => r.json())
      .then((data: ClientCapabilityProfile) => applyProfile(data))
      .catch(() => setError("Failed to load company capability settings."))
      .finally(() => setLoading(false));
  }, [session?.clientId, applyProfile]);

  function addIndustry() {
    const next = industryDraft.trim();
    if (!next || industries.includes(next)) return;
    setIndustries((prev) => [...prev, next]);
    setIndustryDraft("");
  }

  async function handleImageUpload(
    file: File,
    onUrl: (url: string) => void,
    key: string
  ) {
    if (!session?.clientId) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image too large. Max 5 MB.");
      return;
    }
    setUploadingKey(key);
    setError("");
    try {
      const url = await uploadCapabilityImage(session.clientId, file);
      onUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingKey(null);
    }
  }

  async function saveCapability() {
    if (!session?.clientId) return;
    setSaving(true);
    setError("");
    const yearsNum = years.trim() ? Number.parseInt(years.trim(), 10) : null;
    const res = await fetch("/api/cloud/settings/capability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capability_tagline: tagline.trim() || null,
        years_in_operation: yearsNum && yearsNum > 0 ? yearsNum : null,
        industries_served: industries,
        certifications: certifications.filter(
          (c) => c.name || c.issuing_body || c.issued_year || c.certificate_url
        ),
        team_members: teamMembers.filter((m) => m.name || m.role || m.bio || m.photo_url),
        capability_stats: stats.filter((s) => s.label && s.value && s.stated_as_of),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Failed to save.");
      return;
    }
    const data = (await res.json()) as ClientCapabilityProfile;
    applyProfile(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return (
      <section>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B7280] font-cloud-body">
          Company capability
        </p>
        <div className={`${sectionCardCls} flex items-center justify-center py-10`}>
          <Loader2 className="h-5 w-5 animate-spin text-[#6B7280]" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B7280] font-cloud-body">
        Company capability
      </p>
      <div className={sectionCardCls}>
        <div>
          <label className={labelCls}>Trust tagline</label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Delivering reliable energy infrastructure since 2014"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Years in operation</label>
          <input
            type="number"
            min={1}
            max={300}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            placeholder="e.g. 12"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Industries served</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={industryDraft}
              onChange={(e) => setIndustryDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addIndustry();
                }
              }}
              placeholder="Add industry and press Enter"
              className={inputCls}
            />
            <button
              type="button"
              onClick={addIndustry}
              className="shrink-0 rounded-xl border border-black/[0.1] bg-white px-3 text-[#666660] hover:text-[#0a0a0a]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {industries.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {industries.map((ind) => (
                <span
                  key={ind}
                  className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F0] px-3 py-1 text-[12px] text-[#4A3828] font-cloud-body"
                >
                  {ind}
                  <button
                    type="button"
                    onClick={() => setIndustries((prev) => prev.filter((x) => x !== ind))}
                    className="text-[#6B7280] hover:text-[#0a0a0a]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className={labelCls}>Certifications</label>
            <button
              type="button"
              onClick={() =>
                setCertifications((prev) => [
                  ...prev,
                  { name: "", issuing_body: "", issued_year: "", certificate_url: "" },
                ])
              }
              className="flex items-center gap-1 text-[11px] font-semibold text-[#4A3828] font-cloud-body"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          <div className="space-y-3">
            {certifications.map((cert, index) => (
              <div key={index} className="rounded-xl border border-black/[0.08] bg-[#FAFAF8] p-3 space-y-2">
                <div className="flex justify-between">
                  <p className="text-[11px] font-bold text-[#8C7B6B] font-cloud-body">Certification {index + 1}</p>
                  {certifications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setCertifications((prev) => prev.filter((_, i) => i !== index))}
                      className="text-[#6B7280] hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <input
                  value={cert.name}
                  onChange={(e) =>
                    setCertifications((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row))
                    )
                  }
                  placeholder="Certification name"
                  className={inputCls}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={cert.issuing_body}
                    onChange={(e) =>
                      setCertifications((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, issuing_body: e.target.value } : row))
                      )
                    }
                    placeholder="Issuing body"
                    className={inputCls}
                  />
                  <input
                    value={cert.issued_year}
                    onChange={(e) =>
                      setCertifications((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, issued_year: e.target.value } : row))
                      )
                    }
                    placeholder="Issued year"
                    className={inputCls}
                  />
                </div>
                <div className="flex items-center gap-3">
                  {cert.certificate_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cert.certificate_url}
                      alt=""
                      className="h-14 w-20 rounded-lg border border-black/[0.08] object-cover"
                    />
                  ) : null}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-black/[0.15] bg-white px-3 py-2 text-[12px] text-[#6B7280] font-cloud-body hover:border-black/[0.25]">
                    <Camera className="h-3.5 w-3.5" />
                    {uploadingKey === `cert-${index}` ? "Uploading…" : "Certificate image"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void handleImageUpload(
                          file,
                          (url) =>
                            setCertifications((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, certificate_url: url } : row))
                            ),
                          `cert-${index}`
                        );
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className={labelCls}>Team members</label>
            <button
              type="button"
              onClick={() =>
                setTeamMembers((prev) => [...prev, { name: "", role: "", bio: "", photo_url: "" }])
              }
              className="flex items-center gap-1 text-[11px] font-semibold text-[#4A3828] font-cloud-body"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          <div className="space-y-3">
            {teamMembers.map((member, index) => (
              <div key={index} className="rounded-xl border border-black/[0.08] bg-[#FAFAF8] p-3 space-y-2">
                <div className="flex justify-between">
                  <p className="text-[11px] font-bold text-[#8C7B6B] font-cloud-body">Team member {index + 1}</p>
                  {teamMembers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTeamMembers((prev) => prev.filter((_, i) => i !== index))}
                      className="text-[#6B7280] hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={member.name}
                    onChange={(e) =>
                      setTeamMembers((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row))
                      )
                    }
                    placeholder="Name"
                    className={inputCls}
                  />
                  <input
                    value={member.role}
                    onChange={(e) =>
                      setTeamMembers((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, role: e.target.value } : row))
                      )
                    }
                    placeholder="Role"
                    className={inputCls}
                  />
                </div>
                <textarea
                  value={member.bio}
                  onChange={(e) =>
                    setTeamMembers((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, bio: e.target.value } : row))
                    )
                  }
                  rows={2}
                  placeholder="Short bio"
                  className={`${inputCls} resize-none`}
                />
                <div className="flex items-center gap-3">
                  {member.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.photo_url}
                      alt=""
                      className="h-14 w-14 rounded-full border border-black/[0.08] object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EDE9E3] text-[12px] font-bold text-[#4A3828]">
                      {member.name ? member.name.slice(0, 2).toUpperCase() : "?"}
                    </div>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-black/[0.15] bg-white px-3 py-2 text-[12px] text-[#6B7280] font-cloud-body hover:border-black/[0.25]">
                    <Camera className="h-3.5 w-3.5" />
                    {uploadingKey === `team-${index}` ? "Uploading…" : "Photo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void handleImageUpload(
                          file,
                          (url) =>
                            setTeamMembers((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, photo_url: url } : row))
                            ),
                          `team-${index}`
                        );
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className={labelCls}>Capability stats</label>
            <button
              type="button"
              onClick={() =>
                setStats((prev) => [...prev, { label: "", value: "", stated_as_of: "" }])
              }
              className="flex items-center gap-1 text-[11px] font-semibold text-[#4A3828] font-cloud-body"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          <p className="mb-3 text-[12px] leading-relaxed text-[#6B7280] font-cloud-body">
            Only enter numbers you can stand behind — these appear with the date you provide, on
            documents shared with your prospects and clients.
          </p>
          <div className="space-y-3">
            {stats.map((stat, index) => (
              <div key={index} className="rounded-xl border border-black/[0.08] bg-[#FAFAF8] p-3 space-y-2">
                <div className="flex justify-between">
                  <p className="text-[11px] font-bold text-[#8C7B6B] font-cloud-body">Stat {index + 1}</p>
                  {stats.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setStats((prev) => prev.filter((_, i) => i !== index))}
                      className="text-[#6B7280] hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <input
                  value={stat.label}
                  onChange={(e) =>
                    setStats((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, label: e.target.value } : row))
                    )
                  }
                  placeholder="Label (e.g. Safety record)"
                  className={inputCls}
                />
                <input
                  value={stat.value}
                  onChange={(e) =>
                    setStats((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, value: e.target.value } : row))
                    )
                  }
                  placeholder="Value (e.g. 8,400 hours, zero lost-time incidents)"
                  className={inputCls}
                />
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#4A3828] font-cloud-body">
                    Stated as of
                  </label>
                  <input
                    type="date"
                    value={stat.stated_as_of}
                    onChange={(e) =>
                      setStats((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, stated_as_of: e.target.value } : row))
                      )
                    }
                    className={inputCls}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => void saveCapability()} disabled={saving} className={saveBtnCls}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saved ? "Saved!" : "Save capability profile"}
        </button>
        {error && <p className="text-[12px] text-red-500 font-cloud-body">{error}</p>}
      </div>
    </section>
  );
}
