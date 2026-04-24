# Contributing to AutoQC

Paul is the sole operator. Direct push to `main` is enabled and every push auto-deploys to production (`autoqc.io`) within ~60 seconds. Treat every push as a live deploy.

## Day-to-day

```bash
cd photoqc
git checkout main
git pull origin main
# ...edit files...
npx tsc --noEmit                  # catch type errors before Vercel does
git add -A
git commit -m "Short description of the change"
git push origin main
```

Watch the Vercel build on anything non-trivial:

```bash
vercel ls --yes autoqc | head -6
```

## When to use a branch + PR anyway

Optional. Use a branch and preview deploy when:

- The change is big enough that you want to eyeball it on a Vercel preview URL before it hits production.
- You're touching billing routes, webhooks, or schema.
- You want to leave the work half-finished overnight without shipping it.

Preview URLs follow the pattern `autoqc-<branch>-staffifyllcs-projects.vercel.app`. Preview deploys hit the **production** backend (same RDS, S3, Lambda) — do not run destructive test actions against them expecting isolation.

## Production safety

- **Prisma schema** — `npx prisma db push` is live. Additive-only changes (new fields, new enums, new indexes) are safe; renames or drops need a migration plan.
- **Lambda deploys** — `./scripts/deploy-lambda.sh` replaces the running QC engine instantly.
- **Prod DB writes** — always dry-run any script that mass-writes to RDS before passing `--apply`.
- **Credit grants** — PROMO type only, never touch `totalCreditsPurchased`. See `src/app/api/onboarding/route.ts` for the correct pattern.
- **Stripe routes** — real money. Test in Stripe's dashboard before shipping changes.

## Secrets

- Never commit `.env.local`.
- New env vars: add a placeholder to `.env.example`, put the real value in Vercel via `vercel env add KEY production`.
