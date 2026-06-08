import type { Metadata } from "next";
import SolutionPage, { type SolutionData } from "@/components/marketing/SolutionPage";
import { MessageCircle, TrendingUp, Route, Send, Trophy, Milestone } from "lucide-react";

export const metadata: Metadata = {
  title: "Electrical & landscaping — Segmiq",
  description: "Segmiq for electrical contractors and landscapers: capture, score, and follow up every enquiry, and turn finished work into proof.",
};

const data: SolutionData = {
  kicker: "SOLUTIONS · ELECTRICAL & LANDSCAPING",
  h1: "More booked jobs, less chasing",
  sub: "Whether you wire buildings or transform gardens, Segmiq captures, scores, and follows up every enquiry — and turns your finished work into the proof that books the next job.",
  heroImg: "https://images.unsplash.com/photo-1758101755915-462eddc23f57?q=70&w=900&h=760&fit=crop&auto=format",
  heroTag1: "EVERY JOB DOCUMENTED",
  heroTag2: "from enquiry to booked job",
  industryLower: "electrical & landscaping",
  problemH2: "Small jobs add up — if you don't lose them first",
  problemP: "Electrical and landscaping enquiries come in steadily, but they are easy to drop when you are on the tools or on a site. Quotes slip, follow-ups vanish, and the finished work that would win referrals never gets shown.",
  steps: [
    { Icon: MessageCircle, t: "Capture every enquiry", d: "A conversational form plus Facebook lead ads, with an instant WhatsApp confirmation to the prospect." },
    { Icon: TrendingUp, t: "Score and prioritise", d: "Each enquiry is scored 0–100 on intent, urgency, and budget — so a full rewire or a garden redesign rises above the small stuff." },
    { Icon: Route, t: "Route to the right person", d: "The lead lands via a one-tap WhatsApp link, so nothing waits while you are on the tools." },
    { Icon: Send, t: "Send your work in one tap", d: "Push past jobs, a pricing package, and certificates or plans to a prospect in seconds." },
    { Icon: Trophy, t: "Learn what actually closes", d: "Win analysis shows which job types and sources convert, so you spend time where the bookings are." },
    { Icon: Milestone, t: "Document the job", d: "With Segmiq Cloud, each fit-out or garden becomes a project that proves your quality to the next client." },
  ],
  stats: [
    { n: "9×", t: "more likely to qualify a lead when you reply within five minutes." },
    { n: "0", t: "leads lost when a team member leaves — every enquiry and quote stays on the platform." },
    { n: "1", t: "system from enquiry to booked job, with the whole team in step." },
  ],
  cloudImg: "https://images.unsplash.com/photo-1706808849802-8f876ade0d1f?q=70&w=900&h=680&fit=crop&auto=format",
  cloudH2: "Finished work that books the next job",
  cloudP: "Document each fit-out or garden as a project with photos at every stage. Send the share link and a prospect sees the standard of your work before you have even quoted.",
  ctaH2: "See it on your leads",
  ctaP: "Bring a week of real enquiries. We'll show you the response times, the missed follow-ups, and the jobs hiding in your pipeline.",
  others: [
    { label: "Construction", href: "/solutions/construction" },
    { label: "Solar", href: "/solutions/solar" },
    { label: "Roofing", href: "/solutions/roofing" },
  ],
};

export default function Page() {
  return <SolutionPage {...data} />;
}
