import SolutionPage, { type SolutionData } from "@/components/marketing/SolutionPage";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { MessageCircle, TrendingUp, Route, Send, Trophy, Milestone } from "lucide-react";

export const metadata = pageMetadata({
  title: "Roofing",
  description: "Segmiq for roofing companies: score and follow up every enquiry, and show prospects the roofs you've already done.",
  path: "/solutions/roofing",
});

const data: SolutionData = {
  kicker: "SOLUTIONS · ROOFING",
  h1: "Quote more roofs, chase fewer dead ends",
  sub: "Segmiq captures, scores, and follows up every roofing enquiry — and shows prospects the roofs you have already done, so you win on trust, not just price.",
  heroImg: "https://images.unsplash.com/photo-1646324554833-f0b6a479fa5d?q=70&w=900&h=760&fit=crop&auto=format",
  heroTag1: "EVERY ROOF DOCUMENTED",
  heroTag2: "from enquiry to handover",
  industryLower: "roofing",
  problemH2: "A roofing lead goes cold faster than the quote dries",
  problemP: "Enquiries come in across WhatsApp and Facebook while your crews are up on a roof. Quotes get promised and forgotten, and the roofs you have finished — the best proof you have — sit unseen in a phone.",
  steps: [
    { Icon: MessageCircle, t: "Capture every roofing enquiry", d: "A conversational form plus Facebook lead ads, with an instant WhatsApp confirmation to the prospect." },
    { Icon: TrendingUp, t: "Score it the moment it lands", d: "Each enquiry is scored 0–100 on intent, urgency (a leak vs a re-roof), and budget — so you quote the real jobs first." },
    { Icon: Route, t: "Route to the right crew lead", d: "The lead lands via a one-tap WhatsApp link, so nothing waits while your team is on a roof." },
    { Icon: Send, t: "Send proof in one tap", d: "Push past roofs, a pricing package, and a guarantee document to a prospect in seconds." },
    { Icon: Trophy, t: "Learn what actually closes", d: "Win analysis shows which roof types and sources convert, so your ads and quotes target the work that pays." },
    { Icon: Milestone, t: "Document the roof", d: "With Segmiq Cloud, each roof becomes a before-and-after project that proves your quality to the next homeowner." },
  ],
  stats: [
    { n: "9×", t: "more likely to qualify a roofing lead when you reply within five minutes." },
    { n: "0", t: "leads lost when a crew lead leaves — every enquiry and quote stays on the platform." },
    { n: "1", t: "system from enquiry to handover, with the whole team in step." },
  ],
  cloudImg: "https://images.unsplash.com/photo-1706808849802-8f876ade0d1f?q=70&w=900&h=680&fit=crop&auto=format",
  cloudH2: "Before and after, on one link",
  cloudP: "Document each roof as a project — strip, structure, sheeting, flashing, finish — with photos at every stage. Send the share link and a prospect sees the transformation, not just a price.",
  ctaH2: "See it on your roofing leads",
  ctaP: "Bring a week of real enquiries. We'll show you the response times, the missed follow-ups, and the contracts hiding in your pipeline.",
  others: [
    { label: "Construction", href: "/solutions/construction" },
    { label: "Solar", href: "/solutions/solar" },
    { label: "Electrical & landscaping", href: "/solutions/electrical-landscaping" },
  ],
};

export default function Page() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Solutions", path: "/solutions/roofing" },
          { name: "Roofing", path: "/solutions/roofing" },
        ])}
      />
      <SolutionPage {...data} />
    </>
  );
}
