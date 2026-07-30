"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { CloudPackagesManager } from "@/app/cloud/components/CloudPackagesManager";
import { CloudAdminGate } from "@/app/cloud/components/CloudAdminGate";
import { CloudPage } from "@/app/cloud/components/CloudPage";
import { SkeletonListRows } from "@/app/cloud/components/SkeletonCard";

type Client = { id: string; name: string };

type ProfileData = {
  slug: string | null;
  is_published?: boolean;
};

export default function CloudPricingPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.role === "SUPER_ADMIN";

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (isAdmin) {
      fetch("/api/clients")
        .then((r) => r.json())
        .then((data: unknown) => {
          if (Array.isArray(data) && (data as Client[]).length > 0) {
            setClients(data as Client[]);
            setSelectedClientId((prev) => prev || (data as Client[])[0]!.id);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (session?.clientId) {
      setSelectedClientId(session.clientId);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [status, isAdmin, session?.clientId]);

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

  if (status === "loading" || loading) {
    return (
      <CloudAdminGate>
        <CloudPage>
          <SkeletonListRows count={3} />
        </CloudPage>
      </CloudAdminGate>
    );
  }

  return (
    <CloudAdminGate>
    <CloudPage>
      <div className="mb-6">
        <p className="cloud-section-label">Public profile</p>
        <p className="max-w-xl text-[13px] leading-relaxed text-[var(--cloud-text-secondary)]">
          Manage the packages shown on your public profile and send them to prospects from the CRM.
        </p>
        {isAdmin && clients.length > 0 && (
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="cloud-select mt-4 min-w-[180px]"
            aria-label="Select workspace"
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
    </CloudPage>
    </CloudAdminGate>
  );
}
