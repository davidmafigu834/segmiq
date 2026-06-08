import type { Metadata } from "next";
import SolutionPage, { type SolutionData } from "@/components/marketing/SolutionPage";
import { MessageCircle, TrendingUp, Route, Send, Trophy, Milestone } from "lucide-react";

export const metadata: Metadata = {
  title: "Solar — Segmiq",
  description: "Segmiq for solar installers: reply first, score every enquiry, and show prospects the systems you've already installed.",
};

const data: SolutionData = {
  kicker: "SOLUTIONS · SOLAR",
  h1: "Turn every solar enquiry into an installed system",
  sub: "Solar moves on speed and trust. Segmiq captures, scores, and follows up every enquiry — and shows prospects the systems you have already installed, so you quote first and win more.",
  heroImg: "https://images.unsplash.com/photo-1745187946672-2c1d8cf26a2b?q=70&w=900&h=760&fit=crop&auto=format",
  heroTag1: "POWER THAT STAYS ON",
  heroTag2: "from enquiry to installed system",
  industryLower: "solar",
  problemH2: "When the power's out, the fastest quote wins",
  problemP: "Load-shedding sends a flood of enquiries — and whoever quotes first usually wins. But enquiries scatter across WhatsApp and Facebook, technicians are up on roofs, and your best installations are invisible to the next buyer.",
  steps: [
    { Icon: MessageCircle, t: "Capture every solar enquiry", d: "A conversational form plus Facebook lead ads, with an instant WhatsApp confirmation so the prospect knows a real company replied." },
    { Icon: TrendingUp, t: "Score by intent and budget", d: "Each enquiry is scored 0–100 — residential vs commercial, backup vs full off-grid — so you chase the systems worth quoting." },
    { Icon: Route, t: "Route to the nearest tech", d: "The lead lands with the right installer via a one-tap WhatsApp link, even while crews are on roofs." },
    { Icon: Send, t: "Send your system portfolio", d: "Push past installs, a pricing package (5kW, 10kW, off-grid), and documents to a prospect in seconds." },
    { Icon: Trophy, t: "Learn which systems close", d: "Win analysis reveals which system sizes and sources convert, so your ads target what sells." },
    { Icon: Milestone, t: "Document the install", d: "With Segmiq Cloud, each install becomes a documented project that proves your quality to the next buyer." },
  ],
  stats: [
    { n: "9×", t: "more likely to qualify a solar lead when you reply within five minutes — first quote usually wins." },
    { n: "0", t: "leads lost when an installer leaves — every enquiry and quote stays on the platform." },
    { n: "1", t: "system from enquiry to commissioned install, with the whole team in step." },
  ],
  cloudImg: "https://images.unsplash.com/photo-1706808849802-8f876ade0d1f?q=70&w=900&h=680&fit=crop&auto=format",
  cloudH2: "Show the install, win the street",
  cloudP: "Document each system as a project — panels, inverter, battery, commissioning — with photos and output stats. Send the share link and a neighbour sees exactly what they would get. One install becomes the next three.",
  ctaH2: "See it on your solar leads",
  ctaP: "Bring a week of real enquiries. We'll show you the response times, the missed follow-ups, and the installs hiding in your pipeline.",
  others: [
    { label: "Construction", href: "/solutions/construction" },
    { label: "Roofing", href: "/solutions/roofing" },
    { label: "Electrical & landscaping", href: "/solutions/electrical-landscaping" },
  ],
};

export default function Page() {
  return <SolutionPage {...data} />;
}
