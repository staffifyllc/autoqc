# Contributing to AutoQC

This repo is shared between Paul and his Flylisted business partner. To avoid stepping on each other's work, we follow a simple branch + Pull Request flow. Nothing goes to production (autoqc.io) without a PR and a review.

## The rule

**Never push directly to `main`.** `main` is the live production branch — any push to it auto-deploys to autoqc.io. All changes go through a feature branch and a Pull Request.

## The flow

### 1. Start fresh

Before you start new work, always pull the latest main:

```bash
cd photoqc
git checkout main
git pull origin main
```

### 2. Create a branch for your task

Use a descriptive name. Prefix with your initials if you want:

```bash
git checkout -b cull-v1
# or
git checkout -b pc/fix-slider-skew
```

### 3. Make your changes

Edit, test, commit as you go. Keep commits focused — one logical change per commit.

```bash
git add src/app/something/page.tsx
git commit -m "Fix the slider aspect ratio on small screens"
```

### 4. Push your branch

```bash
git push -u origin cull-v1
```

`-u` sets the upstream so future pushes are just `git push`.

### 5. Open a Pull Request

Go to https://github.com/staffifyllc/autoqc and you'll see a banner to open a PR from your branch to `main`. Click it, write a brief description of what changed and why, and submit.

**Vercel will automatically deploy a preview URL for your branch** — e.g., `autoqc-cull-v1-staffifyllcs-projects.vercel.app`. Use this to eyeball your changes running live with real infrastructure before asking for a review.

### 6. Wait for review

The other person reviews, comments, or approves. If they request changes, just keep pushing commits to the same branch — the PR updates automatically.

### 7. Merge

Once approved, click "Squash and merge" on GitHub. That collapses all your commits into one clean commit on `main`. Vercel auto-deploys to autoqc.io within about a minute.

### 8. Clean up

```bash
git checkout main
git pull origin main
git branch -d cull-v1
```

## What happens when two people edit the same file

Git will tell you at merge time. If you try to merge your branch to main but someone merged a conflicting change first, GitHub will show "This branch has conflicts that must be resolved."

Fix it locally:

```bash
git checkout cull-v1
git pull origin main
# Git will mark conflicts in the affected files with <<<<<<< and >>>>>>>
# Open those files, decide which changes to keep, delete the markers, save
git add .
git commit -m "Resolve merge conflict with main"
git push
```

No silent overwrites are possible. Git will always stop you before losing work.

## Shared-resource rules

**Production database (RDS)** — if you need to run a script that writes to prod DB, tell the other person in Slack/text first so you're not both mass-writing at once. Reads are fine anytime.

**Lambda deploys** — only one person should push `lambda/qc_engine/` changes at a time. Coordinate via message.

**Manual credit grants** — use a PROMO transaction type, only increment `creditBalance`, never `totalCreditsPurchased`. See `src/app/api/onboarding/route.ts` for the correct pattern.

**Secrets** — never commit anything to `.env.local`. If you need a new env var, add the placeholder to `.env.example` and share the real value out-of-band.

## When in doubt

- Small bug fix? Branch, PR, merge, move on.
- Big feature (cull engine, edit pipeline)? Same flow, but keep the other person in the loop so you don't both prototype the same thing.
- Touching schema (`prisma/schema.prisma`)? Flag it in the PR description. Schema changes need a migration and coordination.
- Not sure which branch to start from? Always `main`.
