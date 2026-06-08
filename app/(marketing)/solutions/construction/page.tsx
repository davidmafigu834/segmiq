import SolutionPage, { type SolutionData } from "@/components/marketing/SolutionPage";
import { MessageCircle, TrendingUp, Route, Send, Trophy, Milestone } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Construction",
  description: "Segmiq for construction: capture, score, and follow up every site enquiry, and document every build to win the next contract.",
  path: "/solutions/construction",
});

const data: SolutionData = {
  kicker: "SOLUTIONS · CONSTRUCTION",
  h1: "Win more building contracts, without the chaos",
  sub: "From the first site enquiry to the signed contract, Segmiq captures, scores, and follows up every construction lead — and documents every build so your past work wins the next job.",
  heroImg: "https://images.unsplash.com/photo-1646324554833-f0b6a479fa5d?q=70&w=900&h=760&fit=crop&auto=format",
  heroTag1: "FROM SITE ENQUIRY",
  heroTag2: "to signed contract, in one system",
  industryLower: "construction",
  problemH2: "A building lead is worth too much to lose to a slow reply",
  problemP: "Dozens of enquiries land every week — across sites, WhatsApp, and Facebook. Estimators are on-site, not at a desk. Quotes get sent and then forgotten. And years of finished builds sit buried in someone's phone instead of winning the next tender.",
  steps: [
    { Icon: MessageCircle, t: "Capture every site enquiry", d: "A conversational form on your profile plus Facebook lead ads, with an instant WhatsApp confirmation to the prospect." },
    { Icon: TrendingUp, t: "Score it the moment it lands", d: "Each enquiry is scored 0–100 on intent, budget, and urgency — so your team knows which tenders to chase first." },
    { Icon: Route, t: "Route to the right estimator", d: "The lead lands with the right person via a one-tap WhatsApp link — no enquiry sits unseen while crews are on site." },
    { Icon: Send, t: "Send your portfolio in one tap", d: "Push past builds, a pricing package, and documents to a prospect in seconds, without leaving WhatsApp." },
    { Icon: Trophy, t: "Learn what actually closes", d: "Win analysis reveals which project sizes and lead sources convert — so you spend where the contracts are." },
    { Icon: Milestone, t: "Document the build", d: "With Segmiq Cloud, each project becomes a milestone timeline that proves your quality to the next client." },
  ],
  stats: [
    { n: "9×", t: "more likely to qualify a lead when the first response lands within five minutes." },
    { n: "0", t: "leads or relationships lost when an estimator leaves — it all stays on the platform." },
    { n: "1", t: "system from site enquiry to recorded win, with the whole team in step." },
  ],
  cloudImg: "https://images.unsplash.com/photo-1706808849802-8f876ade0d1f?q=70&w=900&h=680&fit=crop&auto=format",
  cloudH2: "Show the build, win the next one",
  cloudP: "Document each project as a milestone timeline — foundation, slab, roofing, finishing, handover — with photos and stats at every stage. Send a prospect the share link and they don't just see a finished house; they watch a construction documentary. That is what wins the tender.",
  ctaH2: "See it on your building leads",
  ctaP: "Bring a week of real site enquiries. We'll show you the response times, the missed follow-ups, and the contracts hiding in your pipeline.",
  others: [
    { label: "Solar", href: "/solutions/solar" },
    { label: "Roofing", href: "/solutions/roofing" },
    { label: "Electrical & landscaping", href: "/solutions/electrical-landscaping" },
  ],
};

export default function Page() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Solutions", path: "/solutions/construction" },
          { name: "Construction", path: "/solutions/construction" },
        ])}
      />
      <SolutionPage {...data} />
    </>
  );
}
