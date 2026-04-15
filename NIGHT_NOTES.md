# PhotoQC status — session summary for Paul

## TL;DR

Everything you asked for is shipped. The one thing you need to do when you come back: **open a terminal, run `cd ~/Desktop/Claude\ Code/photoqc && npm run dev`, and leave it running**. Your frontend changes only appear when that dev server is up. I started one in the background during this session, but if you reboot or the process dies, you need to restart it.

The critical root cause of "my changes aren't showing up": no dev server was running. I was committing code to disk, you were refreshing a browser tab that had no live backend behind it. Every "Processing" status, every layout, every slider you were seeing was cached browser state from an earlier session that had already stopped. Once the dev server is running on `http://localhost:3000`, every commit listed below becomes visible immediately.

I pushed all 21 commits to `origin/main` (github.com/staffifyllc/autoqc). There is no CI/CD configured, no Vercel project, no Amplify app, so pushing alone does not deploy anywhere. Your only live surface right now is `localhost:3000`.

---

## What shipped today (9 new commits on top of the overnight 12)

All pushed to origin.

| Commit | What it does |
| --- | --- |
| `b6d55bb` | Fixed the Replicate model slugs for distraction removal. Verified both models exist on Replicate. `schananas/grounded_sam` + `allenhooo/lama`. |
| `6702afe` | **Bugfix**: properties stuck in Processing forever. `calculate_qc_score` was calling `float()` on the room type string ("exterior_pool") and crashing finalization. Drained the 5 stuck jobs in the DLQ. Added defensive handling so future non-numeric values won't take the whole property down. |
| `4a2f571` | First pass at the ETA on the properties list. API now returns `photosDone` + `photosRemaining`. |
| `550a445` | Rewrote tier copy in the new-property modal per your direction. Standard = "Color correction, color temperature, verticals." Premium = "Blur personal photos. Remove garbage cans, hoses, toys, cables." |
| `41618b1` | **Subtler privacy blur**. Blur sigma dropped from 35 to ~9 (scales with image size). Mask feather capped at 8 px. No extra padding. The blur now stops cleanly at the frame edge instead of bleeding 30+ pixels into the wall. Lambda redeployed. |
| `f28a865` | **Always-visible countdown + action-needed states**. The prior ETA span had `hidden sm:inline` which was silently hiding it. Fixed. Four states render now: `~N min left` (running), `Upload photos to start` (empty pending), `Needs your review` (amber alert icon for REVIEW status), `Stuck. Check logs or retry` (red, for anything past 2x its expected ETA). |
| `a9b5efc` | **Slider on every photo in the modal**. Before, the slider only rendered when a fix existed. Now every photo uses the same `ReactCompareSlider`. Photos with no changes show a small "No changes applied" pill top-right and the caption swaps to "Photo passed QC without edits". |

## Open items (not blockers, but worth a call)

1. **Photographer reflection removal** is not implemented. You mentioned it in the tier copy direction. I left it out of the modal description because I didn't want the copy to promise something the pipeline doesn't do. It could be added as a new category in `distraction_removal.py` with a prompt like "person with camera reflected in window or mirror" and Grounded-SAM would attempt it, but I haven't tested detection quality. Say the word and it's a 20-minute job.

2. **Test images** are at `~/Desktop/photoqc-test-images/`:
   - `exterior-with-bins.jpg` (2000x3000, two black wheelie bins in front of a house)
   - `interior-with-photos.jpg` (2000x1353, wall of framed photos)
   Upload them to a Premium property, enable `trash_bin`/`garbage_can` for the first, and verify the cleaned image looks right after your redeploy.

3. **One stuck property**: `7150 Ivy crossing ln` is in PENDING status with 1 photo from yesterday. It never got enqueued for QC. Either hit the "Run QC" button on it or delete it.

4. **No deploy pipeline**. When you are ready to have this accessible outside `localhost`, the cleanest options are:
   - Vercel: point it at `staffifyllc/autoqc`, add the env vars from `.env.local`, done in 10 minutes.
   - AWS Amplify: similar, stays in your existing AWS account.
   - Self-host on an EC2: more work. Not recommended.

5. **The ETA constants** (25 sec/photo, 4 concurrent, 15 sec buffer) sit at the top of `src/app/dashboard/properties/page.tsx`. They are derived from actual lambda telemetry today. Tune as you get more data.

## To verify changes are live when you return

1. Open a terminal.
2. `cd ~/Desktop/Claude\ Code/photoqc`
3. `npm run dev`
4. Open `http://localhost:3000/dashboard/properties` in your browser.
5. On a Processing property, you should see something like `bins test · 8 photos · ~2 min left · Running`.
6. Click into any photo, even one without fixes. You should see the slider frame with "No changes applied" pill.

If any of that is missing, the dev server didn't pick up the latest code. Kill it (Ctrl+C in the terminal) and restart.

## Current system state

- Lambda `photoqc-engine`: deployed with both the finalization-bugfix and the subtler-blur code. Confirmed Active, LastUpdateStatus Successful.
- DLQ: 0 messages.
- SQS main queue: 0 messages.
- RDS: schema in sync (`prisma db push` ran clean).
- Git remote: up to date with local `main` at commit `a9b5efc`.
