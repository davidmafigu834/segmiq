# Salesperson dashboard mobile redesign

The Real Estate salesperson My Day screen was recomposed from the written screenshot findings. No screenshot file was attached in this session. The corrections follow that written review.

This was not browser-tested. No local build, lint, or TypeScript check was run. Vercel was not deployed.

## 1. Screenshot-based findings

The review described a functional dashboard that still failed as a phone working screen:

- The date, “My day”, the next-action summary, and a large lime New button were stacked loosely under the wordmark bar.
- Needs your attention repeated icon, badge, tags, context, and a side action in a cramped row, and the list ran long enough to bury later sections.
- Overdue follow-ups showed up again in Today’s schedule and Sales Copilot.
- My active work sat too far down.
- Sales Copilot read as another overdue list.
- Recent updates, when empty, still occupied a closing panel.
- My sales snapshot was already collapsed, but the disclosure looked like a leftover box.

## 2. Hallmark guidance applied

The Hallmark skill at `.cursor/skills/hallmark/SKILL.md` (v1.1.0) was read before editing.

This is a redesign of an existing app screen, not a new marketing page. `design.md` locks the Workbench macrostructure, the modern-minimal genre, and the existing sales tokens. The brief also says not to invent a second visual language. The catalog theme was not rotated. Lime stays on the primary create action. Headings stay roman. No new hex values were added in components.

Inferences used while editing: the user is a real estate agent on a phone; the job of the screen is to show what needs a response, what work is live, what is scheduled today, and one suggested next step; the tone is utilitarian.

Pre-emit critique on `AgentDailyWorkspace.tsx`: P5 H5 E4 S5 R4 V4.

## 3. Header redesign

On viewports below the 1100px `layout` breakpoint, My Day now has its own header:

- Date on its own line, 12px, muted. Example shape: Saturday 17 October.
- Title “My Day” at 24px, display weight, roman.
- Summary on the next line, 13px, for example “12 items need your next action”.
- No period on that summary line. No second large title block.

The shell wordmark bar is unchanged. The desktop header remains `RePageHeader` with “Today's work”, the same summary, and the existing New opportunity / More actions pair. That header is hidden below 1100px.

## 4. New button

`ReQuickActions` is unchanged. On a phone it is still the lime “New” control that opens the existing create sheet (opportunity, buyer, inquiry, matching, viewing, log call).

It now sits on the title row, shrink-wrapped, at the existing 44px height. It is not full width and it is not in a menu. From 640px to 1099px the same control switches to the existing “New opportunity” plus “More actions” pair, still inside that compact header.

## 5. Attention section

Needs your attention stays first.

- Section title, count, and the Pipeline link are unchanged.
- Group labels (“Overdue 3”) are a metadata line, not a filled bar. `ReGroupLabel` is only used here.
- Each item is a stacked card below 640px: name and urgency, role or stage, the reason line, then a bottom row with the real primary action and the existing more menu.
- The side icon column is not used on these cards.
- The phone shows 3 items, then “Show all”. Desktop still previews 8. “Show fewer” returns to that preview. The desktop toggle is hidden when the full list already fits in the 8-item preview.

## 6. Section hierarchy

Phone order is now:

1. Compact header
2. Needs your attention
3. My active work
4. Today’s schedule
5. Sales Copilot, including recent updates
6. My sales snapshot

Desktop grid placement is preserved with order utilities: the snapshot stays first at 1100px and up, and the schedule still fills the column beside attention. Active work and Copilot stay full width under that row.

## 7. My active work

On phones, the section is three compact tiles: Buyers and tenants, Property opportunities, and Transactions in progress. Each tile shows one status line from the existing metrics and a View all link. It does not repeat the attention rows.

At 1100px and up, the previous buyer figures, opportunity rows, and transaction rows are unchanged.

## 8. Today’s schedule

Schedule rows are a time, a name, a type line, Open, and the follow-up menu when one exists. They do not use the attention card.

Overdue follow-ups are left in Needs your attention and are not repeated in the schedule. Viewings and follow-ups that are due today stay, in time order. If nothing is planned today, the empty state says that overdue items remain in attention.

## 9. Sales Copilot

The embedded Real Estate section no longer borrows the light-theme ink and extra padding used by the standalone sales Copilot. Cards use the dashboard surface.

The first card is labelled “Suggested next” and leads with the existing explanation when it is not the same text as the title. A second card can follow. Further actions stay behind View all Tasks. Button labels are still the ones the workspace already returns (View task, View chat, and the other supported primaries).

The standalone, non-embedded Copilot used by other industries keeps its previous light treatment and still shows up to three cards.

Copilot tasks are not removed when the same person is also in attention. The sections are shorter and labelled differently. They can still name the same customer.

## 10. Recent updates

When the embedded section has no updates, it is one line: “Recent updates · Nothing new in the last 24 hours.” (or the existing “since your last visit” sentence). When updates exist, the previous list remains. The non-embedded Copilot empty state is unchanged.

## 11. Shared components refined

- `ReGroupLabel`: metadata line instead of a filled strip. Only the dashboard uses it.
- `ReMetricOverview`: optional `quiet` row. My sales snapshot uses it. Other overviews keep the bordered Show/Hide control. Desktop still shows the metrics without the button.
- `ReWorkItem` was not changed. Attention and schedule no longer use it on this screen. Opportunity and transaction rows on the desktop active-work grid still use it.

## 12. Desktop regression considerations

- The desktop title, snapshot-first grid, attention-beside-schedule columns, and the detailed active-work panels stay.
- Schedule rows on desktop use the lighter time row, and overdue follow-ups are no longer listed there.
- Attention on desktop still previews 8 before “Show all”.
- Copilot styling changes are limited to `sales-copilot-daily--embedded` inside `data-re-workspace="true"`.

## 13. Files modified

- `components/real-estate/AgentDailyWorkspace.tsx`
- `components/real-estate/ui/primitives.tsx`
- `components/dashboard/sales/SalesCopilotDailyWorkspace.tsx`
- `app/company-dashboard.css`
- `docs/implementation/SALESPERSON_DASHBOARD_MOBILE_REDESIGN.md`

## 14. Lightweight verification

`git diff --check` on the four code files reported only the usual Windows note that LF will be stored as CRLF. It did not list trailing whitespace or conflict markers.

No browser, localhost, build, lint, or full typecheck was run.

## 15. Known remaining issues

- A customer can still appear in both Needs your attention and Sales Copilot. The Copilot card is shorter, but it is not a different record set.
- A follow-up due today can still appear in attention and in the schedule if both sources include it. Only overdue follow-ups were dropped from the schedule.
- Phone active-work tiles do not list the individual opportunities or transactions. Those lists remain on desktop and on their own pages.
- The New control is still the shared lime button. Between 640px and 1099px it becomes “New opportunity” plus “More actions”, which is wider than the phone “New” label.
- Company manager dashboards were not part of this pass.

## 16. Vercel visual QA checklist

On a phone, signed in as a Real Estate salesperson, open My Day:

- [ ] Date, “My Day”, the summary, and New sit in one compact block. New is on the title row and opens the create sheet.
- [ ] The first section under the header is visible without a large empty gap.
- [ ] Attention items read top to bottom, with the open action on its own row. Only a few items show before Show all.
- [ ] My active work appears before Today’s schedule, as three short tiles with View all.
- [ ] Today’s schedule shows times and does not repeat the overdue attention cards.
- [ ] Sales Copilot reads as a suggestion (why, then the task, then View task or View chat), not a second overdue list.
- [ ] An empty recent-updates state is one line.
- [ ] My sales snapshot is a quiet Show row and expands in place.
- [ ] The last section clears the bottom navigation.
- [ ] At desktop width, the snapshot is still first, attention still sits beside the schedule, and the detailed active-work panels are still there.
