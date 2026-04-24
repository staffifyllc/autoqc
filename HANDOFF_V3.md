# AutoQC V3 — Handoff

**Read order:** this file first, then [OVERNIGHT_NOTES.md](OVERNIGHT_NOTES.md), then [CLAUDE.md](CLAUDE.md). Skip `HANDOFF.md` — it is from a pre-V2 session and most of its content is stale.

**Last updated:** 2026-04-24 (session: AutoQC V2, morning)
**Repo state:** `main` is clean, auto-deploy to autoqc.io is live, latest commit is the staging smoke-test doc.

---

## Where we are right now

### Shipped today (afternoon continuation)
- **Flylisted at-cost pricing** — new nullable `Agency.stagingCreditCost` column overrides the default 3-credit staging cost per agency. Set to 1 on the three @flylisted.com rows. Any other agency, including customers, still pays the default $3.
- **Virtual Staging landing card** — new Sofa-iconed feature card on the landing page feature grid, flagged New.
- **Virtual Staging standalone tab** — `/dashboard/staging` route and sidebar entry for customers who want staging without full QC. Creates a flagged Property (`isStandaloneStaging=true`), reuses the existing upload + Lambda-QC pipeline for room_type classification, and filters these sessions out of `/dashboard/properties`.
- **First-pass staging renders on empty rooms** — ran Modern + Traditional on a clean dining room and a clean bedroom from Paul's Richmond St Dover NH photo set. All key architecture preserved (bay window, chandelier, ceiling fan, trim, floors). Dramatically better than the furnished-room test from the overnight session — confirms the failure mode was "replace existing furniture," not "model can't do staging."

### Just shipped in the current session
- **Password reset flow** — `/forgot-password`, `/reset-password`, HMAC-signed tokens bound to `passwordSetAt`, 60-min expiry. Linked from login.
- **`/dashboard/settings`** — Profile (name + email, save immediately, no email verification), Company (agency name), Password. Replaces the old `/dashboard/account` page.
- **Sign Out button fixed** — was a dead `<button>`; now calls `signOut({ callbackUrl: "/login" })`.
- **Docs rewritten** — `CLAUDE.md` + `CONTRIBUTING.md` reflect sole-operator direct-push workflow (no more PR gate, no more two-person coordination).
- **Speed** — `next.config.mjs` enables `optimizePackageImports` for `lucide-react` / `framer-motion` / radix; removed unused `recharts` dep.
- **Virtual Staging (closed beta, admin-only)** — full end-to-end feature live behind `VIRTUAL_STAGING_ENABLED` env flag.

### Still open / paused
- **A/B test of `google/nano-banana` vs `black-forest-labs/flux-kontext-pro`** — `scripts/ab-stage.ts` was built and ready to run when Paul pivoted. Deleted from the repo but trivial to rebuild if Paul wants to proceed. ~$0.60 to run on the 4-render test set. Worth doing once the staging UX stabilizes.
- **MLS "Virtually Staged" watermark** — still not shipped. Paul needs to decide default-on vs off vs export-UI label.
- **Model-agnostic abstraction** — if we A/B to a different model, `geminiEditImage()` should be renamed + the model configurable per feature.

### The open decision we were on when V2 ran out
Smoke-tested Virtual Staging on a real photo and showed Paul 6 style renders. **4 of 6 renders lost the fireplace**, plus the wall sconces and mirror above it. Root cause: the preservation clause in `src/lib/staging.ts` says "walls, windows, doors, floors, light fixtures, ceiling" but does not name fireplaces, sconces, mirrors, built-ins, or ceiling fans explicitly. Nano Banana treats unnamed focal-wall features as swappable content.

**Paul needs to choose in V3 (or this session if not yet answered):**
1. Tighten the preservation clause (adds ~10 min of work, rerun the 6 styles on same photo)
2. Re-test on a truly empty room (neutralizes the "replace furniture" complication)
3. Both

See the renders at `/tmp/autoqc-staging-test/` (may not survive a reboot — if gone, rerun via `scripts/test-staging.ts` pattern).

### What is paused, not dropped
- **MLS "Virtually Staged" watermark** — recommended default-on for compliance. ~30 min to add via sharp overlay on purchase route. Not shipped; waiting on Paul go-ahead.
- **Demo image → WebP/next/image migration** — modest speed win, medium risk (compare-slider has its own rendering). Flagged in OVERNIGHT_NOTES.md.
- **Delete `AUTOQC_LOGIN_ACCESS_CODE` from Vercel env** — verified zero code references. Paul needs to say "go" or do it himself.
- **Property Lines on drone photos** — feasibility doc in HANDOFF.md "Open" section. Still waiting on Regrid account + sample drone photos from Paul. Not touched in V2.
- **False-positive horizon detector accuracy** — known issue in Lambda, out of scope for V2 (Lambda is high blast radius).

---

## Current product state

- **Brand:** AutoQC, live at [autoqc.io](https://www.autoqc.io)
- **Repo brand:** `photoqc/`
- **Version:** 1.7.0 (shipping Virtual Staging, admin-only)
- **Shipped features:**
  - 14 QC checks on every photo, auto-fixes where safe
  - Virtual Twilight ($1/exterior)
  - Virtual Staging (closed beta, $3/room, 6 styles, admin-only via env flag)
  - Self-serve signup with 5-credit welcome bonus
  - Password auth with self-serve reset
  - Settings page
  - Feedback widget (bugs + feature requests)
  - Admin announcements tool (used once to blast What's New)
  - Dashboard with updates changelog, credits, billing, integrations

- **Live customers with credits:** 10 agencies, plus 2 admin accounts. Last known balances in `/tmp/autoqc-staging-test/...` no wait, check with a live DB query in V3.

### Pricing model in effect right now
- **Pay-as-you-go:** $12/property standard, $20/property premium
- **Volume packs:** 10/$100 → 100/$800 (20% off at top)
- **Virtual Twilight:** $1/exterior (preview free)
- **Virtual Staging:** $3/room (preview free) — closed beta
- **Signup bonus:** 5 free credits, PROMO type, does not inflate `totalCreditsPurchased`

---

## Memory rules established across sessions

These are stored in `~/.claude/projects/-Users-paulchareth-Desktop-Claude-Code/memory/` and auto-loaded in every new session, but repeating them here so V3 Claude has them in-thread too:

1. **Do it yourself via API** — if a token or CLI cred exists locally, execute directly. Do not generate click-through instructions for Paul.
2. **"Remove [user]" = zero credits, NOT delete** — established after I hard-deleted luximmophoto when Paul only wanted their credits zeroed. Only hard-delete if Paul says "delete." If ambiguous, re-ask explicitly; silence on a yes/no question ≠ yes.
3. **No em dashes, ever** — periods / commas / restructure. Em dashes read as AI-generated.
4. **Preview before UI changes** — on design feedback, propose the approach first and get alignment. Don't rewrite blind.
5. **Recruiter UX is foolproof by default** (for Staffify projects, not AutoQC-specific).

---

## High-risk zones (do not touch without Paul's explicit go)

From `CLAUDE.md`:
- `prisma/schema.prisma` — additive only, never rename/drop existing fields
- `lambda/qc_engine/handler.py` main flow
- `lambda/qc_engine/checks/composition.py` prompt (emits room_type, fix_actions, privacy — downstream depends on exact keys)
- `Agency.totalCreditsPurchased` — must stay accurate for the paying pill
- `src/app/api/webhooks/stripe/` — real money
- `.env.local` — never commit

---

## Current session scratch notes

- Landing page: new stats bar, 14/9/3 numbered feature headline, step timing pills
- Email blasts: Resend via `hello@autoqc.io`, DKIM+SPF verified on autoqc.io via Vercel DNS
- Unsubscribe tokens: HMAC userId, no expiry (idempotent)
- Password reset tokens: HMAC(userId + passwordSetAt + exp), 60min TTL; invalidates once passwordSetAt changes
- The `scripts/` directory has a few one-off utilities (set-user-password, grant-credits.sh). `grant-credits.sh` is broken for promo use (also updates totalCreditsPurchased). Always use the in-route PROMO pattern.

---

## How V3 Claude should pick up

First 60 seconds:
```bash
cd "/Users/paulchareth/Desktop/Claude Code/photoqc"
git status
git log --oneline -10
cat HANDOFF_V3.md       # this file
cat OVERNIGHT_NOTES.md  # what shipped last night
vercel ls --yes autoqc | head -6    # current deploy state
```

Then ask Paul:
> "Picking up from V2. Last open thread was the staging prompt fidelity — 4 of 6 renders lost the fireplace in the test set. Want me to tighten the preservation clause and rerun, test on an empty room, or pivot to something else?"

If Paul has moved on, just start from wherever he is. Don't replay.

---

## Keeping this file fresh

V2 Claude will update this file:
- Before any context-compression event it can detect
- Whenever a significant decision is made or a feature ships
- At Paul's explicit request

V3 Claude should update it the same way. Keep it short (under 250 lines) and pointer-heavy — detailed history belongs in git log, not here.
