# AutoQC — HANDOFF

**Last updated:** 2026-04-23
**Repo:** `photoqc/` on `main` (clean, auto-deploy to autoqc.io via Vercel)
**Collaborators:** Paul (owner), Evan Leith (GitHub: `flylisted`)
**Read this first. Then `CLAUDE.md` for architecture.**

---

## Where we left off

Paul asked a feasibility question — **not a ship-it request**:

> "a lot of agents need property lines drawn, usually they are pretty obvious, there's a tool people use called AcreValue, wondering what's the likelihood that on high-up drone photos we could get that potentially added as an option"

**Next action:** give Paul a short feasibility write-up (not code yet). See "Open: Property Lines on Drone Photos" below for the draft.

---

## Current product version: **v1.4.0**

Source of truth is `src/lib/updates.ts`. When you ship a new change, add a version entry there so it shows in the dashboard Updates tab.

| Version | Shipped | What |
|---|---|---|
| v1.4.0 | 2026-04-23 | Landing refresh (TwilightHero, SpotlightCard, "not an editing service" copy, workflow strip), in-app Updates tab with unread dot |
| v1.3.0 | 2026-04-22 | Virtual Twilight ($1/exterior, Replicate `google/nano-banana`) |
| v1.2.0 | 2026-04-21 | Auto-sort by room type (drag-drop config), Revert to original toggle, cyan-sky fix (block positive `saturation_global`) |
| v1.1.0 | 2026-04-20 | Real bcrypt password auth (killed dev-login P0), in-app bug reports + admin triage + Resend notifications |

---

## Recently shipped (this session)

1. **Virtual Twilight** — `src/lib/gemini.ts` (misnamed; routes Replicate), `src/app/api/photos/[photoId]/twilight/{preview,purchase}/route.ts`. Preview free + 24h cache, purchase debits 1 credit in txn pre-generation, refunds on failure.
2. **Cyan sky fix** — Blocked positive `saturation_global` in `apply_actions.py`; hard rule added to `composition.py` prompt.
3. **Auth** — `User.passwordHash` + `passwordSetAt`, bcrypt cost 12, `scripts/set-user-password.ts` for admin resets.
4. **Bug reports** — `BugReport` model, widget, admin triage page, Resend on submit/resolve.
5. **Auto-sort** — `Agency.autoSortEnabled` + `photoSortOrder String[]`, @dnd-kit drag-drop config UI.
6. **Revert toggle** — `Photo.useOriginal` + `PhotoVariant` model.
7. **Updates tab** — `src/app/dashboard/updates/page.tsx`, sidebar link with pulsing unread dot via `localStorage` + `autoqc:updates-seen` event.
8. **Landing refresh** — `TwilightHero`, `SpotlightCard` (cursor radial gradient + 3D tilt + persistent `new-card-pulse` for NEW cards), workflow strip `Shoot → Your editor → AutoQC → Agent / MLS`.

---

## Open / backlog

### PENDING — waiting on Paul's word
- **Property lines on drone photos** (see section below). Paul asked for feasibility — needs a written proposal, not code.

### Known issues not yet fixed
- **False-positive horizon detector.** Reports 6–10° tilt on photos that aren't tilted. No rotation actually applied, but the UI shows the `horizonDev` number and confuses users. Needs detector accuracy work in the Lambda.
- **`autoqc.io` Resend domain verification** — bug-report emails send from a fallback domain. Add SPF/DKIM for `autoqc.io` and swap sender in Resend config.
- **Delete `AUTOQC_LOGIN_ACCESS_CODE`** from Vercel env — leftover from the emergency access-code gate. Real password auth replaced it; env var is dead weight.

### Stage 3 auth (not started)
- Password reset via SMTP (Resend) with signed token
- Rate limiting on `/api/auth/callback/credentials`

### Feature backlog
- **Evan's PR #3** (Admin Orders tab) — awaiting review
- **Bulk "twilight all exteriors"** button
- **Auto-draft PR on bug submission** (v2 of bug widget — let Claude propose a fix in a draft PR)

---

## Open: Property Lines on Drone Photos

**Short answer:** feasibility is high. Cost and UX are the real questions.

### Two technical paths

**Path A — GPS + parcel polygon projection (recommended)**
1. Read drone photo EXIF: GPS lat/lon, altitude AGL, camera pitch/yaw, focal length, image size
2. Query parcel GIS API (Regrid is the industry wholesale source — AcreValue itself has no public API) for the polygon at those coords. ~$0.01 per parcel lookup
3. Project the WGS84 polygon onto the image plane using camera extrinsics (standard photogrammetry math, homography)
4. Render as toggleable SVG overlay

Works for any photo with intact GPS EXIF taken roughly overhead (altitude > ~50m, pitch near nadir). DJI / Matic / most pro drones preserve EXIF. Some export pipelines strip it — that's the main failure mode to detect and message.

**Path B — Vision ML on fence / road / tree lines**
Less accurate. Only works when boundaries are visibly obvious. Useful as a refinement layer, not a primary source.

**Hybrid:** Path A as primary, Path B to nudge the polygon to snap to visible fence lines when confidence is high.

### Providers
- **Regrid** — all US counties, ~$0.01/lookup, reliable. Primary pick.
- **ParcelsPro / LANDGRID** — similar coverage, priced by volume.
- **AcreValue** — no public API. Referenced by users but not integratable directly.

### Proposed v1 scope
- Auto-detect drone photos (altitude > 50m OR explicit "Drone" tag on ingest)
- Show "Add property lines" CTA only on those
- $2–3 per photo add-on (similar pricing to Virtual Twilight at $1)
- Toggle overlay on/off in the final deliverable

### What I need from Paul before building
- Sample drone photos with EXIF intact (confirm Matic / DJI export pipeline preserves GPS)
- Price point confirmed ($2 or $3)
- Regrid account (or approval to set one up)

---

## Infra & access notes

- **Branch protection:** required approvals = 0, squash-only, PR still required, admin (RepositoryRole 5) permanently in bypass for automation.
- **Paul has no terminal.** Run git / npm / vercel ops yourself. Never ask him to run commands.
- **Dev server:** keep running in background during sessions.
- **Email/Resend:** `autoqc.io` not yet verified — emails may send from fallback domain.
- **Two-person collab:** shared `CLAUDE.md` at repo root is the cross-session handoff between Paul's and Evan's Claude instances. This `HANDOFF.md` is the session-to-session state log. Read both.

---

## Style rules (from Paul's memory)

- **No em dashes.** Ever. Period, comma, or restructure.
- **Step 1 of any cold-email campaign = `{{personalization}}` only.** No template copy on first touch.
- **30-day rule:** every campaign completes its full sequence in 30 days regardless of audience size.
- **Level 3 enrichment mandatory** on every campaign (Apollo + Serper + Claude opener).
- **Preview before UI changes.** Propose approach, get alignment, then build. Don't rewrite blind.
- **Recruiter UX is foolproof by default** (Staffify): one CTA per screen, plain-English badges, confirm destructive actions.
