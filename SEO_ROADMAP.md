# AutoQC SEO roadmap

**Last touched:** 2026-05-05. Foundation pass shipped tonight.

SEO is layered: technical hygiene compounds slowly, content compounds faster, backlinks compound hardest. This doc maps where AutoQC sits on each layer and what comes next.

---

## What shipped tonight (foundation pass)

**FAQ page at `/faq`** — 20 intent-aligned questions, each answer under ~60 words for snippet eligibility. Rendered with full `FAQPage` JSON-LD plus a `BreadcrumbList`. This is the single biggest lever for both Google featured snippets and AI-search engines (ChatGPT, Perplexity, Claude search) because both reward Q&A structured data.

**Comparison pages** at `/compare/imagen` and `/compare/boxbrownie` — honest side-by-side feature matrices, "when AutoQC wins / when X wins" sections, CTAs. Each carries `BreadcrumbList` JSON-LD. Targets the high-intent "AutoQC vs X" and "X alternative" queries.

**Hardened `src/components/JsonLd.tsx`** — three site-wide blocks:
- `Organization` with logo `ImageObject`, `sameAs` social profiles (placeholders pending real handles), `contactPoint` linking `hello@autoqc.io`
- `WebSite` with `SearchAction` (qualifies us for the SERP sitelinks searchbox)
- `SoftwareApplication` with proper `AggregateOffer` showing $8–$20 range across both tiers instead of just the floor price

**`src/app/sitemap.ts`** — added the FAQ and both comparison pages with sensible priorities.

---

## Tier 1 — Next 7 days (content sprint, no engineering)

These are high-intent search queries with low competition. Each post = a dedicated page in `src/app/blog/[slug]/page.tsx` with full Article schema. Aim for 800-1500 words, real screenshots, internal links to /pricing and /demo.

1. **"How to fix tilted verticals in real estate photos"** — high-volume, low-competition keyword. Tutorial post that ends with "or let AutoQC do it automatically."
2. **"MLS photo requirements by state, 2026"** — directory-style post, very high search volume from photographers who need this answer recurringly. Becomes a recurring linkable reference.
3. **"What every real estate photographer should QC before delivery"** — checklist post. The most natural "AutoQC could just do this for you" CTA in our entire content surface.
4. **"Window pull techniques for real estate exteriors"** — competitive but high-intent. Covers flambient, HDR brackets, AI window recovery.
5. **"How AI photo editing tools handle perspective correction"** — comparative explainer. Naturally links to /compare/imagen and /compare/boxbrownie.
6. **"AutoHDR + AutoQC: a hands-off real estate edit pipeline"** — workflow post. Links to /dashboard/dropbox-automation.
7. **"How to onboard a virtual assistant for real estate photo editing"** — adjacent topic, photographers search for VA hiring guides. Drives top-of-funnel.

**Mechanic.** Create `src/app/blog/page.tsx` (index) + `src/app/blog/[slug]/page.tsx` (article). Articles live in MDX or as TSX components. Each one gets:
- `<Article>` JSON-LD with author, datePublished, image
- BreadcrumbList
- Canonical URL
- Internal links to ≥2 other AutoQC pages
- One CTA at end

---

## Tier 2 — Next 30 days (programmatic + on-page tuning)

**More comparison pages.** Same template as Imagen + BoxBrownie, applied to the rest of the named-competitor queries:
- `/compare/aftershoot` — culling + editing AI, real estate photographers compare
- `/compare/photoup` — outsourced editing service
- `/compare/virtualstagingai` — pure virtual staging
- `/compare/evoto` — batch enhance
- `/compare/topaz` — sharpening / denoise (we'd position as complementary)

**Use-case landing pages.**
- `/for-photographers` — solo photographer angle
- `/for-brokerages` — broker-controlled accounts
- `/for-mls-delivery` — MLS-spec workflow
- `/for-property-managers` — secondary vertical
- `/for-airbnb-hosts` — emerging vertical

**On-page tuning.**
- Tighten every `<h1>` and `meta description` to match its primary keyword without keyword-stuffing
- Add an `<h2>` keyword in every comparison page
- Make sure each blog post has at least three internal links to non-blog pages
- Audit the landing page for the top three keywords ("real estate photo QC", "AI real estate photo editing", "MLS photo audit") and make sure each appears in the page H1, an H2, and the meta description

**Image SEO.**
- Add descriptive `alt` text to every demo image (currently many are empty)
- Use `next/image` with explicit width/height to win Core Web Vitals
- Compress og.jpg to under 200KB

**Core Web Vitals.**
- Audit the landing page LCP — currently the WebGL-less manual slider should be cheap, but framer-motion hydration may be hurting INP
- Verify mobile dashboard layout (just shipped) doesn't break CLS

---

## Tier 3 — Next 90 days (authority building, off-page)

**This is the moat.** Technical SEO and content put you in the running. Backlinks and brand mentions determine where you actually rank.

1. **Guest posts.** Pitch BiggerPockets, ASMP, PPA, Real Estate Photographers International newsletter. Topic angle: "Why real estate photo QC is the missing step in your delivery workflow." Soft brand mention, hard educational content.
2. **HARO / Help A Reporter.** Sign Paul up and pitch as a real estate photography expert on every relevant query. Each successful placement = a backlink from a tier-1 publication.
3. **Forum presence.** r/RealEstatePhotography, Real Estate Photographers Facebook groups. Answer questions substantively. No drive-by spam. Sign-off as founder of AutoQC with a single non-pushy link.
4. **Comparison pages on competitor brands.** Submit `/compare/imagen` etc. for indexing via Google Search Console. Update them quarterly so they stay fresh in the index.
5. **Customer case studies.** Once Realtour Pilot, Bolor Photo, and HelioBook have measurable results, write up named case studies with their permission. Other photographers searching "[customer name] photographer reviews" land on our site.
6. **Tool directories.** Submit to G2, Capterra, Product Hunt, AlternativeTo, RE photography tool roundups. Each one is a tier-2 backlink.
7. **YouTube short tutorials.** Two-minute screen recordings: "How AutoQC fixes a tilted living room in 4 minutes." Description links to /demo. Video search is its own ranking surface.
8. **Newsletter strategy.** Capture email at /demo. Send a monthly "real estate photography QC tips" newsletter with one teach-something + one feature update. Builds direct-traffic moat that doesn't depend on Google.

---

## Tier 4 — Quarterly maintenance

- Re-audit Search Console for new keyword opportunities (longtail queries we already rank for, slightly)
- Update comparison pages with current competitor pricing
- Refresh the FAQ with new questions surfaced from real customer support
- Update SoftwareApplication schema if pricing changes
- Submit a fresh sitemap after every batch of new content
- Watch Core Web Vitals in Search Console, fix regressions
- Update `OVERNIGHT_FINDINGS_2026-05-04.md` style retrospectives if conversion patterns shift

---

## Honest expectations

This is not a "rank #1 by morning" plan. Realistic timeline:
- **Week 1-2:** new pages get indexed, start showing up for low-competition long-tail queries
- **Month 1:** featured snippets start appearing for some FAQ questions
- **Month 3:** /compare/ pages start ranking for "AutoQC vs X" queries (low competition because the brand is new)
- **Month 6:** with consistent content + a few real backlinks, AutoQC ranks page 1 for "real estate photo QC" specifically
- **Month 12:** with case studies + named guest posts + customer growth, ranking starts to consolidate

The single biggest accelerant: **paying customers.** Domain authority grows faster when real photographers link to AutoQC organically. Every paying customer who tweets, blogs, or mentions us is worth more than ten technical SEO patches.

---

## Open items that need your input

- **Social profiles.** The Organization schema includes `sameAs` placeholders for LinkedIn, Twitter, and GitHub. The GitHub URL is correct (`staffifyllc/autoqc`). The Twitter and LinkedIn handles are guesses (`autoqcio` / `autoqc`). If those don't exist yet, either claim them or remove the placeholder URLs to avoid breaking the schema validator.
- **Newsletter list.** Tier 3 #8 needs a real newsletter capture. If you want me to wire up a `/newsletter` page with Resend audience signup, say the word.
- **Blog stack.** Tier 1 expects 7 posts in a week. We can: (a) write them ourselves (founder voice, slow), (b) use Claude to draft + Paul to edit (fast, requires your time), or (c) hire a part-time real estate photographer content writer. Recommend (b) for the first month, (c) once we have revenue.
