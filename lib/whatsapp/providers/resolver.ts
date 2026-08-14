import { getPrimaryWhatsAppConnection } from "../connections";
import { metaCloudWhatsAppProvider, metaCoexistenceWhatsAppProvider } from "./meta-cloud";
import { temporaryWebWhatsAppProvider } from "./temporary-web";
import type { WhatsAppConnectionRecord, WhatsAppProvider, WhatsAppProviderType } from "./types";

const PROVIDERS: Record<WhatsAppProviderType, WhatsAppProvider> = {
  META_CLOUD: metaCloudWhatsAppProvider,
  TEMPORARY_WEB: temporaryWebWhatsAppProvider,
  META_COEXISTENCE: metaCoexistenceWhatsAppProvider,
};

export function providerForType(type: WhatsAppProviderType): WhatsAppProvider {
  return PROVIDERS[type];
}

export async function resolveWhatsAppProvider(clientId: string): Promise<{
  provider: WhatsAppProvider;
  connection: WhatsAppConnectionRecord | null;
}> {
  const connection = await getPrimaryWhatsAppConnection(clientId);
  return {
    provider: providerForType(connection?.providerType ?? "META_CLOUD"),
    connection,
  };
}
