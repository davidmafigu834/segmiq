# SegmiQ Android premium UI system

Date: 2026-10-31. Implemented in the existing Kotlin/Compose application. This document describes code, not a replacement backend architecture.

## Palette and surfaces

Brand Ink #0C0C0C; lime #D4FF4F; warm ivory #F7F4EF; white #FFFFFF; forest deep #0B1D16; forest surface #14271E; forest highlight #254A31. Lime marks primary action/selection/progress. Avatars and ordinary cards use neutral surfaces. Error colours have explicit paired on-colours. Every Material 3 surface-container/inverse/scrim role is explicit; no wallpaper-generated palette or default lavender.

Light workspaces use ivory behind white cards. Dark workspaces use ink behind forest and neutral charcoal layers. Containers follow the active MaterialTheme colour scheme, including injected preview/test themes.

## Typography and layout

Android's licensed system sans-serif. No downloaded or unlicensed font. Display 30/36sp; page 27/33; headline 24/30 and 21/27; section 20/27; card 16/23; body 16/24 and 14/21; metadata 12/17. Headings use semibold/bold, body regular, small labels medium. Primary numeric heading uses tabular figures.

Respect font scaling. Inputs and buttons grow vertically; chips/attribute groups wrap. Operational copy stays compact. Page padding generally 20dp; spacing 8/12/16/20dp; cards 20–24dp corners, controls 12–16dp, badges 8dp. No full-screen hero before daily work.

## Icon conventions

Material Rounded and AutoMirrored family already in the app; 20–24dp visible icons, 48dp or larger interactive targets. Neutral initials for absent authorised avatars. Official Q bitmap for Copilot identity; official logo unchanged. No emoji or generated wordmark.

## Photography

`SegmiqArtwork`: asynchronous bounded resource decode; resource-only 8MiB cache, 260ms fade; geometric fallback and truthful failure label. `SegmiqImageFeatureCard`: rounded crop, dark directional scrim, readable heading/description and optional action content. It grows with text rather than clipping to a fixed text box.

Generated images stay decorative or inside the isolated fictional workflow. Individual preview property photography is marked FICTIONAL · GENERATED IMAGE. Actual private listing image endpoints remain gated, as documented in the mobile backend gaps. No token-bearing image requests, signed-URL cache or stock-photo substitution was added.

## Gradients

Forest Hero: #09150F → #183825. Property scrim: dark at the top for labels, softer centre, near-black lower region. Copilot uses the forest hero and exact official Q. Neutral content cards do not receive decorative gradients.

## Motion

`SegmiqMotion`: 220ms page fade/short directional slide; backward navigation reverses direction. Key press 100ms scale to .96; artwork fade 260ms; work-card expansion 240ms; calendar selection 180ms. Finite Compose animation primitives inherit Android animator-duration scaling. No perpetual glow, particle loop or fake microphone waveform.

Keypad haptics use Android View feedback and respect system feedback settings. A finite success reveal depends on the repository-confirmed task message; completion is never celebrated before persistence. Dialer call actions remain pinned while the keypad scrolls at enlarged text. Copilot explanation expansion changes presentation only; server action policy remains authoritative. Back-stack and bootstrap capability mapping remain unchanged.

## Components

Reused/refined SegmiqCard, PrimaryButton, Avatar, Label, SearchField, FilterChips, EmptyState, Skeleton and ErrorCard.

Added SegmiqArtwork, BrandLogo, ImageFeatureCard, GradientHero, CopilotHeader, EmptyIllustration, WeekStrip, BottomNavigation, DarkWorkspace and finite motion helpers. Bottom navigation uses one inset owner and aligned label boxes. Its height is 80dp normally, 112dp at font scale ≥1.25, and 160dp at ≥1.75, permitting up to three lines so 200% text remains complete. The enlarged bar trades content space for legibility; scrollable content remains reachable.

Refined EstatePropertyMiniCard, EstateWorkCard photo rows, EstateBuyerRow, generated demo photo/gallery, wrapping attributes, customer context, milestones, documents, notes and shared work-item screens. Secondary preview directories hide bottom navigation, preserving the five primary destinations. Dark system-bar leases preserve legibility across overlapping navigation transitions. The existing fictional workflow ViewModel and all production repositories remain separate.

## API-backed screen refinement

EstateServerVisuals centralises record identity rows, status-label formatting and icon-led detail facts. Buyer cards use neutral initials; offer and transaction values receive stronger type hierarchy; missing-photo records retain neutral architecture rather than invented listing photography. Directory loading reuses SegmiqSkeleton. Status formatting changes presentation only and never changes backend workflow values.

Login reduces its heading and hides decorative introduction content while IME is visible. The conversation Scaffold owns IME clearance so its pinned draft action and message viewport resize together. QA uses the production edge-to-edge/adjustResize window configuration and verifies footer geometry against the keyboard boundary, rather than accepting semantic visibility alone.

## Honesty and accessibility

Unavailable modules retain their gate messages and web links. Recording has no operational capture controls, timer, waveform or fabricated saved file. Simulated call duration is explicitly local-demo elapsed time. Only ACTION_DIAL opens the real phone app; failures are inline.

Images behind text have scrims; metadata is at least 12sp. Search has labelled clear controls; decorative imagery has no noisy TalkBack labels, record artwork identifies its fictional origin. Calendar dates include full spoken date, scheduled-event indicator and selected state. Reduced motion must not affect essential content.
