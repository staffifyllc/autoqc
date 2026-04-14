#!/bin/bash

# PhotoQC - One-Command Launch Script
# Runs the full deployment: infrastructure + lambda + database + frontend

set -e

echo "
██████╗ ██╗  ██╗ ██████╗ ████████╗ ██████╗  ██████╗  ██████╗
██╔══██╗██║  ██║██╔═══██╗╚══██╔══╝██╔═══██╗██╔═══██╗██╔════╝
██████╔╝███████║██║   ██║   ██║   ██║   ██║██║   ██║██║
██╔═══╝ ██╔══██║██║   ██║   ██║   ██║   ██║██║▄▄ ██║██║
██║     ██║  ██║╚██████╔╝   ██║   ╚██████╔╝╚██████╔╝╚██████╗
╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝  ╚══▀▀═╝  ╚═════╝

Automated Real Estate Photo QC Platform
"

echo "This script will:"
echo "  1. Check prerequisites (Node, AWS CLI, Python)"
echo "  2. Deploy AWS infrastructure (S3, SQS, RDS, Lambda)"
echo "  3. Install npm dependencies"
echo "  4. Run database migrations"
echo "  5. Package and deploy Lambda functions"
echo "  6. Build the Next.js app"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Step 1: Prerequisites
echo ""
echo "[1/6] Checking prerequisites..."

MISSING=0

if ! command -v node &> /dev/null; then
    echo "  [X] Node.js not installed. Run: brew install node"
    MISSING=1
else
    echo "  [OK] Node.js $(node --version)"
fi

if ! command -v aws &> /dev/null; then
    echo "  [X] AWS CLI not installed. Run: brew install awscli"
    MISSING=1
else
    echo "  [OK] AWS CLI installed"
fi

if ! command -v python3 &> /dev/null; then
    echo "  [X] Python 3 not installed. Run: brew install python@3.12"
    MISSING=1
else
    echo "  [OK] Python $(python3 --version)"
fi

if ! aws sts get-caller-identity &> /dev/null; then
    echo "  [X] AWS credentials not configured. Run: aws configure"
    MISSING=1
else
    echo "  [OK] AWS credentials configured"
fi

if [ $MISSING -eq 1 ]; then
    echo ""
    echo "Fix the issues above and re-run this script."
    exit 1
fi

# Step 2: Deploy infrastructure
echo ""
echo "[2/6] Deploying AWS infrastructure (this takes 10-15 min)..."
./scripts/deploy-infrastructure.sh

# Step 3: Install dependencies
echo ""
echo "[3/6] Installing npm dependencies..."
npm install

# Step 4: Database migrations
echo ""
echo "[4/6] Running database migrations..."
npx prisma generate
npx prisma db push

# Step 5: Deploy Lambda
echo ""
echo "[5/6] Deploying Lambda functions..."
./scripts/deploy-lambda.sh

# Step 6: Build
echo ""
echo "[6/6] Building Next.js app..."
npm run build

echo ""
echo "=================================="
echo "LAUNCH SUCCESSFUL"
echo "=================================="
echo ""
echo "Next steps to go live:"
echo ""
echo "1. Start the dev server: npm run dev"
echo "   Open http://localhost:3000"
echo ""
echo "2. Deploy to production:"
echo "   - Push code to GitHub"
echo "   - Connect repo to AWS Amplify"
echo "   - Set env vars in Amplify console"
echo "   - Amplify auto-deploys on git push"
echo ""
echo "3. Set up domain:"
echo "   - Buy domain (Route53 or Namecheap)"
echo "   - Point to Amplify app"
echo "   - SSL auto-provisioned"
echo ""
echo "4. Connect Stripe:"
echo "   - Create Stripe account"
echo "   - Add keys to .env.local and Amplify env vars"
echo "   - Create usage-based pricing product"
echo ""
