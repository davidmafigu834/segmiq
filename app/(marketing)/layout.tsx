import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Segmiq — Revenue operating system for service businesses',
  description:
    'AI-powered lead management for construction, solar, roofing, and trade businesses across Africa.',
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0C0C0C]">
      {children}
    </div>
  );
}
