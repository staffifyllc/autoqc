# CLAUDE.md

Guidance for Claude sessions working in this repo. Load this before touching code.

## At a glance

- **Product:** AutoQC. Automated quality control + auto-editing for real estate photography agencies. Repo brand: `photoqc` (directory name). Public brand: AutoQC.
- **Live at:** https://www.autoqc.io
- **Repo:** https://github.com/staffifyllc/autoqc
- **Hosting:** Vercel (`staffifyllcs-projects/autoqc`). Push to `main` auto-deploys to production.
- **Stack:** Next.js 14.2 (App Router) + NextAuth + Prisma/PostgreSQL (RDS) + Python 3.12 Lambda (QC engine) + SQS FIFO + S3 + Stripe + Claude Sonnet 4.6 (vision) + Replicate (distraction removal, deblur).
- **Operator:** Paul is the sole contributor. No coordination friction; direct push to `main` is enabled and each push auto-deploys.

## First things to run at the start of every session

```bash
git fetch origin
git status
git log --oneline origin/main -5
```

If `origin/main` has moved since local, tell the user before starting new work. Never auto-pull onto a branch the user is actively working on.

## How work flows

The branch ruleset is off; you can push straight to `main`. Each push auto-deploys to production (`autoqc.io`) within ~60 seconds. Treat every push as a live deploy.

Typical workflow:

1. Pull latest: `git checkout main && git pull origin main`.
2. Edit, run `npx tsc --noEmit` locally before pushing.
3. Commit with a focused message and push. Production deploy kicks off.
4. Watch the Vercel build (`vercel ls --yes autoqc | head -4`) before walking away for anything non-trivial.

PRs are still welcome for big refactors or anything you want reviewed before it ships, but they are no longer required.

## Architecture — how the pieces talk

```
Browser
  │
  │  1) User uploads RAW/JPEGs via PhotoUploader
  ▼
Next.js (Vercel)
  │   - Requests presigned S3 URLs from /api/upload
  │   - Browser PUTs directly to S3 (bypasses Vercel)
  │   - Creates Photo rows in RDS with s3KeyOriginal
  │   - Enqueues QC job on SQS FIFO
  ▼
SQS FIFO queue (photoqc-jobs.fifo)
  ▼
Lambda `photoqc-engine` (Python 3.12, 1024 MB, 300s timeout)
  │   - Pulls RAW image from s3KeyOriginal
  │   - Runs 14 QC checks (OpenCV + Claude Vision)
  │   - Applies auto-fixes if issues are within auto-fix tolerance
  │   - Uploads fixed output to s3KeyFixed
  │   - Writes qcScore, issues JSON, fixesApplied back to the Photo row
  │   - Updates property status + qcPass/FailCount
  ▼
Next.js dashboard reads Photo rows → renders before/after slider, issue badges, download UI.

Billing path:
  - On property creation → lib/credits.ts deducts creditBalance OR charges Stripe (PAY_AS_YOU_GO)
  - Creates CreditTransaction + UsageRecord rows
```

**Secondary Lambda:** `photoqc-profile-learner` — separate function that analyzes a style profile's reference photos and writes learned min/max/avg tolerances onto `StyleProfile`.

**External APIs:**
- **Anthropic** (`@anthropic-ai/sdk`) — Claude Sonnet 4.6 for `composition` check (semantic analysis + room type classification) inside the Lambda.
- **Replicate** — `schananas/grounded_sam` + `allenhooo/lama` for distraction removal, NAFNet for deblur, both called from the Lambda when a Premium property requests them.
- **Stripe** — billing. Webhook at `/api/webhooks/stripe`.
- **Dropbox, Aryeo, HDPhotoHub, Spiro, Tonomo** — platform push integrations in `src/lib/integrations/`.

## Project structure

```
photoqc/
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── layout.tsx               # Root metadata, JSON-LD, Analytics, Toaster
│   │   ├── page.tsx                 # Landing page
│   │   ├── sitemap.ts               # SEO sitemap
│   │   ├── robots.ts                # SEO robots rules
│   │   ├── pricing/                 # Public pricing page (+ layout.tsx for metadata)
│   │   ├── demo/                    # Public demo (+ layout.tsx for metadata)
│   │   ├── login/ onboarding/       # Auth flows — NOINDEX via robots.ts
│   │   ├── dashboard/               # Logged-in app (noindex)
│   │   │   ├── properties/[id]/     # THE QC REVIEW UI (before/after slider lives here)
│   │   │   ├── profiles/            # Style profiles + client profiles + reference uploads
│   │   │   ├── billing/ credits/    # Stripe + credit purchase flow
│   │   │   ├── integrations/        # Connect platforms
│   │   │   └── admin/               # Internal-only — server-gated by isAdmin flag
│   │   └── api/
│   │       ├── auth/[...nextauth]   # NextAuth handler
│   │       ├── onboarding/          # Creates Agency + auto-grants 10 PROMO credits
│   │       ├── upload/              # S3 presigned URL generator
│   │       ├── properties/          # CRUD + QC triggers + photo operations
│   │       ├── profiles/            # Style/client CRUD + reference upload + learn trigger
│   │       ├── integrations/        # Connect, push-to-platform
│   │       ├── credits/             # Purchase + grant
│   │       └── webhooks/stripe/     # Stripe billing events
│   ├── components/
│   │   ├── upload/                  # PhotoUploader, UploadStatusPanel
│   │   ├── review/                  # QC review UI bits
│   │   ├── providers/               # SessionProvider wrapper
│   │   ├── dashboard/               # DistractionCategoriesPanel, etc.
│   │   └── JsonLd.tsx               # SEO structured data
│   └── lib/
│       ├── auth.ts                  # NextAuth config + requireAuth, requireAgency
│       ├── db.ts                    # Prisma client singleton
│       ├── s3.ts                    # getUploadUrl, getDownloadUrl, getS3Key
│       ├── sqs.ts                   # enqueueQCJob
│       ├── stripe.ts                # Stripe SDK
│       ├── credits.ts               # chargeForProperty, checkPaymentCapability
│       ├── photoZip.ts              # Client-side zip download (supports "Both" mode)
│       ├── lightroomZip.ts          # Lightroom-compatible bundle with XMP
│       ├── xmp.ts                   # XMP sidecar generation
│       ├── distractionCategories.ts # Enum + safe-defaults logic
│       └── integrations/            # aryeo.ts, hdphotohub.ts, dropbox.ts
├── lambda/
│   └── qc_engine/
│       ├── handler.py               # SQS consumer entrypoint
│       ├── profile_learning.py      # Secondary Lambda handler
│       ├── checks/                  # 14 QC check modules (see below)
│       └── fixes/                   # Auto-correction modules (see below)
├── prisma/
│   └── schema.prisma                # All DB models
├── scripts/
│   ├── grant-credits.sh             # Test-only credit grant (DO NOT USE for prod promos — see below)
│   ├── deploy-lambda.sh             # Lambda deploy helper
│   └── ...
├── public/
│   ├── og.jpg                       # OpenGraph card
│   └── demos/                       # Hero demo images
├── CONTRIBUTING.md                  # Branch/PR workflow — read this
├── SETUP.md                         # Local dev setup
├── NIGHT_NOTES.md / NIGHT_CHANGES.md# Session-end summaries (treat as historical)
└── CLAUDE.md                        # This file
```

## Data model — the models that matter most

Full schema is in `prisma/schema.prisma`. Key relationships:

- **User** ←→ **Agency** via **AgencyMember** (many-to-many with role).
- **Agency** owns **StyleProfile**s (agency-wide style), **ClientProfile**s (per-end-client overrides), **Property**s, **Integration**s, **CreditTransaction**s.
- **Property** → many **Photo**s.
- **Photo** has `s3KeyOriginal` (always) and `s3KeyFixed` (nullable — only when auto-fix ran). `issues` JSON stores flat severity map + metadata (`_room_type`, `_scene`, `_fix_actions`).
- **CreditTransaction.type** enum: `PURCHASE` | `USAGE` | `REFUND` | `ADJUSTMENT` | `PROMO`. Only `PURCHASE` counts toward revenue.

Key enums to respect:
- `PropertyStatus`: `PENDING` → `PROCESSING` → `REVIEW` | `APPROVED` → `PUSHED`
- `PhotoStatus`: `PENDING` → `PROCESSING` → `PASSED` | `FIXED` | `FLAGGED` → `APPROVED` | `REJECTED`
- `PropertyTier`: `STANDARD` (1 credit, full QC) | `PREMIUM` (2 credits — adds privacy blur, distraction removal, AI deblur)

## QC engine — 14 checks

Lives in `lambda/qc_engine/checks/`. Each returns issue severity (and often a fix action) written into `Photo.issues` JSON.

| Check | Method | Auto-fix? |
|---|---|---|
| `verticals.py` | OpenCV Hough lines | ✓ up to 7° |
| `horizon.py` | OpenCV Hough lines | ✓ up to 5° |
| `color.py` | B/R channel ratio + cast detection | ✓ |
| `exposure.py` | Histogram analysis | flag only |
| `window_blowout.py` | Bright region detection | flag only |
| `sharpness.py` | Laplacian variance (also per-quadrant) | ✓ (AI deblur via Replicate NAFNet on slight blur) |
| `chromatic_aberration.py` | LAB fringe detection | flag only |
| `hdr_artifacts.py` | Halo + flat tonemap detection | flag only |
| `sky.py` | HSV sky + edge artifact detection | flag only |
| `lens_distortion.py` | Edge-line curvature | flag only |
| `composition.py` | **Claude Sonnet 4.6 vision** — returns `room_type`, composition score, `fix_actions`, privacy regions | flag + drives other fixes |
| `consistency.py` | Cross-photo metric comparison within the property | flag only |
| `distraction_removal.py` | Claude detects + Replicate inpaints (trash cans, hoses, cables, photographer reflections, etc.) — **PREMIUM tier + opt-in categories only** | ✓ |
| `personal_images.py` | Claude detects framed photos, kids, diplomas | ✓ via `blur_personal.py` (PREMIUM only) |

Fixes live in `lambda/qc_engine/fixes/`:
- `apply_actions.py` + `smart_editor.py` are orchestrators — they pull `fix_actions` emitted by `composition.py` and route them to individual fixers.
- Individual fixers: `vertical_fix.py`, `horizon_fix.py`, `color_fix.py`, `sharpness_fix.py`, `ai_deblur.py`, `blur_personal.py`, `remove_distractions.py`.

`composition.py` is the highest-value check — it emits **room_type classification** used for MLS ordering, **composition score** used for culling, and **`fix_actions`** that the other fixers act on. Changes to its prompt are high-blast-radius. Treat it like schema.

### Photo.issues JSON conventions

`issues` stores severity scores keyed by issue name PLUS metadata keys prefixed with `_`. When iterating severities, skip `_*` keys — they're strings, not numbers. `handler.py` already does this, don't break the pattern.

Known metadata keys:
- `_room_type` — one of `kitchen | living_room | bedroom | bathroom | exterior_front | exterior_back | exterior_pool | dining_room | office | hallway | basement | other`
- `_scene` — free-form Claude description
- `_fix_actions` — structured list of fixer instructions

## Credits model — read before touching credit code

This is the #1 area where a fresh Claude will break prod quietly.

**Three fields on Agency:**
- `creditBalance` — spendable now
- `totalCreditsPurchased` — lifetime PAID credits. **Drives the paying vs. non-paying status pill and revenue dashboards.**
- `hasPaymentMethod` — triggers PAY_AS_YOU_GO eligibility

**CreditTransaction.type enum:**
- `PURCHASE` — only type that counts toward revenue
- `USAGE` — negative amount, property processing
- `REFUND` — QC engine failed, credit restored
- `ADJUSTMENT` — manual admin correction
- `PROMO` — welcome bonus, test credits, free grants

**The rule for promo/free grants (welcome bonus, manual "give them 25 credits", etc.):**

```ts
// Correct pattern (see src/app/api/onboarding/route.ts):
await prisma.agency.update({
  where: { id: agencyId },
  data: {
    creditBalance: { increment: amount },
    // DO NOT touch totalCreditsPurchased
    creditTransactions: {
      create: {
        type: 'PROMO',                // not PURCHASE
        amount,
        description: 'Welcome bonus'  // or similar
      }
    }
  }
})
```

Why: if promo grants increment `totalCreditsPurchased`, free agencies show up as "paying" in the admin dashboard and inflate revenue. `scripts/grant-credits.sh` increments both fields — **don't use it for real promo grants, only test grants where you control a sandbox account.**

## Production safety

Paul is the sole operator, but every push still hits real infra shared with paying users:

- **Production RDS writes** — mass scripts touch real customer data. Always dry-run first, then `--apply`.
- **Lambda deploys** — `./scripts/deploy-lambda.sh` replaces the running QC engine instantly.
- **Prisma schema changes** — `npx prisma db push` is live. Additive-only changes are safe; renames/drops need a migration plan.
- **Manual credit grants** — always PROMO type, never touch `totalCreditsPurchased`. See the Credits model section.
- **Stripe / billing routes** — real money. Test in Stripe's dashboard before shipping route changes.

## Vercel deploys

- Push to `main` auto-deploys to production (`autoqc.io`) within ~60 seconds.
- Preview URLs (for any long-lived branch or PR) follow the pattern `autoqc-<branch>-staffifyllcs-projects.vercel.app`. Previews hit the **production** backend (same RDS, S3, Lambda) — do not run destructive test actions against them expecting isolation.

## Don't touch without asking

- `prisma/schema.prisma` — schema changes are live the moment you `prisma db push`. Additive only; never rename or drop existing fields without a migration plan.
- `lambda/qc_engine/handler.py` main flow — the SQS consumer loop, DLQ handling, and `Photo.issues` shape are load-bearing.
- `lambda/qc_engine/checks/composition.py` prompt — emits `room_type`, `fix_actions`, `privacy`; downstream code depends on the exact keys.
- `Agency.totalCreditsPurchased` — see credits section.
- `src/app/api/webhooks/stripe/` — real money.
- `.env.local` — gitignored, **never commit**. Uses a symlink from `.env`.
- Git config — never `git config user.email` etc. The user has their own identity set.

## Gotchas that will trip up a fresh Claude

1. **RAW uploads don't work yet.** `src/components/upload/PhotoUploader.tsx` accepts only JPEG/PNG/TIFF/WebP, 50 MB max. Culling + RAW support is a planned feature (see design conversations in session notes), not in current code.

2. **The before/after slider uses `react-compare-slider`.** `origSrc = originalUrl || thumbnailUrl`. `thumbnailUrl` is `fixedUrl || originalUrl` — so an unfixed photo's "thumbnail" IS the original. Don't assume thumbnailUrl is a separately-generated thumbnail. There isn't one.

3. **`scripts/grant-credits.sh` is broken for real use.** It increments `totalCreditsPurchased`, which corrupts the paying pill. Use the onboarding-route pattern instead, or write a one-off Node script that increments only `creditBalance` and records a PROMO transaction.

4. **`Photo.issues` mixes severity numbers with metadata strings.** Always skip `_`-prefixed keys when iterating severities. `float()` on `"exterior_pool"` crashed finalization before — `handler.py` has defensive filtering now, don't remove it.

5. **Client vs. server components.** `page.tsx` for `/pricing`, `/demo`, `/login`, `/onboarding`, and `dashboard/layout.tsx` are all `"use client"`. Per-page `metadata` exports require a **server** component — use a sibling `layout.tsx` (server) that wraps the client `page.tsx`. See `src/app/pricing/layout.tsx` for the pattern.

6. **Landing page is a client component too** (`"use client"` at top of `src/app/page.tsx`). Its `<h1>` is a `motion.h1` — don't strip framer-motion without a plan for SEO regression.

7. **Prod DB connection string is hardcoded in `scripts/grant-credits.sh`.** Not a secret in-repo (it's an infra reality), but never print it in logs or commit new references to it.

8. **Squash-merge, not rebase-merge** (when you do open PRs). History should show one commit per PR on `main`. Easier to revert, easier to read.

## Useful commands

```bash
# Day-to-day
npm run dev                       # localhost:3000
npm run build                     # full Vercel-equivalent build (surfaces type + metadata errors)
npx tsc --noEmit                  # fast type check only
npx prisma studio                 # visual DB browser → localhost:5555
npx prisma generate               # regenerate client after schema change

# Lambda
./scripts/deploy-lambda.sh

# Git workflow (direct-push enabled)
git checkout main && git pull origin main
# ...edit...
git add -A && git commit -m "..." && git push origin main

# Vercel
vercel ls --yes autoqc | head -6  # recent deploys + status
vercel env ls                     # all env vars
vercel env add KEY production     # add a prod env var
```

## When you're stuck or uncertain

- Check `NIGHT_NOTES.md` and `NIGHT_CHANGES.md` for recent session summaries.
- Preview deploys are safe to test. Prod DB writes from a preview deploy are **not** — the preview shares prod infra.
- If a decision affects billing, credits, or schema: propose the plan to the user first, don't rewrite.

Keep commits descriptive. Ship small, ship often.
