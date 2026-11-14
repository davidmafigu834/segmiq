import type { Metadata } from "next";
import { AgentLinkRoute, agentLinkMetadata } from "@/components/real-estate/funnels/agent-link-route";

export const dynamic = "force-dynamic";

type Params = { params: { slug: string; handle: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return agentLinkMetadata(params.slug, params.handle, null);
}

export default async function AgentPropertyPage({ params }: Params) {
  return <AgentLinkRoute slug={params.slug} handle={params.handle} channel={null} />;
}
