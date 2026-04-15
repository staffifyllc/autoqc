# Distraction Removal: build notes

Premium credit feature. Uses AI to detect and remove transient
distractions (trash bins, garden hoses, kids toys, cables, porta
potties, etc.) from listing photos. Ships behind the existing Premium
tier so no billing work was needed.

## Commits shipped on main

1. `650b152` Distraction removal: Premium check + LaMa inpaint fix
2. `75055ad` Prisma: distractionCategories on Property and Agency
3. `66776c5` Properties API: accept distractionCategories on create and PATCH
4. `13acd80` Property detail: distractions removed card, badges, toggle panel
5. `dc2f87a` Pricing: mention AI distraction removal in Premium tier

Not pushed to remote. You push manually.

## Files changed

Python (lambda):
- `lambda/qc_engine/checks/distraction_removal.py` (new)
- `lambda/qc_engine/fixes/remove_distractions.py` (new)
- `lambda/qc_engine/handler.py` (wiring)

Schema:
- `prisma/schema.prisma` — `Property.distractionCategories`,
  `Agency.distractionCategoriesDefault`. `npx prisma generate` already
  ran. Migration is your call.

API:
- `src/lib/distractionCategories.ts` (new, shared catalog)
- `src/app/api/properties/route.ts` — POST accepts the list on create
- `src/app/api/properties/[id]/route.ts` — new PATCH for tier and
  distraction categories

UI:
- `src/components/dashboard/DistractionCategoriesPanel.tsx` (new)
- `src/app/dashboard/properties/[id]/page.tsx` — summary card, photo
  badge, toggle panel, Standard-tier upsell
- `src/app/pricing/page.tsx` — new bullet on Premium

## Replicate models — VERIFY BEFORE DEPLOY

I could not hit the Replicate catalog from this sandbox. Slugs committed
are best-guess placeholders based on `megvii-research/nafnet` style from
`ai_deblur.py`. Both fail gracefully (return empty regions / keep the
original image), so the pipeline is safe to deploy with bad slugs: you
just get no distraction removal until they are fixed.

Detector (`checks/distraction_removal.py`):
- `schananas/grounded_sam:ee871c19...0ed`
- Need: confirm the model exists, confirm the input keys
  (`image`, `mask_prompt`, `negative_mask_prompt`, `adjustment_factor`),
  confirm the output shape (we handle dict-with-masks, bare-list, and
  single-URL output).

Inpaint (`fixes/remove_distractions.py`):
- `cjwbw/lama:e09b0c0b...c9d0`
- Need: confirm the model exists, confirm the input keys
  (`image`, `mask`).

If either slug is wrong, run a quick smoke call with the real slug from
Replicate's UI and patch the constant at the top of each module.
Alternative LaMa hosts if `cjwbw` is stale: `allenhooo/lama`,
`sanster/lama-cleaner`, `zsxkib/lama`.

## Cost per image

Assuming T4 pricing at $0.000225 / GPU-second on Replicate:
- Grounded-SAM: ~6 s → $0.00135 per detection call
- LaMa: ~2 s → $0.00045 per inpaint call
- Total per Premium photo where distractions are found: ~$0.0018
- Photos with no detections only pay the detection cost: ~$0.00135

Even at 30 photos per property, that is under 6 cents per Premium
property to host the feature. Well inside the extra credit margin.

See `estimate_removal_cost()` in `fixes/remove_distractions.py`.

## Data model

`Photo.issues.distractions_removed` (JSON, stored per photo):
```
{
  severity: 0.1,
  category: "distraction_removal",
  detail: "3 distraction(s) detected",
  region_count: 3,
  per_type: { trash_bin: 2, garden_hose: 1 },
  regions: [ { type, description, bbox, confidence } ]
}
```

Heavy base64 mask payloads are dropped before writing to JSONB so the
`Photo.issues` row stays small. Masks are only used in-process during
the fix call.

## Testing checklist

1. Schema migration in dev: `npx prisma migrate dev`. Two new columns
   default to `[]` so existing rows are fine.
2. Create a Premium property with
   `distractionCategories: ["trash_bin", "garden_hose"]`. Confirm
   `Property.distractionCategories` persists.
3. Upload a test photo with a visible trash bin. Run QC. Confirm:
   - `Photo.issues.distractions_removed.region_count > 0`
   - `s3KeyFixed` is set
   - before/after slider shows the clean version
   - thumbnail badge shows "N cleaned"
4. Standard-tier property: confirm the check never runs, regardless of
   whether `distractionCategories` is set.
5. Empty categories list on a Premium property: confirm the detector
   short-circuits without calling Replicate.
6. Replicate token missing in env: confirm the pipeline keeps running,
   detection returns an empty list, other fixes still apply.
7. Risky categories (`parked_car`, `satellite_dish`, `power_line`)
   should only be acted on when agent ticked them explicitly in the
   "Use with care" group.
8. Frontend:
   - Open `/dashboard/properties/[id]`, confirm the toggle panel shows
     under "Distraction Removal", Save button only enabled when dirty
   - Confirm PATCH `/api/properties/[id]` updates the list

## Deferred / flagged

- Agency settings page for `distractionCategoriesDefault`: no existing
  agency settings page to hang this off. The API already reads the
  default on property create, and the property-level panel can store
  the preference. When you add a settings page, drop
  `<DistractionCategoriesPanel ... />` on it and PATCH a new agency
  endpoint.
- Before/after slider reuse: the existing `ReactCompareSlider` already
  drives before/after at photo level. Distraction-cleaned photos use
  the same `s3KeyFixed` pipeline, so the slider works for them with
  no extra wiring.
- Replicate slugs (see above). Verify on first deploy.
- `fixes/remove_distractions.py` LaMa slug is a placeholder. If it
  errors on first run the pipeline silently falls back to the
  pre-clean image. No user-visible crash but no cleaning either.

## Runs in prod

`tsc --noEmit`: clean
`next build`: clean (53.8 kB for the property detail page, up from
whatever it was; still under 210 kB first-load JS on that route).
Python lambda not built in this sandbox — rerun your normal lambda
packaging (`lambda/qc_engine/build/`) to include the new modules and
OpenCV/Replicate deps (already in `requirements.txt`).
