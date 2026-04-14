# PhotoQC Setup Guide

## Prerequisites

1. **Node.js** (v18+) - Install via Homebrew:
   ```bash
   brew install node
   ```

2. **AWS Account** with:
   - S3 bucket created
   - SQS queue created
   - Lambda functions deployed
   - RDS PostgreSQL database

3. **Stripe Account** for billing

4. **Anthropic API Key** for Claude Vision QC checks

---

## Quick Start

### 1. Install dependencies
```bash
cd photoqc
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Edit .env with your actual values
```

### 3. Set up database
```bash
# Push schema to your PostgreSQL database
npx prisma db push

# Generate Prisma client
npx prisma generate
```

### 4. Run locally
```bash
npm run dev
# Open http://localhost:3000
```

---

## AWS Setup

### S3 Bucket
```bash
aws s3 mb s3://photoqc-uploads --region us-east-1
```

CORS config for the bucket (needed for direct browser uploads):
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### SQS Queue
```bash
aws sqs create-queue --queue-name photoqc-jobs.fifo --attributes FifoQueue=true,ContentBasedDeduplication=true
```

### RDS PostgreSQL
- Create a db.t3.micro instance
- Database name: photoqc
- Save the connection string for DATABASE_URL

### Lambda Functions
Two Lambda functions needed:

1. **photoqc-engine** - Main QC processor
   - Runtime: Python 3.12
   - Memory: 1024 MB
   - Timeout: 300 seconds
   - Trigger: SQS queue
   - Code: `lambda/qc_engine/`

2. **photoqc-profile-learner** - Style profile learning
   - Runtime: Python 3.12
   - Memory: 512 MB
   - Timeout: 300 seconds
   - Code: `lambda/qc_engine/profile_learning.py`

Deploy Lambda:
```bash
cd lambda/qc_engine
pip install -r requirements.txt -t .
zip -r function.zip .
aws lambda update-function-code --function-name photoqc-engine --zip-file fileb://function.zip
```

### Frontend Deployment (AWS Amplify)
```bash
# Connect your git repo to Amplify
# Build command: npm run build
# Output directory: .next
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |
| NEXTAUTH_URL | Your app URL (http://localhost:3000 for dev) |
| NEXTAUTH_SECRET | Random secret (generate with: openssl rand -base64 32) |
| AWS_REGION | AWS region (us-east-1) |
| AWS_ACCESS_KEY_ID | AWS credentials |
| AWS_SECRET_ACCESS_KEY | AWS credentials |
| AWS_S3_BUCKET | S3 bucket name |
| AWS_SQS_QUEUE_URL | SQS queue URL |
| ANTHROPIC_API_KEY | For Claude Vision composition checks |
| STRIPE_SECRET_KEY | Stripe secret key |
| STRIPE_PUBLISHABLE_KEY | Stripe publishable key |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret |

---

## Project Structure

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
│   │   │   └── billing/        # Usage and payment
│   │   └── api/                # API routes
│   │       ├── auth/           # NextAuth
│   │       ├── upload/         # S3 presigned URLs
│   │       ├── properties/     # CRUD + QC triggers
│   │       ├── profiles/       # Style + client profiles
│   │       ├── integrations/   # Connect + push
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
│       │   ├── composition.py  # AI (Claude Vision) semantic check
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
└── prisma/
    └── schema.prisma           # Database schema
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
| 11 | Composition (AI) | Claude Vision semantic analysis | No |
| 12 | Set consistency | Cross-photo metric comparison | No |
