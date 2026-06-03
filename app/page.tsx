import SegmiqLandingPage from "@/components/marketing/SegmiqLandingPage";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export default function Page() {
  return (
    <main className={inter.className}>
      <SegmiqLandingPage />
    </main>
  );
}
