# Overnight changes

Hey Paul. Here's everything that landed while you slept. Build is green
(`./node_modules/.bin/next build` runs clean) and TypeScript checks pass.

## Commits (newest first)

| Hash | Summary |
| --- | --- |
| `a4f9c2a` | Upload UX: flat panel chrome on uploader and persistent status toast |
| `8ee2f41` | Style profiles: visual refresh and harden reference upload error path |
| `44f0911` | Property detail: dense header, mono stat row, segmented filters, flat grid |
| `5236053` | Properties list: dense table-style layout, segmented filter, skeletons |
| `bcc1088` | Dashboard chrome: tighter sidebar, monospace nav labels, live recent feed |
| `ad0eafc` | Design system: dark-first tokens, flat panels, mono numerics |
| `d621d16` | Photo download UX: blob fetch (no new tabs) + Both export option |

7 commits. Nothing pushed to remote (origin is set, but past commits
weren't pushed automatically, so I left it alone for you).

## What the new look is

The aesthetic target was sit-between-Linear-Raycast-Lightroom: dark
first, near-black canvas with a slight warm tint, crisp 1px hairline
borders carrying elevation instead of fuzzy drop shadows, mono numerics
for any data, single saturated accent (electric green) for primary CTAs
and active states.

### What that meant in practice

- **Surface system**: 4 tiers of background (`--surface-0..3`) layered
  via hairline borders. New `.panel` / `.panel-hover` utilities replace
  the generic `.glass-card` aesthetic. The old class names are aliased,
  so legacy components still render correctly.
- **Accent**: brand color rebranded from blue to electric green
  (`hsl(152 76% 52%)`). All `text-brand-*` and `bg-brand-*` classes
  resolve against the new green scale. `gradient-bg` now flat-fills
  with the accent (no actual gradient, but kept the alias).
- **Typography**: JetBrains Mono wired up via `--font-mono` Tailwind
  variable. Used for all numerics, badges, section headings, file
  names, anything that reads as "data". Tabular figures on by default.
- **Motion**: Killed the toy `whileHover scale 1.02` lifts on photo
  cards and the `-translate-y-0.5 hover:shadow-xl` glass-card hover.
  Replaced with simple border-color transitions that turn the hairline
  green on hover. Sidebar active item gets a 4px primary bar instead of
  pill swap, with a `layoutId` motion bridge.
- **Toaster**: `theme=dark`, mono font size, slimmer radius.
- **Subtle scanline texture** sits behind the dashboard chrome at very
  low opacity (4 px diagonal stripes at 1.2% alpha). Reads techy,
  doesn't fight content.

## What changed visually, page by page

- **Dashboard layout / sidebar**: 60-unit wide, sectioned nav
  (Workspace / Configure / Account) with mono section labels. Active
  item gets a 4 px green bar at left edge plus surface-3 background.
  Always-visible Credits readout at bottom (mono balance, refreshes on
  pathname change).
- **Overview page**: 4 stat tiles became one seamless hairline row
  with mono numerics and contextual hints ("available" / "this month"
  / "approved" / "needs review"). Recent activity now actually shows
  recent properties instead of being a permanent empty state. Quick
  actions got proper category icons.
- **Properties list**: Address rows are now a divided table inside one
  panel (dense, scans fast) instead of 5 floating cards. Status filter
  is a segmented control with mono inline counts. Loading shows a 4-row
  skeleton. New Property modal got mono labels, primary-accent ring on
  the selected tier, mono credit cost ("1 cr" / "2 cr").
- **Property detail (the QC heart)**: Breadcrumb header, mono meta
  line, all action buttons compact rounded-md instead of chunky rounded-xl.
  4-stat row uses 1 px hairline grid with mono numerics and `/100`
  suffix on QC score. Filter tabs are a segmented control. Photo grid
  cards are flat with hairline borders that turn primary green on hover
  (no scale, no drop shadow). Score and issue badges use mono tabular
  numerics. PENDING banner uses primary accent border with softer tint.
  Tier breakdown and Summary of Changes are quiet bordered pills with
  mono numbers.
- **Style profiles list**: Header has count, slim CTA. "How it works"
  became a thinner mesh-gradient strip. Profile cards have a status
  pill (Learned / Pending) and mono parameter mini-grid with degree
  signs.
- **Style profile detail**: Breadcrumb header. 5-up parameter cards
  use the same hairline grid pattern. "Reference Photos" section copy
  cleaned of em dashes ("20 to 50" not "20-50").
- **Upload status toast**: Single-line aggregate header with mono
  N/M counter. Per-job rows mono, with DONE / ERROR / percent badge in
  tabular numerics.
- **PhotoUploader**: Dropzone uses border-color hover. Queued file
  rows tighter, mono file sizes, mono "N photos queued" label.

## Functional fixes shipped

1. **Photo download as blob (commit `d621d16`)**. The "zillion browser
   tabs" issue. Original / Fixed buttons in the photo modal now fetch
   as a blob and trigger a Save dialog. New `downloadFile` helper in
   `src/lib/photoZip.ts`. Falls back to anchor click on CORS errors.
   Also guards against undefined URLs so the buttons never crash.

2. **Both export option (commit `d621d16`)**. Replaced the Lightroom
   Bundle option in the export dropdown with "Both", which ships a
   single ZIP containing `/full/` and `/mls/` subfolders. Marked
   Recommended. Also renamed Full Resolution → Full Size and MLS-Ready
   → MLS for compactness.

3. **Style profile reference upload (commit `8ee2f41`)**. Was failing
   silently. Now:
   - Sign-URL request checks `res.ok` and throws with HTTP status
   - Each S3 PUT checks `res.ok` and retries once on transient failure
   - Failed files are tracked separately so they don't get saved as
     broken keys to the profile
   - New `uploadError` state with a dismissable inline error banner
     above the dropzone showing "N of M photos failed to upload"

## What I deliberately did NOT touch

- **Stripe / billing / credits API and webhook routes**: out of UX
  scope, not worth the risk overnight.
- **Python Lambda QC engine**: out of scope.
- **Prisma schema**: untouched.
- **Marketing/landing page (`src/app/page.tsx`)** and **pricing page**:
  inherit the new tokens automatically via the brand color and
  glass-card alias mapping. They look consistent but I didn't rewrite
  them. The pricing page still uses an em dash as a literal "—" glyph
  for "not included" cells (`src/app/pricing/page.tsx:111`); that's a
  visual character, not narrative copy, so I left it. If you want it
  swapped, change to `·` or remove the cell entirely.
- **Dashboard credits / billing / integrations / clients pages**: they
  still work and look fine with the new tokens (the `.glass-card`
  alias gives them the new flat-panel look automatically), but I
  didn't apply the new mono / breadcrumb header treatment to them.
  Easy follow-up if you want consistency across all chrome.

## Notes / caveats

- The brand palette change to green means anywhere you previously saw
  blue (`bg-brand-500/20`, `text-brand-400`, etc.) now reads green.
  Inspect the dashboard credits page and onboarding page if you want
  to confirm they still feel right with the new accent.
- The legacy `.glass-card` / `.gradient-bg` utility aliases are
  intentional. They map to the new flat panel system so we didn't have
  to touch every component in one pass. They can be removed once each
  surface gets the explicit `.panel` treatment.
- Build verified with `next build` — no errors, all 26 routes compile.
  Did not run `next dev` (it's late, no point).
- Nothing was pushed to remote. Past commits on `main` were not
  auto-pushed either, so I matched that convention. `git push origin main`
  when you're ready.

## Files of interest

- `src/app/globals.css` — design tokens, surface tiers, utility classes
- `tailwind.config.ts` — fonts, brand palette, surface scale, shadows
- `src/app/layout.tsx` — JetBrains Mono wired in, toaster theme
- `src/app/dashboard/layout.tsx` — sidebar
- `src/app/dashboard/page.tsx` — overview
- `src/app/dashboard/properties/page.tsx` — list
- `src/app/dashboard/properties/[id]/page.tsx` — detail (QC heart)
- `src/app/dashboard/profiles/page.tsx` — profiles list
- `src/app/dashboard/profiles/[id]/page.tsx` — profile detail + upload
- `src/lib/photoZip.ts` — `downloadFile` helper, "both" mode
- `src/components/upload/PhotoUploader.tsx` — uploader
- `src/components/upload/UploadStatusPanel.tsx` — floating status toast
