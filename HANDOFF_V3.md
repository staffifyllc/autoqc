# AutoQC V3 → V4 Handoff

**Read order:** this file first, then [CLAUDE.md](CLAUDE.md), then `git log --oneline -20`. Skip `HANDOFF.md` (pre-V2, stale).

**Last updated:** 2026-04-28 (V3 session running out of context, refreshed for V4)
**Repo state:** `main` is clean, auto-deploy to autoqc.io is live, latest commit `8e0d946`.
**Branch:** `main`, no local diffs.

---

## TL;DR for V4 Claude

V3 was a long, productive session. Highlights:

1. **Multi-angle Virtual Staging** shipped today (commit `8e0d946`). Same furniture, same position, different camera angle. Closed beta still admin-only.
2. **Style Profile "3+ day analyze" bug** found + fixed. UI never refetched after kicking off the Lambda. 6 stuck profiles re-run, 3 customers emailed (Chris/Bolor, Lux-immobilier, Realtour Pilot, HelioBook).
3. **Evan's CRITICAL bug** (the AWS SDK ESM crash) resolved by hotfix `4e6e0fa` shipped earlier. Closed his bug report and emailed him.
4. **Landing page rebuild** (Lusion-style): manual drag slider hero, scroll-driven QC scan, virtual staging "drop from sky" with construction dust + feathered mask. No more WebGL shaders, no custom cursor.
5. **Reactivation campaign** to idle signups went out (founder-offer block + lock-in-access).

Open thread Paul's last message attached a screenshot ("lets clean some stuff up, lets remove these guys") — V3 ran out of context before identifying which UI elements he meant. **First thing for V4 Claude: ask Paul to clarify which specific elements he wants removed.**

---

## What shipped in V3 (chronological-ish)

### Multi-angle Virtual Staging — `8e0d946`
Customer concern: when staging the same room from different angles, furniture identity AND position must match.

- Schema: `Photo.stagingSpatialManifest` (Text), `Photo.stagingAnchorPhotoId` (String). Both nullable, additive. Pushed via `prisma db push --skip-generate`.
- `src/lib/stagingManifest.ts` — Claude Sonnet 4.6 vision call extracts furniture positions anchored to architectural features. Stored on the anchor photo, reused per angle. ~$0.005-$0.01 per call, idempotent.
- `src/lib/staging.ts` — `buildStagingPrompt` accepts optional `anchorManifest`. When present, replaces the inspiration clause with a strict "different camera angle of same room" clause, embeds the manifest, forbids inserting off-frame pieces.
- `src/app/api/photos/[photoId]/staging/preview/route.ts` + `.../purchase/route.ts` — both accept `anchorPhotoId`, lazy-generate manifests, fire-and-forget own manifest gen, persist `stagingAnchorPhotoId`.
- `src/app/api/photos/[photoId]/staging/anchors/route.ts` (NEW) — GET endpoint returning sibling photos in the same property with at least one ready `STAGING_FINAL` or `STAGING_PREVIEW`. Sorted: same-room first, has-manifest first.
- `src/components/dashboard/StagingButton.tsx` — anchor thumbnail picker above the style picker. Auto-picks first same-room sibling with manifest. Green dot for same-room, amber border + ring when selected, "Locked to match" hint when active.

Cost analysis: ~$0.22 per non-anchor render (gpt-image-1 high-quality 1536×1024) + ~$0.01 manifest call. Margin per 5-angle room stays ~$8.90+.

**Anchor wins over inspiration** if both passed (only one second image per OpenAI call).

### Style Profile fixes — `4fa867b` + `a4b9350`
- Lambda `photoqc-profile-learner` bumped from 3008 MB → 6144 MB (3 profiles OOM'd on dense reference sets).
- UI refactor: real progress + spinner + error states; `fetchProfile()` after success. Was: `alert("Learning started!")` and never refetched, so customers thought it was stuck for 3 days.
- One-click "Set default" button on profiles list (Chris's request).
- 6 stuck profiles re-run, all succeeded.
- Customer emails sent: Chris (Bolor), Lux-immobilier, Realtour Pilot, HelioBook.

### Landing page polish
- `c4f8cfb` — killed the WebGL shader on hero, replaced with `ManualBeforeAfter` (CSS clip-path drag-to-compare).
- `2a7859e` — `ScrollStagingDemo` cinematic transitions (not crossfades). Furniture drops from sky as user scrolls; QC fixes happen first, then staging drop.
- `bcb3c1c` — feathered `mask-image` (linear gradient with `useMotionTemplate`) replaces the hard `clip-path` seam. Construction dust + speed streaks.
- `776f854` — removed the bouncy translateY/rotate overshoot.
- `9824513` — extended section to `h-[320vh]`; staging finishes at 0.7 of scroll, leaving 0.7→1.0 as pinned linger.

Removed: Lenis SmoothScroll, CursorReticle, `ogl` package.

### Reactivation campaigns
- `47de90a` — idle-user reactivation blast, lock-in-access copy.
- `b320d50` — founder-offer block + grant script + preview tool.
- All sent via Resend from `Paul Chareth <hello@autoqc.io>`, reply-to `pchareth@gmail.com`.

### Hotfixes
- `4e6e0fa` — pin `@aws-sdk/xml-builder@3.972.18` (ESM mismatch crash). Resolved Evan's CRITICAL bug.
- `62d4c18` — force `prisma generate` during Vercel build (`stagingUnlockedAt unknown` error after schema bump).
- `d72b01e` — Style Profile learning actually invokes the Lambda (was stubbed).

---

## Open / pending threads (V4 should pick from these)

### Most recent — needs immediate clarification
- **"lets clean some stuff up, lets remove these guys"** with attached screenshot. V3 ran out of context before identifying which elements. Ask Paul to point at them again, or re-share the screenshot. Most likely candidates given recent work:
  - StagingButton modal (just shipped multi-angle picker)
  - Anchor thumbnail strip if he changed his mind
  - Sidebar items
  - Landing page sections
  - Dashboard widgets

### Infrastructure
- **MX records for autoqc.io** — Paul still needs to choose Cloudflare Email Routing vs ImprovMX. Cold emails to `hello@autoqc.io` currently bounce.
- **Delete `AUTOQC_LOGIN_ACCESS_CODE` from Vercel env** — verified zero code references months ago. Never removed.
- **Health audit residual** — 1 lockout (`hello@gostaffify.com`), 2 abandoned uploads (4d + 14d old), 6 zero-photo virtual-staging shells. Not blocking, sweep when convenient.

### Virtual Staging
- **MLS "Virtually Staged" watermark** — recommended default-on for compliance. ~30 min via sharp overlay on purchase route. Paul has not green-lit.
- **A/B test of `google/nano-banana` vs `flux-kontext-pro`** — `scripts/ab-stage.ts` was built then deleted. ~$0.60 to rebuild + run on the 4-render test set. Worth doing once UX stabilizes.
- **Model-agnostic abstraction** — if we A/B to a different model, `geminiEditImage()` should be renamed + the model configurable per feature.
- **Multi-angle anchor picker UX** — not yet customer-tested. Closed beta still admin-only via `VIRTUAL_STAGING_ENABLED` env flag.

### Other paused work
- **Property Lines on drone photos** — feasibility doc in stale `HANDOFF.md`. Still waiting on Regrid account + sample drone photos from Paul.
- **Demo image → WebP/next/image migration** — modest speed win, medium risk (compare-slider has its own rendering).

---

## What V3 Claude tried that didn't ship

- **Ad-hoc audit scripts** — `scripts/_health-audit.ts` and `scripts/_close-evan-and-audit.ts` were one-shot, used, and deleted. Don't expect them in repo. Pattern: prefix one-shot scripts with `_`, delete after use.
- **`STAGING_KEEPER` typo** — wrote it in 3 places before catching that the actual Prisma enum is `STAGING_FINAL`. Fixed via sed before push. **The enum is `PhotoVariantType { STAGING_PREVIEW | STAGING_FINAL | TWILIGHT_PREVIEW | TWILIGHT_FINAL }`.** Don't invent KEEPER.
- **`prisma.bugReport.user` relation** — does not exist. `BugReport.reporterUserId` is a String, not a relation. Query users separately if you need them.
- **`BugReport.status` enum** — is `NEW | TRIAGED | IN_PROGRESS | FIXED | WONT_FIX`. Not `RESOLVED`.
- **`Integration.type`** — does not exist. Real field is `Integration.platform`.

---

## Memory rules (re-stated; loaded automatically from `~/.claude/projects/.../memory/` but worth repeating)

1. **Do it yourself via API** — if a token/CLI cred exists locally, execute directly. Don't generate click-through instructions for Paul.
2. **"Remove [user]" = zero credits, NOT delete.** Only hard-delete if Paul says "delete." Silence on a yes/no question ≠ yes.
3. **No em dashes, ever.** Periods / commas / restructure. Em dashes read as AI-generated.
4. **Preview before UI changes** — propose the approach on design feedback and get alignment. Don't rewrite blind.
5. **`scripts/grant-credits.sh` is broken for promo use** — it bumps `totalCreditsPurchased`. Use the in-route PROMO pattern from `src/app/api/onboarding/route.ts`.

---

## High-risk zones (don't touch without Paul's explicit go)

From `CLAUDE.md`:
- `prisma/schema.prisma` — additive only, never rename/drop existing fields
- `lambda/qc_engine/handler.py` main flow
- `lambda/qc_engine/checks/composition.py` prompt (emits `room_type`, `fix_actions`, `privacy` — downstream depends on exact keys)
- `Agency.totalCreditsPurchased` — must stay accurate for the paying pill
- `src/app/api/webhooks/stripe/` — real money
- `.env.local` — never commit

---

## Current product state (snapshot 2026-04-28)

- **Brand:** AutoQC, live at [autoqc.io](https://www.autoqc.io)
- **Repo brand:** `photoqc/`
- **Version:** 1.7.x (Virtual Staging closed beta + multi-angle anchor mode)
- **Closed-beta env flag:** `VIRTUAL_STAGING_ENABLED` (admin-only otherwise; admins always bypass)
- **Pricing:**
  - Pay-as-you-go $12/property standard, $20 premium
  - Volume packs 10/$100 → 100/$800
  - Virtual Twilight $1/exterior (preview free)
  - Virtual Staging $3/room one-time unlock per photo (preview free; "Keep" is free after first preview unlocks)
  - Signup bonus 5 PROMO credits
- **Email infra:** Resend, sender `hello@autoqc.io`, DKIM+SPF verified via Vercel DNS. MX still missing (inbound bounces).
- **Active customers:** ~10 paying agencies + 2 admin accounts.

---

## How V4 Claude should pick up

First 60 seconds:
```bash
cd "/Users/paulchareth/Desktop/Claude Code/photoqc"
git status
git log --oneline -15
cat HANDOFF_V3.md       # this file
vercel ls --yes autoqc | head -6
```

Then ask Paul:
> "Picking up from V3. Your last message attached a screenshot saying 'lets remove these guys' but V3 ran out of context. Can you point at the elements again? Also: multi-angle staging shipped clean, want me to verify it on a real customer photo set or move on?"

If Paul has moved on, start from wherever he is. Don't replay.

---

## Keeping this file fresh

V4 Claude updates this file:
- Before any context-compression event it can detect
- Whenever a significant decision is made or a feature ships
- At Paul's explicit request

Keep it short (under 300 lines) and pointer-heavy. Detailed history belongs in `git log`, not here. When V4 hands off, rename to `HANDOFF_V4.md` (or just update the heading + dates and keep filename `HANDOFF_V3.md` if Paul prefers a single rolling handoff).
