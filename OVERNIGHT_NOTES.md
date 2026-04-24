# Overnight Session — 2026-04-24

Paul asked for: speed improvements + deep research on virtual staging + figure out how to ship furniture-add safely. This doc captures what shipped, what to validate, and what to decide before flipping the beta to public.

---

## What shipped tonight

### Speed
- `next.config.mjs` — enabled `experimental.optimizePackageImports` for `lucide-react`, `framer-motion`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`. Cuts client JS on any page that pulls icons or animations (landing page + every dashboard page).
- Removed `recharts` from `package.json`. Verified zero imports in `src/`.
- Audited the idea of converting `public/demos/*.jpg` → WebP. Decided against it: the demo images are served via `<ReactCompareSliderImage>`, not `next/image`, so pre-conversion alone wouldn't help unless we also migrate the slider. Flagging as a medium-risk follow-up you can OK in the morning.

### Auth polish (earlier tonight)
- `Forgot password?` link now carries the email value from the login form to `/forgot-password?email=…` so the user doesn't retype.
- Forgot-password success state got a proper "Back to sign in" button.
- Reset-password expired-token error shows an inline "Request a new link →" CTA.
- Sidebar lost the stale `Password` item (lives in Settings now).
- Stale `/dashboard/account` link in the v1.1.0 changelog entry swung to `/dashboard/settings`.
- Auth log message stopped telling ops to run `scripts/set-user-password.ts` and now points at the self-service forgot-password flow.

### Docs
- `CLAUDE.md` + `CONTRIBUTING.md` rewritten: Paul is sole operator, direct-push to main is live, PR flow is optional. Removed all "Evan" and "flylisted GitHub handle" references.

### Virtual Staging (closed beta)

Behind an admin-only gate (non-admin agencies don't see the button). Mirrors the Virtual Twilight pattern end-to-end.

**Schema (live in prod):**
- Added `STAGING_PREVIEW`, `STAGING_FINAL` to `PhotoVariantType` enum (additive, no migration risk).
- Added `style String?` to `PhotoVariant` so different styles on the same photo key independently.

**Files added:**
- [src/lib/staging.ts](src/lib/staging.ts) — six styles, per-room furniture manifests, `buildStagingPrompt()`, eligibility, env-flag gate.
- [src/app/api/photos/[photoId]/staging/preview/route.ts](src/app/api/photos/[photoId]/staging/preview/route.ts) — free, 24h cache per `(photo, style)`.
- [src/app/api/photos/[photoId]/staging/purchase/route.ts](src/app/api/photos/[photoId]/staging/purchase/route.ts) — 3 credits, same refund-on-failure pattern as Twilight.
- [src/components/dashboard/StagingButton.tsx](src/components/dashboard/StagingButton.tsx) — style chips + preview pane + purchase.

**Wiring:**
- [src/app/dashboard/properties/[id]/page.tsx](src/app/dashboard/properties/[id]/page.tsx) — button renders next to the TwilightButton on the photo detail pane.

**Feature flag:** `VIRTUAL_STAGING_ENABLED`. Not set → admin agencies only (Paul's two admin accounts). Set to `"true"` in Vercel → opens it to everyone.

---

## What to validate before flipping the flag

The research report flagged six risks. You need to hit four of them on real photos before public opens. Test plan:

### 1. Hallucinated architecture (CRITICAL)
Stage 10 real empty rooms from your existing property archives. For each render, check:
- Did the model invent a fireplace, doorway, window, skylight, or ceiling fan that isn't in the source?
- Did wall paint or flooring change color / texture?

If the invented-architecture rate is > 10%, hold the flip. We can tighten the preservation clause or swap to Flux Kontext Pro (same Replicate pattern, one model ID change).

### 2. Scale errors
Specifically check rendered beds in small bedrooms and sectionals in narrow living rooms:
- Bed: is it king-sized when the room is clearly a twin-sized nursery?
- Sofa: does it clip through a visible wall?

If > 10%, same response: tighten prompt or upgrade model.

### 3. Lighting direction mismatch (MLS rejection risk)
Stage a room with hard side-window light (morning sun through a big east window). Verify:
- Cast shadows on the furniture point away from the window, not toward it.
- Furniture surfaces facing the window are brighter than those facing away.

This is the #1 MLS-rejection trigger. If the render fails this on even one photo, escalate.

### 4. MLS disclosure compliance
We are NOT currently overlaying a "Virtually Staged" watermark on the final render. Most MLSs require it. Two options:
- **A. Ship without it (match Twilight behavior).** Put disclosure language in the export footer / export UI so the agent sees it but the photo itself is clean.
- **B. Add a subtle corner watermark on the final** that the agent can toggle off.

Recommend **B** as default-on. Would take ~30 min to add via `sharp` overlay in the purchase route. Let me know in the morning.

---

## What to decide in the morning

1. **Flip `VIRTUAL_STAGING_ENABLED` to `true` in Vercel?** My recommendation: run steps 1-3 above first, then flip.
2. **MLS "Virtually Staged" watermark: yes / no / later?**
3. **Price point $3 — OK or move?** Competitors charge $15-50. Even at $5 we'd be a steal. I picked $3 to keep Twilight ($1) as the entry upsell and Staging as the premium upsell. Not married to it.
4. **Demo images migration to next/image?** Small win (~200 KB on landing), medium risk (the compare slider has its own rendering). Paul green-light before I touch this.
5. **`AUTOQC_LOGIN_ACCESS_CODE` delete from Vercel env.** Verified zero code references. Safe to remove. Want me to do it in the morning?

---

## Quick smoke-test for you when you wake

Sign into autoqc.io as the admin account. Open any property with classified room types (living_room, bedroom, dining_room, or office). In the photo detail modal you'll see a new amber **"Stage room"** button next to "Preview Twilight." Click it, pick a style, wait 3-6 seconds. Preview shows watermarked. Click "Keep for 3 credits" if you want the clean render.

If it looks awful on your first photo, that's data — tell me which style, which room, and what specifically is wrong. The prompts are tunable per-style in `src/lib/staging.ts`.

---

## End-to-end smoke test I already ran

Tested the full prompt pipeline on a real photo from your admin agency before wrapping for the night:

- **Source:** `19 Havlina Ln 10.jpg`, classified as `living_room`
- **Latency:** 8.5-9.5 seconds per render (Replicate sync endpoint + nano-banana)
- **Cost:** ~$0.04 per render × 6 styles = ~$0.24 total spent on your Replicate account
- **Output size:** 128-160 KB per jpg (healthy, not overcompressed)
- **All 6 styles succeeded:** no timeouts, no model errors

**Review the renders side-by-side when you wake:**

```
open /tmp/autoqc-staging-test/
```

Files in that folder:
- `_source.jpg` — the original empty room
- `staging-test-modern.jpg`
- `staging-test-traditional.jpg`
- `staging-test-scandinavian.jpg`
- `staging-test-farmhouse.jpg`
- `staging-test-midcentury.jpg`
- `staging-test-coastal.jpg`

If the source room has furniture already (it's the original upload, not guaranteed empty), that's expected — the prompt will stage over / replace as best it can. The real test is on a true empty room, which you can drop in tomorrow. But the architectural preservation on this test is the key signal: look for invented fireplaces / windows / doorways, which is the v1 risk.
