import type { Metadata } from 'next';
import { MarketingNav } from '@/app/(marketing)/components/MarketingNav';
import { HeroSection } from '@/app/(marketing)/components/HeroSection';
import { ProblemsSection } from '@/app/(marketing)/components/ProblemsSection';
import { FeaturesSection } from '@/app/(marketing)/components/FeaturesSection';
import { IntelligenceSection } from '@/app/(marketing)/components/IntelligenceSection';
import { RetargetingSection } from '@/app/(marketing)/components/RetargetingSection';
import { PricingSection } from '@/app/(marketing)/components/PricingSection';
import { TestimonialsSection } from '@/app/(marketing)/components/TestimonialsSection';
import { CtaSection } from '@/app/(marketing)/components/CtaSection';
import { MarketingFooter } from '@/app/(marketing)/components/MarketingFooter';

export const metadata: Metadata = {
  title: 'Segmiq — Revenue operating system for service businesses',
  description:
    'Segmiq gives construction, solar, and trade businesses instant WhatsApp follow-ups, AI lead intelligence, and Facebook audience exports. Stop losing leads. Start closing more deals.',
  openGraph: {
    title: 'Segmiq — Revenue operating system for service businesses',
    description:
      'AI-powered lead management for construction, solar, roofing, and trade businesses across Africa.',
    url: 'https://segmiq.com',
    siteName: 'Segmiq',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Segmiq',
    description: 'Revenue operating system for service businesses.',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0C0C0C]">
      <MarketingNav />
      <main>
        <HeroSection />
        <ProblemsSection />
        <FeaturesSection />
        <IntelligenceSection />
        <RetargetingSection />
        <PricingSection />
        <TestimonialsSection />
        <CtaSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
