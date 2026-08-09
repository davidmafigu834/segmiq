import Image from "next/image";
import type { TrustedClient } from "@/lib/marketing/trusted-clients";

export default function ClientLogo({ client }: { client: TrustedClient }) {
  return (
    <div className="flex h-[54px] items-center justify-center px-3.5 sm:h-[60px] sm:px-4 md:h-[64px] md:px-[18px]">
      <Image
        src={client.logo}
        alt={client.name}
        width={client.width}
        height={client.height}
        className="marketing-client-logo max-h-[34px] w-auto max-w-[120px] object-contain opacity-[0.58] grayscale transition-[opacity,filter] duration-200 ease-out hover:opacity-100 hover:grayscale-0 sm:max-h-[38px] sm:max-w-[140px] md:max-h-[40px] md:max-w-[150px]"
      />
    </div>
  );
}
