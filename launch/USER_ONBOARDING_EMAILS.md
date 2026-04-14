# User Onboarding Email Sequence (Credits Model)

Emails sent automatically after someone signs up. Goal: get them to purchase credits and process their first property.

**Important:** Under the new billing model, NO processing happens without payment. These emails all drive toward the first credit purchase.

## Email 1: Welcome (sent immediately)

**Subject:** Welcome to PhotoQC

```
Hey {{first_name}},

Welcome to PhotoQC. Here's how to get started:

1. Buy your first credit pack (2 min)
   Credits run $8 to $10 per property depending on package size. Smaller packs are $10 per credit, larger packs drop to $8. Credits never expire.
   [Buy credits]

2. Upload 20 reference photos to create your Style Profile (2 min)
   This teaches PhotoQC your editing standard. QC runs against YOUR look, not a generic one.
   [Upload reference photos]

3. Upload your next property shoot (5 min)
   Drag and drop, click Run QC. Done.
   [Upload a property]

No subscriptions, no monthly commitments. Pay for what you use.

If you get stuck, just reply to this email.

Paul
```

## Email 2: Explain the Credits System (Day 1 if no purchase)

**Subject:** why credits are cheaper than pay-as-you-go

```
{{first_name}},

Quick note on how PhotoQC billing works:

Option 1 - Credits (cheaper):
Buy credits upfront. Rates range from $8 to $10 per property depending on pack size.
- 10 pack: $100 ($10/credit)
- 25 pack: $225 ($9/credit, save 10%)
- 50 pack: $425 ($8.50/credit, save 15%)
- 100 pack: $800 ($8/credit, save 20%)

Option 2 - Pay As You Go:
Add a card, we charge $12 per property at processing time. Higher rate but no upfront commitment.

Most of our users go with credits because the savings add up fast. At 50 properties per month, credits save you $175 vs PAYG.

[Buy credits]

Paul
```

## Email 3: Style Profile Nudge (Day 2 if profile not created)

**Subject:** better QC results with one upload

```
{{first_name}},

Noticed you haven't uploaded reference photos for a style profile yet.

Without a profile, PhotoQC uses generic industry thresholds. If your style is specifically bright and airy, warm and moody, or magazine editorial, you want QC checking against YOUR baseline.

Takes 2 minutes. Upload 20 approved photos from past shoots.

[Upload reference photos]

Paul
```

## Email 4: First Purchase Close (Day 4 if no credits purchased)

**Subject:** small ask {{first_name}}

```
Hey {{first_name}},

You signed up for PhotoQC but haven't grabbed any credits yet. Want to test the waters?

Smallest pack is $100 for 10 credits. Process 10 properties with it. If you don't save at least 10 hours in the process, I'll give you a full refund, no questions asked.

That's 10 credits to test out 12 QC checks per property, auto-fix verticals and color, and push approved photos to Aryeo or HDPhotoHub automatically.

[Buy starter pack]

Paul
```

## Email 5: Post-First-Purchase (sent after credits purchased)

**Subject:** credits added, ready to go

```
{{first_name}},

{{credit_count}} credits just added to your account. You're all set.

Quick tips to get the most out of PhotoQC:

1. Create a Style Profile first (2 min)
   [link]

2. Upload your next real property shoot
   [link]

3. Review the QC report
   Look for false positives, reply to this email with screenshots if anything seems off. I'll tune the detection for you.

PhotoQC gets better the more you use it. After 10 properties, your Style Profile becomes very accurate.

Paul
```

## Email 6: Post-First-Property (sent after first QC completes)

**Subject:** your first QC report

```
{{first_name}},

Your first property just finished processing. Summary:

- Photos: {{photo_count}}
- Passed: {{pass_count}}
- Auto-fixed: {{fix_count}}
- Flagged for review: {{flag_count}}
- Average QC score: {{avg_score}}/100
- Credits remaining: {{credits_left}}

[View full report]

Paul
```

## Email 7: Credits Running Low (when balance hits 3)

**Subject:** 3 credits left

```
Hey {{first_name}},

You're down to 3 credits. Reload before you need them so processing doesn't get blocked mid-shoot.

Quick reminder of the rates:
- 10 pack: $100
- 25 pack: $225 (save 10%)
- 50 pack: $425 (save 15%)
- 100 pack: $800 (save 20%)

[Reload credits]

Or if you prefer pay-as-you-go, add a card for $12/property processing.

Paul
```

## Email 8: Credits Depleted (balance hits 0)

**Subject:** out of credits - action required

```
{{first_name}},

You just used your last credit. Processing is paused until you top up.

Two options:

1. Buy more credits (recommended, cheaper)
   [Buy credits]

2. Add a pay-as-you-go card at $12/property
   [Add card]

Either way, processing resumes the moment payment is set up.

Paul
```

## Email 9: Check-in at 30 Days (for active users)

**Subject:** how's PhotoQC working for you?

```
Hey {{first_name}},

You've been using PhotoQC for a month. {{property_count}} properties processed, {{fix_count}} auto-fixes applied, {{total_spent}} spent.

Just checking in. What's working? What's broken? What should we add?

Reply to this email, I read every one.

Paul

P.S. If PhotoQC is saving you time, the best thing you can do for me is tell another photographer. I'll add 5 bonus credits to your account for every referral that signs up.
```

## Email 10: Winback (no activity 30 days)

**Subject:** PhotoQC update

```
{{first_name}},

Noticed you haven't run a shoot through PhotoQC in a while. Was something not working?

You still have {{credits_remaining}} credits on your account. They never expire.

A few things have improved recently:
- [list 2-3 recent improvements]

If you want to try again: [link to dashboard]

If it wasn't a fit, reply with the reason so I can make it better.

Paul
```

## Email 11: Referral Ask (for power users with 25+ properties)

**Subject:** quick ask {{first_name}}

```
Hey {{first_name}},

You've processed 25+ properties on PhotoQC and you keep coming back, so I'll assume it's working.

Quick ask: know any other RE photographers who'd benefit?

If you refer someone who purchases credits, you both get 5 bonus credits (worth $40-50).

Your referral link: [link]

Or introduce us over email, I'll take it from there.

Paul
```

---

## Triggering Logic

| Email | Trigger |
|-------|---------|
| 1. Welcome | User signup |
| 2. Credits explanation | +24h, no purchase |
| 3. Style Profile nudge | +48h, no profile |
| 4. First purchase close | +96h, no credits |
| 5. Post-purchase | Credits fulfilled via webhook |
| 6. Post-first property | First QC completes |
| 7. Low credits warning | Balance hits 3 |
| 8. Out of credits | Balance hits 0 |
| 9. 30-day check-in | 30 days after signup |
| 10. Winback | 30 days of inactivity |
| 11. Referral ask | 25+ properties processed |

## Tech Stack

- Resend, Postmark, or SendGrid for transactional
- Trigger from Stripe webhooks + app events
- All from paul@photoqc.com (not noreply)
- Dynamic variables pulled from database at send time
