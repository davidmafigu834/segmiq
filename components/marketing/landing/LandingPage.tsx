import LandingFeatures from "@/components/marketing/landing/LandingFeatures";
import LandingHero from "@/components/marketing/landing/LandingHero";
import LandingSections from "@/components/marketing/landing/LandingSections";

export default function LandingPage() {
  return (
    <div className="overflow-x-clip bg-[#0c0c0c] text-white">
      <LandingHero />
      <LandingFeatures />
      <LandingSections />
    </div>
  );
}
