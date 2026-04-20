# AutoQC Setup Guide

This is the local development guide. If you're joining the project for the first time, this gets you from `git clone` to a running `localhost:3000` with the same stack production uses.

> **Already collaborating?** Read [CONTRIBUTING.md](./CONTRIBUTING.md) for the branch + Pull Request flow before writing any code.

## Production at a glance

- **Live URL:** https://www.autoqc.io
- **Hosting:** Vercel (project `staffifyllcs-projects/autoqc`). Any push to `main` auto-deploys.
- **Repo:** https://github.com/staffifyllc/autoqc
- **Backend:** AWS (RDS PostgreSQL, S3, SQS, Lambda)
- **AI:** Anthropic Claude (composition vision), Replicate (deblur, distraction removal)

---

## Prerequisites

1. **Node.js 18+**
   ```bash
   brew install node
   node --version   # should be v18 or higher
   ```

2. **Git + a GitHub account with access to this repo**
   Ask Paul to add you as a collaborator at https://github.com/staffifyllc/autoqc/settings/access

3. **A Vercel account invited to the team**
   Ask Paul to invite you to `staffifyllcs-projects` so you can see deployments and preview URLs.

4. **`.env.local` secrets** — Paul will share these privately. Never commit them.

5. **Optional:** AWS credentials if you'll be touching Lambda or S3 directly. Not needed for frontend work.

---

## First-time setup

### 1. Clone and install

```bash
git clone https://github.com/staffifyllc/autoqc.git
cd autoqc
npm install
```

### 2. Set up environment

```bash
cp .env.example .env.local
# Edit .env.local with the real values Paul sent you
```

See `.env.example` for the full list of required variables. Minimum to run locally:
- `DATABASE_URL` — points to the prod RDS (read-only use preferred) or a local Postgres
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` — `http://localhost:3000` for local dev
- `AWS_*` — S3 + SQS credentials
- `ANTHROPIC_API_KEY` — Claude vision
- `STRIPE_*` — billing

### 3. Generate the Prisma client

```bash
npx prisma generate
```

If you're using a local Postgres instead of the prod RDS:

```bash
npx prisma db push
```

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

---

## How production is set up (reference, not setup steps)

You don't need to set any of this up — it's already live. This section documents what exists so you don't get confused reading the code.

### Vercel (frontend)

- Project: `staffifyllcs-projects/autoqc`, linked to this repo.
- Every push to `main` triggers a production deploy to autoqc.io.
- Every branch push triggers a preview deploy at `autoqc-<branch>-staffifyllcs-projects.vercel.app`.
- Env vars live in the Vercel dashboard, not in any file here.

### AWS

- **S3 bucket** `photoqc-uploads` — raw uploads, fixed outputs, reference photos
- **SQS FIFO queue** `photoqc-jobs.fifo` — QC job queue
- **Lambda `photoqc-engine`** (Python 3.12, 1024 MB, 300s timeout) — consumes SQS, runs QC, writes fixed outputs to S3
- **Lambda `photoqc-profile-learner`** — analyzes style profile reference photos
- **RDS PostgreSQL** `photoqc-db` in us-east-1 — all app data

### Lambda deploy (only do this when you've changed `lambda/`)

```bash
cd lambda/qc_engine
pip install -r requirements.txt -t .
zip -r function.zip .
aws lambda update-function-code --function-name photoqc-engine --zip-file fileb://function.zip
```

> **Heads up:** Only one person should push Lambda updates at a time. Coordinate with your teammate before deploying.

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` for dev) |
| `NEXTAUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (optional) |
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `AWS_S3_BUCKET` | S3 bucket name |
| `AWS_SQS_QUEUE_URL` | SQS queue URL |
| `ANTHROPIC_API_KEY` | Claude Vision composition checks |
| `REPLICATE_API_TOKEN` | AI deblur + distraction removal (optional) |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing |
| `STRIPE_PRICE_ID_BASE` / `_MEDIUM` / `_LARGE` | Pricing tier IDs |
| `ARYEO_API_KEY` / `HDPHOTOHUB_API_KEY` / `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` | Platform integrations |

---

## Project structure

```
photoqc/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── page.tsx            # Landing page
│   │   ├── login/              # Auth
│   │   ├── onboarding/         # New user setup
│   │   ├── demo/               # Try without account
│   │   ├── pricing/            # Pricing page
│   │   ├── dashboard/          # Main app
│   │   │   ├── properties/     # Property management + QC review
│   │   │   ├── profiles/       # Style profiles + clients
│   │   │   ├── integrations/   # Platform connections
│   │   │   ├── billing/        # Usage and payment
│   │   │   └── admin/          # Internal admin dashboard
│   │   └── api/                # API routes
│   │       ├── auth/           # NextAuth
│   │       ├── upload/         # S3 presigned URLs
│   │       ├── properties/     # CRUD + QC triggers
│   │       ├── profiles/       # Style + client profiles
│   │       ├── integrations/   # Connect + push
│   │       ├── onboarding/     # Onboarding flow + welcome-bonus credits
│   │       └── webhooks/       # Stripe webhooks
│   ├── components/             # React components
│   │   ├── upload/             # Photo uploader
│   │   └── review/             # QC review UI
│   └── lib/                    # Shared libraries
│       ├── auth.ts             # NextAuth config
│       ├── db.ts               # Prisma client
│       ├── s3.ts               # S3 operations
│       ├── sqs.ts              # Job queue
│       ├── stripe.ts           # Billing
│       ├── credits.ts          # Credit model
│       └── integrations/       # Platform push clients
│           ├── aryeo.ts
│           ├── hdphotohub.ts
│           └── dropbox.ts
├── lambda/
│   └── qc_engine/              # Python QC Lambda
│       ├── handler.py          # Main handler
│       ├── profile_learning.py # Style profile analyzer
│       ├── checks/             # 12 QC check modules
│       │   ├── verticals.py    # Wall/door frame alignment
│       │   ├── horizon.py      # Horizon level
│       │   ├── color.py        # Color temp + white balance
│       │   ├── exposure.py     # Over/under exposure
│       │   ├── sharpness.py    # Focus quality
│       │   ├── composition.py  # AI (Claude Vision) semantic check + room type
│       │   ├── consistency.py  # Set-wide style drift
│       │   ├── lens_distortion.py
│       │   ├── chromatic_aberration.py
│       │   ├── window_blowout.py
│       │   ├── hdr_artifacts.py
│       │   └── sky.py          # Sky quality + replacement artifacts
│       └── fixes/              # Auto-correction modules
│           ├── vertical_fix.py
│           ├── color_fix.py
│           └── horizon_fix.py
├── prisma/
│   └── schema.prisma           # Database schema
└── scripts/
    ├── grant-credits.sh        # Grant test credits to a user's agency
    ├── deploy-lambda.sh        # Lambda deploy helper
    └── ...
```

---

## QC Checks (12 total)

| # | Check | Method | Auto-Fix? |
|---|-------|--------|-----------|
| 1 | Vertical alignment | OpenCV Hough lines | Yes (up to 5 deg) |
| 2 | Horizon level | OpenCV Hough lines | Yes (up to 3 deg) |
| 3 | Color temperature | B/R channel ratio + cast detection | Yes |
| 4 | Exposure | Histogram analysis | No |
| 5 | Window blowout | Bright region detection | No |
| 6 | Sharpness | Laplacian variance + quadrant check | No |
| 7 | Chromatic aberration | LAB color fringe detection | No |
| 8 | HDR artifacts | Halo + flat tonemap detection | No |
| 9 | Sky quality | HSV sky analysis + edge artifacts | No |
| 10 | Lens distortion | Edge line curvature | No |
| 11 | Composition (AI) | Claude Vision semantic analysis + room type | No |
| 12 | Set consistency | Cross-photo metric comparison | No |

---

## Common commands

```bash
# Dev server
npm run dev

# Build (what Vercel runs)
npm run build

# TypeScript check (no build)
./node_modules/.bin/next build   # full build, surfaces type errors
npx tsc --noEmit                  # type-check only

# Prisma
npx prisma generate               # regenerate client after schema change
npx prisma db push                # push schema to your DATABASE_URL
npx prisma studio                 # visual DB browser at localhost:5555

# Lambda deploy (coordinate first)
./scripts/deploy-lambda.sh

# Grant test credits
./scripts/grant-credits.sh <email> <credit_count>
```

---

## Getting help

- Check `NIGHT_NOTES.md` and `NIGHT_CHANGES.md` for recent session summaries.
- See `CONTRIBUTING.md` for the branch + PR workflow.
- If you're stuck, open a draft PR early and ask for feedback.
