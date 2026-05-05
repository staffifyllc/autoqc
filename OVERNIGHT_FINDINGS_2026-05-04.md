# Overnight findings (2026-05-04 → 05)

**Brief:** "I want folks to have a better overall photo editing experience. Don't ask me anything, do work and research."

This document captures the audit, what I shipped without your sign-off, and the prioritized punch list. Read order: shipped → primary data → recommendations → research.

---

## What I shipped tonight

| Commit | Subject | Risk |
|---|---|---|
| `2c55458` | UX: mobile dashboard shell + format-rejection feedback | Low. Pure client UX, no schema/API/Lambda touches |

Specifically:

1. **Mobile dashboard layout shell fix.** `src/app/dashboard/layout.tsx`. Every dashboard page was unusable on phone (240px fixed sidebar + 32px padding left ~86px of usable width on a 390px iPhone). Sidebar now slides in behind a hamburger drawer below `md`; new mobile top bar carries brand + credits + hamburger; main uses `md:ml-60`, `pt-14`, responsive padding. Desktop layout unchanged. Z-stack ordered so the close button stays tappable when drawer is open.

2. **PhotoUploader format-rejection feedback.** `src/components/upload/PhotoUploader.tsx`. HEIC, RAW, and over-cap files used to vanish silently. Now an amber warning panel lists each rejected filename with a specific reason (HEIC → "export as JPEG or set iPhone camera to Most Compatible", RAW → "export as JPEG or TIFF first", over-cap → "lower JPEG quality"). Dropzone caption updated.

Both type-check clean, both deployed via `git push origin main`. Both reversible via `git revert 2c55458`.

---

## Primary customer-signal data

Pulled from prod RDS. **The editing quality is not the bottleneck. Onboarding is.**

### Funnel (last lifetime)

- 15 non-admin agencies signed up
- **6 created at least one property (40%)**
- **0 logged a `PURCHASE` credit transaction**

The 0% paid number may be misleading — agencies on PAY_AS_YOU_GO charge per-property via Stripe directly without a `PURCHASE` row. Worth a separate query that also counts `hasPaymentMethod=true`. Either way, **60% of signups never even create a single property.** That's the highest-leverage gap.

### Bug reports (last 30d)

| Reporter | Status | Title | Notes |
|---|---|---|---|
| Jordan / Realtour Pilot | **NEW** | Photos looking a bit worse | Fix shipped today (`f4ffd50`). Status still NEW in admin. Customer was emailed directly. **Action: flip to FIXED in admin when you next log in.** Auto-notification will go out, which is fine since the customer email already covered it. |
| Kyle / Realtour Pilot | FIXED | QA issues | Geometry caps fix (`f4ffd50`) |
| Evan / Flylisted | FIXED | Submitting an order | AWS SDK ESM crash (`4e6e0fa`) |
| Realtour Pilot | FIXED | Add Team Members | Feature request |

### Photo state (last 60 days, 1578 photos)

- 800 PASSED · 270 APPROVED · 79 FIXED · 398 FLAGGED · **31 PENDING (stuck)**

### The 31 stuck PENDING photos

Three properties:

- **27 photos** — Bolor Photo (Chris), 6 days old, property `cmoix4rjt0007l5041aikbj31` ("test5"). **Real customer failure.** No bug report filed.
- **3 photos** — your admin agency, 20 days old. Test artifacts, ignore.
- **1 photo** — Travis Stancil's agency, 20 days old. Trial bounce.

**Likely root cause:** the auto-`run_qc` trigger in `UploadContext.tsx:200` silently swallows the 402 (payment required) response with `alert()`. The job marks `done`, the user sees "Uploads complete," and the photos sit PENDING forever with no recovery email. **High-leverage fix:** when run_qc returns 402, store the failure on the upload job, surface a persistent banner on the property page, and email the agency owner. Tonight's audit script that found this is `scripts/_audit-stuck-pending.ts` (one-shot, will be deleted).

---

## Top opportunities (ranked, evidence-backed)

### Tier 1 (highest leverage, ship this week)

1. **Onboarding-to-first-property funnel fix.** 60% drop-off. Lead candidate causes: customer can't figure out how to create a property, can't figure out how to upload, or upload-then-payment-required loop kills momentum. Worth instrumenting the first-property flow with PostHog/equivalent and watching where the drop happens. Soft-fix candidates: empty-state on `/dashboard` with a literal "upload your first property" CTA, demo-shoot pre-loaded into the new agency.
2. **Recover stuck-PENDING photos automatically.** Customer-impact: at least 1 customer (Chris) has 27 photos stuck for 6 days. Fix: surface 402-on-auto-QC visibly, email the agency owner with a one-click resume link, and add a daily cron that emails agencies with photos stuck > 24h. Estimated ~3 hours.
3. **Cross-shoot consistency report.** Per pain-point research, this is the #1 trust-killer customers cite about AI editing. AutoQC already has `consistency.py` per-photo. Aggregate it into a property-level "consistency score" badge on the review page so the customer SEES we're guarding the seam. Estimated ~4 hours.

### Tier 2 (real differentiator, weeks not days)

4. **AI-assisted bracket culling.** Tier 3 in the pain-point research, "is there an AI culler for real estate yet?" comes up regularly. Sharpness check already exists per-photo. Group photos by exposure-bracket signature (filename pattern + timestamp + scene match) and auto-pick the sharpest of each set. Big workflow win for photographers shooting flambient or HDR.
5. **MLS-spec compliance auto-export.** Photographers maintain spreadsheets of 50+ MLS specs (resolution caps, naming, watermark rules). Differentiator. The room-type sort already gets us halfway. Per-MLS profile = per-MLS bundle on download.
6. **Hallucination detection.** Composition.py prompt could emit a per-photo "did the auto-fix add or remove any real fixtures" check. Turns MLS-disclosure risk into a "Verified no synthetic additions" badge.

### Tier 3 (nice-to-haves, opportunistic)

7. Visual revision tool for client feedback (sticky workflow lock-in).
8. Tethered / hot-folder ingestion from Capture One or Lightroom.
9. Voice or chat-driven edit instructions on selected frames.

---

## Open questions for you

- **HEIC support.** Tonight's fix tells customers to export as JPEG. Do you want me to actually add HEIC support next? Two paths: client-side conversion (`heic2any`, ~200KB bundle) or Lambda-side conversion (more engineering, no bundle cost). Roughly half-day either way.
- **Conversion-funnel instrumentation.** Are you running PostHog / similar already? I didn't find an instrumentation layer in the codebase — if you want a real funnel report, we need to add events on `signup → first property → first upload → first run_qc → first download`.
- **The 0% paid number.** I assume this is a `creditTransactions { type: PURCHASE }` query miss, since you mentioned paying customers exist. Worth pointing me at the actual definition of "paying" and I'll fix the metric.
- **Chris's 27 stuck photos.** Want me to manually re-enqueue them tomorrow once you confirm credits, or leave it alone?

---

## Research summaries

### Competitor landscape (synthesis, not live web — directional)

AutoQC's moat is **pre-delivery QC** — almost no major competitor owns this lane. Imagen and Aftershoot dominate photographer-facing AI editing but are RE-agnostic. BoxBrownie, Virtual Staging AI, REimaginehome are all output-only (staging, twilight, redesign). Lightroom + Firefly are table-stakes editing, not workflow.

Real differentiators where AutoQC already plays: pre-delivery QC, Lightroom XMP round-trip, Style Profile from reference photos (cheaper to set up than Imagen's full-catalog requirement), pay-as-you-go pricing, twilight/staging well below market. Workflow integrations (LR XMP, hot folders, MLS presets) need to catch up to the editing depth to stay defensible.

Table stakes 2026: per-image AI enhance, sky replace, basic object removal, virtual staging < $5/room, style training, web upload + batch download.

### Photographer pain points (synthesis, not live web — directional)

Top complaints across r/RealEstatePhotography and ASMP forums:

1. Turnaround time vs editing quality tradeoff (overseas editors inconsistent at 24–48h)
2. **Window pulls / sky replacements look fake** (over-saturation, halos, wrong sky)
3. **Vertical/perspective correction destroys ceilings or warps cabinets** ← AutoQC's lane
4. **AI hallucinated fixtures or removed real ones** (MLS compliance risk)
5. **Inconsistent edits across a single shoot** (#1 trust killer)
6. **Lawn greening / pool blueing looks cartoonish**
7. **AI-assisted bracket culling** (clearly unmet demand)
8. **MLS-spec auto-export** (everyone wants it, nobody has it)
9. Flash/ambient blending automation (still manual)
10. Client communication / revision rounds (no good tool)

Synthesized from training-data knowledge of those communities through Jan 2026. Recommend validating the top 3 with 5–10 customer calls before betting roadmap on them.

---

## Files added/touched tonight

- ✅ Committed: `src/app/dashboard/layout.tsx`, `src/components/upload/PhotoUploader.tsx`, this doc
- 🔬 One-shot diagnostics (delete after read): `scripts/_audit-customer-signals.ts`, `scripts/_audit-stuck-pending.ts`
- ⏸️ Uncommitted from earlier today (yours to decide): `scripts/roll-call-blast.ts`, `src/lib/announcements/rollCall.ts`

---

## What I deliberately did NOT touch

- `prisma/schema.prisma` (per CLAUDE.md, schema changes need explicit go)
- `lambda/qc_engine/checks/composition.py` (already touched today with sign-off; second touch in 24h is risky)
- `lambda/qc_engine/handler.py` main flow
- `Agency.totalCreditsPurchased`
- `src/app/api/webhooks/stripe/`
- Anyone's account state (no manual credit grants, no agency mutations)
- The 27 stuck photos for Chris (would need to verify credits + your call before re-enqueueing)
- Jordan's bug status (would auto-email him, redundant with the explicit email we already sent)

You are still the one approving anything that costs money or changes a customer's account.
