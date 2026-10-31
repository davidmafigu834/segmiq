# SegmiQ Sales — Android branding assets

## Source of truth
`reference-only/segmiq_official_logo_original.png` is the user-provided official brand logo. Do not replace or redraw its wordmark or network Q.

## Ready-to-place files
Copy the contents of `app/src/main/res/` into the Android project at the matching paths:
- `drawable-nodpi/segmiq_official_logo_transparent.png`: source-derived transparent SegmiQ wordmark for onboarding and login, best displayed on dark backgrounds (white lettering).
- `drawable-nodpi/segmiq_official_q_transparent.png`: source-derived Q mark for splash/branding.
- `mipmap-*/ic_launcher.png` and `ic_launcher_round.png`: raster launcher icons at 48/72/96/144/192 px. Icons use the official Q isolated from the source logo, not a generated substitute.
- `play-store/segmiq_sales_play_store_512.png`: 512x512 opaque PNG for Google Play store listing.

## Cautions
- Original logo has a baked-in black background and a luminous halo. Transparency was computed from brightness; check edges and halo on both light and dark surfaces. Use the original file on black if exact source rendering is required.
- The launcher art has a dark square with rounded-looking framing; modern Android adaptive icons ideally use separate foreground/background layers and a monochrome layer for themed icons. These files are reliable raster fallbacks, NOT adaptive-icon XML resources. Android Studio Image Asset can import the 1024 source image and generate adaptive layers if desired, keeping the Q in safe zone.
- Images in `reference-only/alternate_*_NOT_OFFICIAL.png` are optional previously generated concepts; do not use them as the official logo or default launcher.
- Verify any existing `mipmap-anydpi-v26/ic_launcher.xml` references. If they remain, adaptive icon XML can override raster mipmaps on Android 8+. Generate matching adaptive resources in Image Asset Studio or adjust references before shipping.

## Suggested label
`SegmiQ Sales`
