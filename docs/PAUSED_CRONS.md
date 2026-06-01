# Paused Vercel crons

All Vercel crons were removed from `vercel.json` on **2026-05-31** when
the AutoQC product had $0 revenue and the `dropbox-autohdr` cron was
bleeding ~$60/day in S3 egress (May 27-30 spike, $294 total damage).

This file preserves the original cron definitions so a future
re-enable is a copy-paste away.

## Re-enable instructions

Add a `crons` array back into `vercel.json` with whichever entries you
want to bring back, e.g.:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-staffify-clients",
      "schedule": "17 * * * *"
    }
  ]
}
```

## Disabled cron definitions

| Path | Schedule | Why it was paused |
|---|---|---|
| `/api/cron/dropbox-autohdr` | `*/30 * * * *` | THE bleed source. Re-enable ONLY after `pushCompletedProperties` marks `dropboxPushedAt` per-photo (not per-property). Otherwise any mid-loop failure replays every photo on the next cycle. |
| `/api/cron/stuck-pending-recovery` | `0 14 * * *` | Daily safety net for stuck PENDING photos. Safe to re-enable any time. |
| `/api/cron/bug-triage` | `0 12 * * *` | Daily digest email of NEW bugs. Safe to re-enable any time. |
| `/api/cron/sync-staffify-clients` | `17 * * * *` | Hourly Staffify roster sync. Safe to re-enable any time. |

## What's still in place even with crons off

- All route files (`src/app/api/cron/*/route.ts`) remain untouched, so
  re-enabling is purely a `vercel.json` change.
- The Dropbox integration row in RDS is `isActive = false` (manually
  flipped on 2026-05-31). Even if the cron were re-enabled today, it
  would walk zero candidates because there are no active integrations.
  Re-flip the integration `isActive = true` AFTER fixing the
  per-photo idempotency, not before.
- The S3 bucket has a 30-day expiration lifecycle so even an unnoticed
  loop can't compound storage forever.
- Lambda log groups have 14-day retention.
