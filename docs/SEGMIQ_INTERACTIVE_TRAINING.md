# SegmiQ Interactive Training (Guided Learning)

Premium in-app interactive course for salespeople. **Not** a static slideshow or Next-click tour — learning happens by using SegmiQ.

## Philosophy

**CONCEPT → SEE → DO → CONFIRM → UNDERSTAND WHY → NEXT**

Action steps require a real product action (or safe Practice Mode action). There is no “Next” that substitutes for “Open My Pipeline”.

Core sales philosophy taught:

1. A Lead enters (enquiry).
2. You qualify it.
3. A real opportunity becomes a Deal.
4. Every active Deal should have a next action.
5. SegmiQ helps decide what deserves attention first.
6. If there aren’t enough Deals, SegmiQ helps build Pipeline.
7. Daily actions connect back to Goals (without guaranteeing revenue).

## Architecture

| Piece | Location |
|-------|----------|
| Types / version | `lib/sales/training/types.ts` |
| Course content | `lib/sales/training/courses/segmiq-2.ts` |
| Pure engine | `lib/sales/training/engine.ts` |
| Event bus | `lib/sales/training/course-events.ts` |
| Target IDs | `lib/sales/training/course-targets.ts` |
| Progress API | `app/api/sales/guided-learning/route.ts` |
| DB | `supabase/migrations/089_sales_guided_learning.sql` |
| Provider / UI | `components/sales/training/*` |
| Practice | `components/sales/training/practice/*` (ephemeral) |
| Entry | `/sales/training` · Dashboard resume card · Welcome modal |

Mount: `GuidedCourseMount` inside `SalesAppShell` and `SalesDashboard`.

## Course versioning

- `courseId = segmiq-2`
- `courseVersion = 2.0`
- Future `2.1` / `3.0` store separate progress rows (unique on user + client + course + version).
- Text-only edits do not force retakes; new versions are opt-in.

## Progress storage

Table: `sales_guided_learning_progress`

Statuses (internal): `NOT_STARTED` | `IN_PROGRESS` | `COMPLETED` | `DISMISSED`

Also mirrored to `localStorage` (`segmiq-guided-learning-v2`) so refresh resumes mid-step even if migration is not applied yet (API returns 503 → client keeps local).

Fields: current lesson/step, completed/skipped lesson ids, lesson_progress JSON, welcome flags, dashboard card hidden, timestamps.

## Step types

`INTRO` · `SPOTLIGHT` · `ACTION` · `NAVIGATION` · `PRACTICE` · `EXPLANATION` · `COMPLETE`

Action / navigation steps set `requiredAction.event`. Manual Continue is only allowed when `allowManualNext` is true **and** no required action.

## Product events

Emit via `emitCourseEvent(name)`:

Examples: `NAVIGATED_TO_PIPELINE`, `OPENED_PRACTICE_LEAD`, `PRACTICE_DEAL_CREATED`, `PRACTICE_DEAL_STAGE_CHANGED`, `PRACTICE_FOLLOWUP_COMPLETED`, `PRACTICE_QUOTE_CREATED`, `PRACTICE_WHATSAPP_REPLY_SELECTED`, `MOBILE_MORE_OPENED`.

Route changes also map through `courseEventForPathname`.

## Spotlight targets

Convention: `data-course-target="<id>"`

Examples: `sales-nav-pipeline`, `sales-mobile-nav-more`, `dashboard-kpi-pipeline`, `practice-create-deal`.

Never use brittle CSS nth-child selectors.

If a target is missing: retry, warn in development, show failure copy, allow Pause — never leave a permanent hard lock.

## Overlay / z-index

CSS vars: `--sales-z-course-overlay` (90), coach (92), modal (95). Below toast (100).

Four-pane dim overlay so the highlighted target stays clickable. Ring: 2px `#D4FF4F` + soft outer shadow.

## Practice Mode

**Preferred:** ephemeral client state (`createPracticeSeed`) — never inserts CRM rows.

Practice UI shows a **Practice** badge and copy: actions don’t affect real sales data.

Interacts with the same Button / surface language as production.

Must not affect: Dashboard metrics, Lead/Deal counts, Pipeline Value, Goals, Reports, WhatsApp API, quotation sequences/PDFs.

## Curriculum (SegmiQ 2.0)

1. Getting Started  
2. From Lead to Deal  
3. Working Your Pipeline  
4. Following Up & Using Tasks  
5. Quotations  
6. WhatsApp Sales Hub  
7. Goals & Your Daily Sales Plan  

Capability gates: `requiresCapability: whatsapp | goals | quotes` skips unavailable steps.

## Pause / resume / exit

- Pause removes spotlight; HUD Continue restores exact step.
- Exit saves progress.
- Escape pauses.
- Overlay click does not advance (optional nudge).
- Dashboard card when incomplete; hideable; removed when course completed.
- Always available under **Training** (`/sales/training`).

## Welcome

First eligible load: Welcome / Meet SegmiQ 2.0 modal.  
“I’ll do this later” → dismissed for session + stored.  
“Don’t show automatically again” → `autoShowWelcome = false`.

## Mobile

Bottom coach sheet; primary nav + More sheet targets (`sales-mobile-*`).  
More open emits `MOBILE_MORE_OPENED`.

## Accessibility

Dialog roles on welcome/completion; coachmark `aria-label`; Escape pauses; focus target when possible; do not trap focus away from required targets.

## Development

`?courseDebug=<lessonId>` in development only (e.g. `lead-to-deal`).

## Testing

`tests/guided-learning-engine.test.ts` — start, action gating, navigation completion, refresh normalize, pause/dismiss, replay, practice seed isolation, route events.

## Manager readiness

Progress is per `user_id` + `client_id` so managers can later query completion without a separate LMS. Manager UI is intentionally deferred.

## Intentional deferrals

- Full drag-and-drop Pipeline practice (button stage move used)
- Live portal targeting inside every Radix modal
- Product analytics wiring (`course_started` etc.) beyond console debug
- Manager completion dashboard
- Knowledge-check quizzes
- Automatic open of More sheet mid-step (user taps More when More targets are required)
