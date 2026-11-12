export type SidebarDangerNote = {
  title: string;
  body: string;
  action: string | null;
  href: string | null;
};

function billingHref(homeHref: string): string | null {
  if (homeHref.startsWith("/client")) return "/client/billing";
  if (homeHref.startsWith("/solo")) return "/solo/billing";
  return null;
}

/** Danger card replaces tips. An overdue workspace payment comes before other attention. */
export function sidebarDangerNote(input: {
  overdue: boolean;
  attention: number;
  homeHref: string;
}): SidebarDangerNote | null {
  if (input.overdue) {
    const href = billingHref(input.homeHref);
    return {
      title: "Action required",
      body: href
        ? "This workspace payment is overdue."
        : "This workspace payment is overdue. A manager settles billing.",
      action: href ? "Open billing" : null,
      href,
    };
  }
  if (input.attention > 0) {
    const manager = input.homeHref.startsWith("/client");
    return {
      title: "Action required",
      body: manager ? "A message is waiting for a reply." : "A viewing follow-up was due yesterday.",
      action: "Review today",
      href: input.homeHref,
    };
  }
  return null;
}
