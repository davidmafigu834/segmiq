# SegmiQ Real Estate — UI Phase 5
## WhatsApp Sales Hub, sales intelligence, and Copilot

Date: 17 October 2026

This is a frontend pass on the existing Sales Hub. The WhatsApp gateway, message send path, session model, Copilot tools, and other industries stay in place.

No browser check, local build, or Vercel build was run.

---

## 1. Executive summary

The conversation list, thread, composer, and assignment controls were already a working three-pane hub. This phase did not replace that engine.

What changed:

- The salesperson chat no longer paints a separate WhatsApp-green wallpaper or a forced dark mobile palette. Bubbles, composer, and wallpaper use the existing sales surfaces. Outgoing messages are no longer a lime wash.
- On a phone, the open chat is still full screen. Sales tools open as a full-screen sheet instead of an 85% drawer. The inbox title is **Inbox**.
- Real-estate conversations get a **Sales tools** header action. Other industries keep the existing Copilot header button.
- The Real Estate intelligence rail is reordered: customer, next action, classification or search/opportunity, then Copilot. Buyer requirements are not shown for sellers. An unclassified enquiry offers four choices and does not save until the existing create or link action is confirmed.
- A Copilot reply labelled **Use draft** fills the composer. If a draft is already typed, the agent chooses **Use draft** or **Keep mine**. Nothing is sent by inserting a draft.
- Real-estate manager chats use this same rail. Other company inboxes keep the company insight rail. Support conversations on the company inbox stay on that rail.

## 2. Hallmark skill located and read

Read `c:\Users\ddsta\Documents\segmiq\.cursor\skills\hallmark\SKILL.md` (v1.1.0) and the redesign verb. `design.md` locks Workbench / modern-minimal / Segmiq CRM. Diversification stays inverted: this phase uses the same system as Phases 1–4. `.hallmark/log.json` has a Phase 5 entry. No new `tokens.css`.

Pre-emit critique on the intelligence rail: P4 H4 E4 S4 R4 V3. Variety is intentionally low because the product system is shared.

## 3. Existing design system reused

Sales surface, border, text, and brand tokens. `wa-section-title`, `wa-context-pane`, `wa-dropdown`, `WhatsAppAvatar`, `AgentConversationCard`, `SalesCopilotPanel`, acquisition field class, existing inbox filters, transfer dialog, and composer send path.

## 4. Files created

- `docs/implementation/REAL_ESTATE_UI_PHASE_5_WHATSAPP_SALES_HUB.md`

## 5. Files modified

- `app/globals.css`
- `components/inbox/SalespersonHubHeader.tsx`
- `components/inbox/ChatThread.tsx`
- `components/inbox/TeamInbox.tsx`
- `components/inbox/RealEstateIntelligenceRail.tsx`
- `components/inbox/BuyerConversationActions.tsx`
- `components/inbox/AcquisitionConversationActions.tsx`
- `components/inbox/SalesCopilotWorkspace.tsx`
- `.hallmark/log.json`

## 6. Desktop Sales Hub shell

The existing `TeamInbox` layout is unchanged: conversation list, chat, intelligence rail, with the resize handles that were already there. The intelligence column target is about 330–380px when it is not user-resized. Chat keeps the flexible middle. No second application header was added.

## 7. Conversation list

Rows, unread counts, avatars, and previews were already in `ConversationRow`. They were left in place. Selection on small screens uses the sales hover surface and a neutral inset, not a lime stripe.

## 8. Conversation search and filters

Existing search, owner filter, type filter, and inbox filters were not replaced and no new filter was invented.

## 9. Chat header

The sticky header, back action, name, assignment, and more menu remain. Real-estate workspaces add a **Sales tools** control on viewports under 1100px. It opens the existing intelligence sheet. Desktop still uses the panel toggle. Solar, trades, and other salesperson inboxes keep the Copilot header button.

## 10. Message bubbles

Incoming and outgoing bubbles use sales surfaces. Outgoing bubbles are not a lime fill and not WhatsApp green. Mobile body size is 15px. Date separators and system/internal notes were already separate from customer bubbles and were not restyled into messages.

## 11. Media messages

Image, audio, video, and document rendering in `MessageBubble` was not rewritten. Private media URLs are still whatever the existing message payload provides.

## 12. Composer

The existing composer, attachment input, send button, and Enter-to-send behaviour are unchanged. Mobile composer background follows the sales surface instead of `#0B141A`.

## 13. Draft handling

`SALES_COPILOT_DRAFT_EVENT` and the stored Copilot draft still insert text. If the composer already has different text, a bar asks whether to replace it. Confirming focuses the composer and does not send.

## 14. Mobile full-screen conversation

The existing fixed full-screen thread (`data-mobile-pane="thread"`) remains. Its background is `var(--sales-bg)` instead of a hardcoded dark green-black.

## 15. Keyboard and safe-area handling

Existing visual-viewport composer behaviour and safe-area padding on the list header and intelligence header were left in place. The intelligence sheet is full height and includes a bottom safe-area inset so the customer-record link is not flush with the screen edge.

## 16. Connection states

`WhatsAppConnectionStatus` was not rewritten. Connection copy still comes from the existing session payload.

## 17. Account and session selector

No new account model. The existing hub connection status stays in the list header.

## 18. Assignment and transfer UI

Claim, transfer, and company owner controls in the chat header are unchanged. Staff are still chosen through the existing dialogs.

## 19. Conversation open and closed states

Resolve and reopen on the company menu are unchanged. The composer availability rules were not altered.

## 20. Real Estate intelligence rail

`RealEstateIntelligenceRail` now leads with the customer, then the recorded next action, then the relevant search or opportunity. Copilot sits after that context. A failed intelligence request shows a retry and does not render empty buyer facts. Linked property prices are the stored number, without a hardcoded dollar sign.

## 21. Mobile sales tools

The phone header says **Sales tools**. The sheet is full screen. Closing it uses the existing back and collapse actions, which return to the open conversation rather than the list.

## 22. Buyer context

When the recorded side is buy-side, the rail shows buyer search actions and recorded requirements. Several searches stay as separate rows. **Find matching properties** still goes to `/sales/matching`. **Open customer search** still goes to `/sales/buyers/{id}` after a successful create or link. Creating a search does not send WhatsApp.

## 23. Tenant context

When the recorded side is tenant-side, the same search form is locked to rental. Copy says rental search and monthly budget. It does not describe a purchase or a completed tenancy.

## 24. Seller and landlord context

Sell-side and landlord-side show the acquisition action, not buyer requirements. Landlord uses intent `rent`. Seller uses intent `sale`. The opportunity is created only after **Confirm opportunity**, through the existing acquisitions POST and idempotency key.

## 25. Unclassified enquiry

Four choices: buying, renting, selling, renting out. The choice only reveals the existing form. The customer side is not written by that tap.

## 26. Matching and recommendation UI

Top matches from the existing intelligence payload link to the listing page. The rail states that opening a property does not send a message. There is no new chat matching API and no combined “recommend and send” button.

## 27. Follow-up UI

The recorded next action label is shown when the intelligence payload includes one. No new follow-up endpoint was added inside the chat.

## 28. Copilot UI

`SalesCopilotPanel` stays the existing review list. It is no longer the first block in the real-estate rail. Suggested actions still require the existing approve, choose, or dismiss calls. Answer-style items are labelled **Use draft**.

## 29. Draft insertion

See section 13. Regeneration was not added.

## 30. Manager inbox differences

On a real-estate company inbox, sales conversations use the real-estate rail so managers see the same customer context. Assignment stays in the company chat header. Support conversations, and every non-real-estate company inbox, keep `CompanyConversationInsightRail`.

## 31. Three-dot menus

The existing conversation menu actions are unchanged. On viewports under 1100px the menu anchors to the bottom of the screen, names the customer, and has a dimmed backdrop. It is not a new action set.

## 32. Detail panels

Customer detail remains this rail plus **Open customer record**, which goes to the existing lead page. No second profile was created.

## 33. Loading, empty, and error states

Intelligence loading uses skeleton blocks. A failed load has retry copy and does not pretend the requirements are empty. Conversation list empty and error states were already present and were not replaced.

## 34. Accessibility

Sales tools, close, retry, classification choices, and draft actions have visible text. The classification rows use `aria-pressed`. The mobile menu backdrop has a close label. Message text remains selectable.

## 35. Performance considerations

No new polling loop. The conversation list still uses the existing inbox fetch. Intelligence still loads for the open conversation only. Copilot is not requested by rendering a new client.

## 36. Backend functionality preserved

Send, retry, transfer, claim, buyer-search create, enquiry link, acquisition create, and Copilot act/dismiss still call the same endpoints with the same bodies. Acquisition intent now follows the chosen side (`sale` or `rent`) instead of always sending `sale` from this panel.

## 37. Role and privacy preservation

No new fields are fetched. Matches and requirements are whatever `/api/agent/conversations/{id}` already returns. Buyer phone numbers are not added to match rows.

## 38. Other-industry compatibility

Solar opportunity panel, trades sales intelligence, support rail, and the non-real-estate company rail are still selected by the same conditions. Shared visual changes are the chat surfaces: wallpaper, bubble colour, and mobile palette. Those apply to every salesperson WhatsApp workspace so the hub does not keep a second green theme.

## 39. Lightweight checks executed

Source review of the edited components. A `git diff --check` was started and did not finish on this machine, so whitespace was not confirmed that way.

## 40. Checks not executed

No `npm run build`, `next build`, `next dev`, localhost, full typecheck, full lint, Docker, Supabase, browser session, GitHub push, or Vercel deploy.

## 41. Known limitations

- Message media, quick replies, QR pairing, and provider window errors were not redesigned.
- The matching link does not deep-link a search id. The matching page still asks the agent to choose the search.
- Follow-up creation from the rail was not added. Only the recorded next-action label is shown.
- Company real-estate sales chats no longer show the numbered company insight accordion. Assignment remains in the chat header.
- Desktop conversation rows were not rebuilt.
- Copilot cannot invent property facts, and this UI does not add a citation layer the API does not return.

## 42. Manual Vercel visual QA checklist

- Inbox list at 360px: title **Inbox**, no green wallpaper, no sideways scroll.
- Open a chat: header visible, composer above the keyboard, bottom nav not covering the field.
- Real-estate chat: **Sales tools** opens a full-screen sheet and returns to the same thread.
- Unclassified enquiry: four choices, no record until confirm.
- Buyer and tenant searches stay distinct. Seller and landlord do not show buyer requirements.
- Use draft with an existing unsent message asks before replacing. Send stays manual.
- Solar and trades inboxes still open their own side panels.
- Company inbox for a non-real-estate business still shows the company insight rail.

## 43. UI Phase 6 readiness

The hub, intelligence rail, and draft handoff are in the shared inbox components. A later phase can deepen document review inside a thread or a manager queue, using these surfaces rather than a second messaging app.
