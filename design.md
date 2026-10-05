# Design — SegmiQ operations

Locked system for the trades delivery experience. App pages share this voice.
Do not invent a second palette. Marketing pages keep the existing SegmiQ site.

## Genre
modern-minimal

## Macrostructure family
- App pages: Workbench. One primary fact, then the next action, then the record.
- Portal pages: same type and accent, larger type, no internal controls.
- Marketing pages: unchanged.

## Theme
Existing tokens. Do not inline new hex values in components.

- `--color-ink` maps to `var(--sales-text-primary)` / near black `#0C0C0C` on light surfaces
- `--color-paper` maps to `var(--sales-surface)`
- `--color-rule` maps to `var(--sales-border)`
- `--color-accent` maps to `var(--segmiq-lime, #D4FF4F)`
- Accent ink is near black on lime

Lime is for the primary create action and the current milestone mark. It is not a surface colour.

## Typography
- Display: Geist, weight 600, roman
- Body: Inter, weight 400
- No italic headings

## Spacing
Use the existing Tailwind sales scale. Page titles stay at or above 1.5rem.

## Motion
- Hover and focus change colour only
- `prefers-reduced-motion`: no positional animation

## CTA voice
- Primary: lime fill, near-black label, 44px target
- Secondary: border, near-black label
- Destructive confirmations name the record and the amount

## What pages MUST share
- Customer name before project title
- Stage in words, not a raw status code
- One next step
- Attention only when a real exception exists
