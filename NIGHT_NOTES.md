# PhotoQC status — session summary for Paul

## TL;DR

**It is LIVE.** Production URL: **https://www.autoqc.io**

Turns out the Vercel project was already set up (1 day ago) with every env var already configured. It just was not linked to this repo. I linked the directory, added the missing `AWS_S3_BUCKET` var, and ran `vercel --prod`. Deploy took 47 seconds, status READY, HTTP 200 on homepage.

Everything you asked for is shipped and live. Every commit below is visible at autoqc.io right now.

Auto-deploy going forward: any future `git push origin main` will trigger a Vercel deploy automatically since the project is linked. No manual `vercel --prod` needed unless you want to skip the Git push.

---

## What shipped today (10 new commits on top of the overnight 12)

All pushed to origin and deployed to autoqc.io.

| Commit | What it does |
| --- | --- |
| `b6d55bb` | Fixed the Replicate model slugs for distraction removal. Verified both models exist on Replicate. `schananas/grounded_sam` + `allenhooo/lama`. |
| `6702afe` | **Bugfix**: properties stuck in Processing forever. `calculate_qc_score` was calling `float()` on the room type string ("exterior_pool") and crashing finalization. Drained the 5 stuck jobs in the DLQ. Added defensive handling so future non-numeric values will not take the whole property down. |
| `4a2f571` | First pass at the ETA on the properties list. API now returns `photosDone` + `photosRemaining`. |
| `550a445` | Rewrote tier copy in the new-property modal per your direction. Standard = "Color correction, color temperature, verticals." Premium = "Blur personal photos. Remove garbage cans, hoses, toys, cables." |
| `41618b1` | **Subtler privacy blur**. Blur sigma dropped from 35 to ~9 (scales with image size). Mask feather capped at 8 px. No extra padding. Lambda redeployed. |
| `f28a865` | **Always-visible countdown + action-needed states**. Four states render: `~N min left`, `Upload photos to start`, `Needs your review` (amber alert), `Stuck. Check logs or retry` (red). |
| `a9b5efc` | **Slider on every photo in the modal**. Photos with no changes show a small "No changes applied" pill and the caption swaps to "Photo passed QC without edits". |
| `739790d` | **Photographer reflection removal, accuracy first**. New Premium category. Three hard safeguards: negative prompt drops the "person" exclusion only when enabled, per-category confidence floor of 0.55 (vs baseline 0.35), per-category area cap of 8 percent of the image. Dropped detections are logged for retuning. Modal tier copy now reads honestly: "Blur personal photos. Remove garbage cans, hoses, toys, cables, photographer reflections." |
| `5247788` | Session summary note (this file). |
| `ba86591` | Gitignore `.vercel` (CLI link artifact). |

## Open items (not blockers)

1. **Test images** are at `~/Desktop/photoqc-test-images/`:
   - `exterior-with-bins.jpg` (2000x3000, two black wheelie bins in front of a house)
   - `interior-with-photos.jpg` (2000x1353, wall of framed photos)
   Upload them to a Premium property, enable `trash_bin`/`garbage_can` for the first, and verify the cleaned image looks right.

2. **One stuck property**: `7150 Ivy crossing ln` is in PENDING with 1 photo from yesterday. Never got enqueued for QC. Hit the "Run QC" button on it or delete it.

3. **ETA constants** (25 sec/photo, 4 concurrent, 15 sec buffer) sit at the top of `src/app/dashboard/properties/page.tsx`. Derived from actual lambda telemetry today. Tune as you get more data.

4. **Photographer reflection thresholds** are initial guesses. If real-world testing shows too many false negatives, drop the confidence floor from 0.55 toward 0.45 in `lambda/qc_engine/checks/distraction_removal.py` `CATEGORY_CONFIDENCE_FLOOR`. If too many false positives, raise it to 0.6+. Dropped detections are logged to CloudWatch so you can see what the detector found and what got filtered.

## To verify changes are live

Go to **https://www.autoqc.io**. The prod site is the Vercel deployment, backed by your existing RDS, S3, SQS, and Lambda.

- On a Processing property: status pill now shows `~N min left` next to it, updating every 5 seconds.
- Click any photo (fixed or unfixed): slider always renders. Photos with no changes get a "No changes applied" pill.
- New-property modal shows the new Standard/Premium copy.
- Premium property with `photographer_reflection` in its category list will attempt detection with the tight 0.55 floor. Log into CloudWatch `photoqc-engine` to see "INFO drop photographer_reflection below confidence floor" lines if the detector is being kept honest.

## Current system state

- Production: **https://www.autoqc.io** (Vercel, staffifyllcs-projects/autoqc, last deploy `dpl_DoRjHrN1fE844nG3xNSL2Y27pPSh`, READY)
- Lambda `photoqc-engine`: deployed with finalization-fix, subtler-blur, and photographer_reflection code. Active, LastUpdateStatus Successful.
- DLQ: 0 messages.
- SQS main queue: 0 messages.
- RDS: schema in sync.
- Git remote: `origin/main` at `ba86591`. Future pushes auto-deploy to Vercel.
