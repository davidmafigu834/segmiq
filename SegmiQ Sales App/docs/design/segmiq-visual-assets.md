# SegmiQ visual asset manifest

Date: 2026-10-31. Generated with the configured built-in image_gen tool. Seven separate outputs were generated and visually inspected; no collage, downloaded stock imagery, generated logo or customer portrait was used.

## Provenance and storage

- Source-provided official artwork: `segmiq_official_logo_transparent.png` and `segmiq_official_q_transparent.png`, existing Android resources, preserved unchanged. Original brand ownership remains SegmiQ's.
- Generated PNG masters: `artifacts/design/masters/`. Originals also remain at the generation tool's source paths. These are fictional artistic depictions, not evidence of an advertised listing.
- Optimised Android resources: `app/src/main/res/drawable-nodpi/`. JPEG was selected because the installed environment has no WebP encoder; it is Android-compatible and avoids shipping the uncompressed photo masters in the APK. No added encoder dependency.
- Generated artwork follows the image-generation service's applicable terms; no third-party stock-photo licence or real-property authenticity is asserted. A release owner should approve these depictions for brand use.
- Do not attach any generated image to a real listing, buyer, agent or customer. Bundled images are decorative banners or isolated fictional preview artwork only.

| Android filename | Dimensions | Purpose / screens | Origin | Permitted use |
|---|---:|---|---|---|
| segmiq_sales_login_architecture.jpg | 1086 × 1448 | Login, MFA and connecting backdrop | Generated A | Production decoration + demo |
| estate_home_feature.jpg | 1672 × 941 | Agent Home decorative banner; fictional property cover | Generated B | Production decoration; fictional records only |
| estate_discovery_feature.jpg | 1672 × 941 | Gated Properties banner; fictional townhouse cover | Generated C | Production decoration; fictional records only |
| estate_buyer_matching_feature.jpg | 1672 × 941 | Gated Buyers banner; fictional candidate gallery introduction | Generated D | Decoration, never an actual person's avatar |
| estate_viewing_feature.jpg | 1672 × 941 | Gated viewing banner; fictional gallery interior | Generated E | Decoration / fictional preview |
| estate_transaction_feature.jpg | 1672 × 941 | Gated transaction banner; fictional transaction/gallery | Generated F | Decoration / fictional preview |
| estate_listing_placeholder.jpg | 1254 × 1254 | Neutral architectural fallback | Generated G | Placeholder in either mode, never a listing photograph |
| segmiq_official_logo_transparent.png | 2048 × 682 | Authentication, header, settings, recorder | Source-provided | Official brand usage |
| segmiq_official_q_transparent.png | 439 × 453 | Copilot, system splash | Source-provided | Official brand usage |

The seven compressed generated resources total **1,824,769 bytes (1.74 MiB)**. Dimensions and byte sizes were verified from the saved files with the installed image decoder. The source dimensions above are the image tool's actual output dimensions, not requested upsampled sizes. Android decodes bundled artwork off the main thread with sampling to a maximum 1440px edge, and uses an 8MiB resource-only bitmap cache. No remote private-image pipeline was enabled.

## Refinement pass

The subsequent premium refinement reuses these seven existing generated assets and unchanged official brand files. No duplicate photographs were generated, no downloaded stock image was introduced and no generated asset was assigned to a server listing. New API-screen identities use native Material icons and neutral initials; photo gaps remain explicit placeholders. The documented PNG masters and compressed Android JPEG resources remain the artwork deliverables.

## Generation prompts

All prompts require no typography, logo, watermark, UI or phone frame.

A: Single portrait architectural photograph for a native Android login background, 3:4 portrait. Photorealistic modern southern African family residence in Harare at dusk, stone and warm plaster materials, believable one-storey architecture, mature native landscaping, warm interior lights, deep forest shadows. Main house in upper half; generous dark negative space in lower half for Compose controls. Cinematic understated grading, realistic textures and construction. No people. Decorative fictional architecture, not a real advertised listing.

B: Landscape 16:9 cinematic editorial architectural photograph of a believable contemporary family home in Borrowdale, Harare, Zimbabwe. Warm textured plaster, shaded veranda, established trees, modest swimming pool, afternoon sun. Premium but realistic, calm inviting mood, space on left for dark text scrim. No people.

C: Landscape 16:9 professional architectural photograph of a contemporary brick and plaster townhouse development in Avondale Harare, planted courtyard, clean foreground, natural morning light, realistic southern African residential proportions. Fictional decorative asset. No people or signage.

D: Landscape 16:9 candid editorial photograph of a Black Zimbabwean female real estate agent and Black African adult female client reviewing a floorplan at a timber table in a believable modern Harare property office. Natural professional expressions, realistic skin and hands, no handshake, warm daylight, quiet focused atmosphere. These are generated fictional people, never customer identities.

E: Landscape 16:9 understated architectural interior photograph of a welcoming southern African residential entrance opening into a bright living room, textured stone, oak door, leafy garden beyond, natural morning light, believable construction. Fictional generic viewing decoration. No people.

F: Landscape 16:9 elegant close architectural photograph of a contemporary Zimbabwean residential veranda, stone and timber construction detail, warm late afternoon light, garden softly beyond. Understated professional transaction milestone background. Fictional decorative scene. No people.

G: Square minimal architectural placeholder illustration. Clearly non-photographic geometric fine-line elevation of a house, simple roof and doorway on warm ivory paper with muted forest green lines and one small pale lime square. Lots of whitespace. Refined architectural drawing, not a real listing photo.

## Empty-state artwork H

Native Compose Canvas motifs in `SegmiqEmptyIllustration` cover properties, buyers, inquiries, viewings, offers, transactions, recordings and Copilot. They are scalable geometric UI drawings, with theme-aware neutral lines and one restrained brand accent; no external licensing dependency. They are not active audio waveforms.
