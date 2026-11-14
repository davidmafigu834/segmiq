import { cache } from "react";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAgentLink } from "@/lib/real-estate/funnels/service";
import { PropertyRoute, PropertyUnavailable, propertyMetadata } from "@/components/real-estate/funnels/property-route";

const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const resolve = cache(async (slug: string, handle: string, channel: string | null) => {
  if (!SEGMENT.test(slug) || !SEGMENT.test(handle) || (channel != null && !SEGMENT.test(channel))) return null;
  const result = await resolveAgentLink(createAdminClient(), slug, handle, channel);
  return result.ok ? result.token : null;
});

export async function agentLinkMetadata(slug: string, handle: string, channel: string | null): Promise<Metadata> {
  if (!SEGMENT.test(slug)) return { title: "Property unavailable", robots: { index: false, follow: false } };
  const token = await resolve(slug, handle, channel);
  if (token) return propertyMetadata(slug, token);
  return { ...(await propertyMetadata(slug, null)), robots: { index: false, follow: false } };
}

/** An unknown or stale agent handle still shows the property, without attribution. */
export async function AgentLinkRoute({ slug, handle, channel }: { slug: string; handle: string; channel: string | null }) {
  if (!SEGMENT.test(slug)) return <PropertyUnavailable />;
  const token = await resolve(slug, handle, channel);
  return <PropertyRoute slug={slug} token={token} />;
}
