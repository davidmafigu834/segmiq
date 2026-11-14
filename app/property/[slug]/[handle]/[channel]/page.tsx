import type { Metadata } from "next";
import { AgentLinkRoute, agentLinkMetadata } from "@/components/real-estate/funnels/agent-link-route";

export const dynamic = "force-dynamic";

type Params = { params: { slug: string; handle: string; channel: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return agentLinkMetadata(params.slug, params.handle, params.channel);
}

export default async function AgentChannelPropertyPage({ params }: Params) {
  return <AgentLinkRoute slug={params.slug} handle={params.handle} channel={params.channel} />;
}
