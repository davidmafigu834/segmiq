"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { CloudPackagesManager } from "@/app/cloud/components/CloudPackagesManager";
import { CloudAdminGate } from "@/app/cloud/components/CloudAdminGate";
import { CloudPage } from "@/app/cloud/components/CloudPage";

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
    <CloudPage>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="cloud-section-label">Public profile</p>
          <p className="max-w-xl text-[13px] leading-relaxed text-[var(--cloud-text-secondary)]">
            Manage the packages shown on your public profile and send them to prospects from the CRM.
          </p>
          {isAdmin && clients.length > 0 && (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="cloud-input mt-4 h-auto w-auto py-2"
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
    </CloudPage>
    </CloudAdminGate>
  );
}
