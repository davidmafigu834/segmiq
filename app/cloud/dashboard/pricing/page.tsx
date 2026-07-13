"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { CloudPackagesManager } from "@/app/cloud/components/CloudPackagesManager";
import { CloudAdminGate } from "@/app/cloud/components/CloudAdminGate";

type Client = { id: string; name: string };

type ProfileData = {
  slug: string | null;
  is_published?: boolean;
};

export default function CloudPricingPage() {
  const { data: session } = useSession();
  const isAdmin = session?.role === "AGENCY_ADMIN";

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [profileSlug, setProfileSlug] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/clients")
        .then((r) => r.json())
        .then((data: unknown) => {
          if (Array.isArray(data)) {
            setClients(data as Client[]);
            if ((data as Client[]).length > 0) setSelectedClientId((data as Client[])[0]!.id);
          }
        })
        .catch(() => {});
    } else if (session?.clientId) {
      setSelectedClientId(session.clientId);
    }
  }, [isAdmin, session?.clientId]);

  const fetchProfile = useCallback(() => {
    if (!selectedClientId) return;
    fetch(`/api/clients/${selectedClientId}/profile`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProfileData | null) => {
        setProfileSlug(data?.slug ?? null);
      })
      .catch(() => setProfileSlug(null));
  }, [selectedClientId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <CloudAdminGate>
    <div className="min-h-screen bg-[#F5F5F0] px-5 py-4 pb-28 font-cloud-body lg:px-8 lg:pb-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B7280]">
            Public profile
          </p>
          <h1 className="font-cloud-display text-[26px] leading-tight text-[#0a0a0a]">Pricing</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[#666660]">
            Manage the packages shown on your public profile and send them to prospects from the CRM.
          </p>
          {isAdmin && clients.length > 0 && (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="mt-4 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-[#666660] outline-none"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedClientId ? (
          <CloudPackagesManager clientId={selectedClientId} profileSlug={profileSlug} />
        ) : null}
      </div>
    </div>
    </CloudAdminGate>
  );
}
