# PhotoQC Launch Checklist

Every step needed to go from code on disk to live paying customers.

## Phase 1: Get Your Accounts (1 hour)

You must do these yourself, they need your personal info / credit card.

### AWS Account
- [ ] Sign up at https://aws.amazon.com
- [ ] Add billing alerts at $10, $50, $100
- [ ] Create an IAM user with Admin access (not root user)
- [ ] Download access key + secret, save securely
- [ ] Request a limit increase for Lambda concurrent executions if needed

### Stripe Account
- [ ] Sign up at https://stripe.com
- [ ] Complete business verification (need EIN, bank account)
- [ ] Get API keys (publishable + secret), save
- [ ] Set up webhook endpoint (will be https://yourdomain.com/api/webhooks/stripe)
- [ ] Enable webhook events:
  - checkout.session.completed
  - payment_method.attached
  - invoice.payment_failed
- [ ] Credit packages are created dynamically via Stripe Checkout - no products needed in the dashboard
- [ ] Test mode first, then switch to live mode after launch

### Anthropic API
- [ ] Sign up at https://console.anthropic.com
- [ ] Add $50 credit to start
- [ ] Generate API key, save

### Domain
- [ ] Buy domain (suggestions: photoqc.com, photoqc.ai, photoqc.io)
- [ ] Recommended registrar: Cloudflare Domains ($8/yr) or Namecheap
- [ ] Note: if taken, try variations like getphotoqc, tryphotoqc, usephotoqc

### GitHub
- [ ] Create a private repository for the code
- [ ] Don't push yet (we'll do this together)

---

## Phase 2: Install Prerequisites (30 min)

Run these in Terminal on your Mac:

### Install Homebrew (if not installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Install required tools
```bash
brew install node python@3.12 awscli git
```

### Configure AWS CLI
```bash
aws configure
# Enter: Access Key ID, Secret Key, us-east-1, json
```

### Verify everything
```bash
node --version   # Should show v20 or v22
python3 --version  # Should show 3.12
aws sts get-caller-identity  # Should show your AWS account
```

---

## Phase 3: Deploy the Platform (1 hour)

### Navigate to the project
```bash
cd "/Users/paulchareth/Desktop/Claude Code/photoqc"
```

### Run the one-command launch
```bash
./scripts/launch.sh
```

This will:
1. Check prerequisites
2. Deploy AWS infrastructure (10-15 min)
3. Install npm packages (3 min)
4. Set up database
5. Deploy Lambda functions (5 min)
6. Build the app

### Add your API keys to .env.local
After launch.sh completes, edit `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=https://yourdomain.com
```

### Test locally
```bash
npm run dev
# Open http://localhost:3000
```

---

## Phase 4: Deploy to Production (1 hour)

### Push to GitHub
```bash
cd "/Users/paulchareth/Desktop/Claude Code/photoqc"
git init
git add .
git commit -m "Initial PhotoQC platform"
git remote add origin https://github.com/YOUR_USERNAME/photoqc.git
git push -u origin main
```

### Deploy frontend to AWS Amplify
1. Go to AWS Amplify Console
2. Click "New app" -> "Host web app"
3. Connect GitHub repo
4. Framework auto-detected (Next.js)
5. Add all environment variables from .env.local
6. Deploy (takes 5-10 min)
7. Copy the Amplify URL (like main.d123abc.amplifyapp.com)

### Point your domain
1. In Amplify, go to Domain Management
2. Add your custom domain
3. Follow DNS instructions (add CNAME records)
4. Wait 10-30 min for SSL to provision

### Set up Stripe webhook
1. Stripe Dashboard -> Webhooks -> Add endpoint
2. URL: https://yourdomain.com/api/webhooks/stripe
3. Events: customer.subscription.*, invoice.paid, invoice.payment_failed
4. Copy signing secret, add to Amplify env as STRIPE_WEBHOOK_SECRET

---

## Phase 5: Test With Real Photos (1-2 days)

Before launching to customers, test with your own photography business.

### Create a test agency
- [ ] Sign up at yourdomain.com with your own email
- [ ] Complete onboarding, create agency "TestAgency"
- [ ] Upload 10 reference photos from your best shoots
- [ ] Wait for style profile learning to complete
- [ ] Upload a full property shoot (25-30 photos)
- [ ] Verify QC runs and detects issues correctly
- [ ] Review the auto-fixes - are they actually better?
- [ ] Test pushing to your real Aryeo/HDPhotoHub account

### Issues to watch for
- [ ] Vertical correction working on real interior shots
- [ ] Color temperature detection accurate
- [ ] Claude Vision catching reflections/toilets/clutter
- [ ] Auto-fixed photos look natural, not over-processed
- [ ] Upload speed is acceptable
- [ ] Lambda doesn't timeout on large photos

---

## Phase 6: Launch (Ongoing)

### Week 1: Soft launch to 5 photographer friends
- [ ] DM 5 photographer friends/competitors
- [ ] Offer free lifetime access in exchange for:
  - [ ] Honest feedback
  - [ ] Testimonial (written + optional video)
  - [ ] Referrals

### Week 2: Facebook Groups
- [ ] Join 5 RE photography FB groups
- [ ] Spend 1 week being helpful (answer questions, share tips)
- [ ] Post a genuine founder story (template below)
- [ ] Engage with every comment within 2 hours

### Week 3-4: Cold Outreach
- [ ] Build list of 200 RE photography companies (10+ photographers)
- [ ] Send 20 outreach messages per day (manual, personalized)
- [ ] Track: opens, replies, demos booked, signups

### Week 5-8: Scale what works
- [ ] Double down on whichever channel is converting
- [ ] Add YouTube content (before/after demos)
- [ ] Write 3 SEO blog posts
- [ ] Launch affiliate program (20% recurring for referrals)

---

## Budget to Launch

| Item | One-Time | Monthly |
|------|----------|---------|
| Domain | $10 | - |
| AWS infrastructure | - | $30-50 |
| Anthropic API | - | $50 (initial credit) |
| Stripe | - | 2.9% + $0.30/txn |
| **Total to start** | **$10** | **~$100** |

Your break-even is just **10 properties/month** at $10 each.

---

## Revenue Targets

Under the credits model (blended $9/property average):

- Month 1: 5 paying agencies, ~$2,250/mo revenue (avg 50 properties each)
- Month 3: 25 paying agencies, ~$11,250/mo revenue
- Month 6: 100 paying agencies, ~$45,000/mo revenue
- Month 12: 400 paying agencies, ~$180,000/mo revenue

Credits model advantages:
- Agencies buy upfront = cash flow on day 1
- Volume packs drive bigger first purchases ($425 and $800 popular)
- Prepaid commitment increases retention
- 85% gross margin on credits ($9 avg revenue - $1.50 cost per property)
