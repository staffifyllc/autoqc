import type { Metadata } from "next";
import Link from "next/link";

// Server component. Renders the visible FAQ + a FAQPage JSON-LD block
// in the same payload. Both Google's featured snippets and AI search
// engines (ChatGPT, Perplexity) reward this pattern. We keep the
// answers tight (under ~60 words each) so they extract cleanly into
// snippet boxes.

export const metadata: Metadata = {
  title: "FAQ — AutoQC Real Estate Photo QC | Pricing, Workflow, Formats",
  description:
    "Answers to the most common questions about AutoQC. Pricing per property, supported file formats, how the 14-point QC works, virtual staging, virtual twilight, Lightroom export, MLS compliance, and team access.",
  alternates: {
    canonical: "https://www.autoqc.io/faq",
  },
  openGraph: {
    title: "AutoQC FAQ — Pricing, Workflow, Formats",
    description:
      "Real answers about AutoQC's pricing, file formats, QC engine, virtual staging, Lightroom export, and MLS compliance.",
    url: "https://www.autoqc.io/faq",
  },
};

interface FAQ {
  q: string;
  a: string;
}

// Question copy is intent-aligned to actual search queries. Answers
// stay declarative, no marketing fluff, so snippet extractors lift
// them cleanly. Keep each answer under ~60 words for snippet
// eligibility.
const faqs: FAQ[] = [
  {
    q: "What is AutoQC?",
    a: "AutoQC is an AI quality-control and auto-editing platform for real estate photography agencies. It runs a 14-point audit on every photo (verticals, horizon, color, sharpness, window blowout, distractions, privacy) and applies safe auto-fixes before delivery to your agent or MLS.",
  },
  {
    q: "How much does AutoQC cost?",
    a: "Standard tier starts at $8 per property when you buy the 100-credit Scale pack ($800), $10 per property on the 10-credit Starter pack, or $12 pay-as-you-go. Premium tier (adds privacy blur, AI deblur, distraction removal) runs $16-$20 per property. No subscription. Virtual Staging is $2 per room. Virtual Twilight is $1 per exterior.",
  },
  {
    q: "What file formats does AutoQC support?",
    a: "JPEG, PNG, TIFF, and WebP, up to 50 MB per file. HEIC and RAW are not supported yet. To upload from an iPhone, set the camera to Most Compatible mode (Settings > Camera > Formats), or export through Photos as JPEG. RAW shooters should export their finished JPEGs from Lightroom or Capture One before upload.",
  },
  {
    q: "How long does AutoQC take per property?",
    a: "About 4 minutes for a 30-photo standard shoot. The QC engine runs in parallel on AWS Lambda. Virtual Staging renders take about 15 seconds per room. Virtual Twilight conversions are about 10 seconds per exterior.",
  },
  {
    q: "Does AutoQC export to Lightroom?",
    a: "Yes. AutoQC exports a Lightroom-ready bundle including XMP sidecars so your existing catalog imports cleanly. Use the Download menu on the property review page and choose Lightroom format.",
  },
  {
    q: "Can my virtual assistant use AutoQC?",
    a: "Yes. The Team tab in Settings lets you invite VAs and editors with their own sign-in. Each person gets a seat tied to your agency, with their own audit log. VAs cannot see your billing details unless you grant the role explicitly.",
  },
  {
    q: "Is AutoQC MLS-compliant?",
    a: "Yes for the auto-fix pipeline. Vertical correction, horizon leveling, color and exposure adjustments, privacy blur, and distraction removal are all within standard MLS guidelines. Sky replacement is intentionally not included because most MLS boards prohibit it without disclosure. Virtual Staging is generated separately and clearly labeled.",
  },
  {
    q: "Does AutoQC do virtual staging?",
    a: "Yes. $2 per room render, with multi-angle anchor mode so the same furniture sits in the same position across different camera angles of the same room. Six styles available, photoreal output in about 15 seconds. Preview is free, you only pay when you keep the render.",
  },
  {
    q: "Does AutoQC do virtual twilight?",
    a: "Yes. $1 per exterior photo. Converts daytime exteriors to photoreal dusk in about 10 seconds with warm interior glow through the windows and ambient dusk light on every surface. Architecture stays unchanged.",
  },
  {
    q: "Does AutoQC integrate with Dropbox or AutoHDR?",
    a: "Yes. Point AutoQC at your AutoHDR or general Dropbox folder once. Every batch automatically runs through the 14-point QC, gets auto-fixed, and the corrected files overwrite the originals in place. Setup takes about 10 minutes. Aryeo, HDPhotoHub, Spiro, and Tonomo integrations are also available.",
  },
  {
    q: "How does AutoQC fix tilted verticals?",
    a: "Two paths: deviations under 2 degrees use a simple rotation correction. Deviations between 2 and 7 degrees use a perspective warp via OpenCV with edge-shift kept under 7% of frame height. Beyond 7 degrees the photo is flagged for reshoot instead of warped past the believability threshold.",
  },
  {
    q: "Can AutoQC remove distractions from photos?",
    a: "Yes, on the Premium tier. Trash cans, garden hoses, cables, photographer reflections, and other configurable categories are detected by Claude Vision and inpainted using Replicate's grounded-SAM plus LaMa. Distraction categories are opt-in per agency and per client.",
  },
  {
    q: "Does AutoQC blur personal photos for privacy?",
    a: "Yes, on the Premium tier. Framed family photos, child portraits, diplomas with names, religious portraits, and personal documents are detected by Claude Vision and blurred automatically. Generic artwork, landscape prints, and decorative posters without identifiable people are left untouched.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Every new agency gets 5 free credits at signup, enough to run a property end-to-end. No card required. Add a card when you are ready to keep going.",
  },
  {
    q: "How is AutoQC different from Imagen AI or Aftershoot?",
    a: "Imagen and Aftershoot are catalog-trained AI editors built mainly for wedding and portrait photographers. AutoQC is purpose-built for real estate: it runs structured QC checks tied to MLS standards (verticals, room-type classification, privacy compliance) and ships pre-delivery, so problems get caught before the agent sees them. Compare side-by-side: /compare/imagen.",
  },
  {
    q: "How is AutoQC different from BoxBrownie or PhotoUp?",
    a: "BoxBrownie and PhotoUp are human-based editing services with AI assist. They take 24-48 hours and run $1.60-$3.20 per photo. AutoQC is fully automated, completes in minutes, and is priced per property instead of per photo. Compare side-by-side: /compare/boxbrownie.",
  },
  {
    q: "Does AutoQC support team accounts and roles?",
    a: "Yes. Invite an unlimited number of team members at no extra cost. Each member gets a personal sign-in tied to the agency, with their own activity log. Billing and integration settings are restricted to the agency owner by default.",
  },
  {
    q: "What if AutoQC misses a defect?",
    a: "Use the Report a bug widget on any property page. Reports go straight to the founder. We respond within one business day and re-process the property at no charge if the QC engine missed something it should have caught.",
  },
  {
    q: "Where does AutoQC store my photos?",
    a: "AWS S3 in US-East-1, encrypted at rest. Originals and fixed outputs both live in your agency's bucket prefix and are deletable on request. We do not train any AI models on your photos. Full details are in the privacy policy.",
  },
  {
    q: "What is Raptor 2.0?",
    a: "Raptor 2.0 is the May 2026 auto-edit core update. Sub-degree geometry correction (verticals up to 7 degrees, horizon up to 5 degrees), defect-gated tonal pulls so the engine only adjusts highlights, shadows, exposure, temperature, and tint when there is a specific named defect, and hard clamps on every adjustment to prevent washed-out output.",
  },
];

function escapeForJsonLd(s: string): string {
  // FAQPage answers can contain "/" which doesn't need escaping but
  // JSON.stringify handles all the real edge cases for us.
  return s;
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: escapeForJsonLd(f.a),
    },
  })),
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://www.autoqc.io/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "FAQ",
      item: "https://www.autoqc.io/faq",
    },
  ],
};

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <nav
          aria-label="Breadcrumb"
          className="mb-8 text-[12px] font-mono uppercase tracking-wider text-muted-foreground"
        >
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <span className="text-foreground">FAQ</span>
        </nav>

        <header className="mb-12">
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground mb-3">
            Frequently asked
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            Questions, answered straight.
          </h1>
          <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Pricing, supported formats, the QC engine, virtual staging, Lightroom export, MLS compliance, team access. Twenty answers, no marketing fluff.
          </p>
        </header>

        <div className="space-y-2">
          {faqs.map((f, i) => (
            <details
              key={i}
              className="group rounded-lg border border-border bg-[hsl(var(--surface-1))] open:bg-[hsl(var(--surface-2))] transition-colors"
            >
              <summary className="cursor-pointer list-none p-5 flex items-start justify-between gap-4 hover:bg-[hsl(var(--surface-2))] transition-colors">
                <h2 className="text-[15px] md:text-base font-semibold tracking-tight pr-4">
                  {f.q}
                </h2>
                <span
                  aria-hidden="true"
                  className="mt-1 font-mono text-[14px] text-muted-foreground group-open:rotate-45 transition-transform shrink-0"
                >
                  +
                </span>
              </summary>
              <div className="px-5 pb-5">
                <p className="text-sm md:text-[15px] leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              </div>
            </details>
          ))}
        </div>

        <div className="mt-16 p-6 rounded-2xl border border-primary/30 bg-primary/[0.04]">
          <h2 className="text-lg font-semibold tracking-tight">
            Still have questions?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            The Report a bug widget on any dashboard page goes straight to the founder. Or compare AutoQC head to head with the alternative you are weighing:
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-[13px] font-mono">
            <Link
              href="/compare/imagen"
              className="px-3 py-1.5 rounded-md border border-border bg-[hsl(var(--surface-1))] hover:border-primary/40 hover:bg-primary/[0.04] transition-colors"
            >
              vs Imagen AI
            </Link>
            <Link
              href="/compare/boxbrownie"
              className="px-3 py-1.5 rounded-md border border-border bg-[hsl(var(--surface-1))] hover:border-primary/40 hover:bg-primary/[0.04] transition-colors"
            >
              vs BoxBrownie
            </Link>
            <Link
              href="/pricing"
              className="px-3 py-1.5 rounded-md border border-border bg-[hsl(var(--surface-1))] hover:border-primary/40 hover:bg-primary/[0.04] transition-colors"
            >
              See pricing
            </Link>
            <Link
              href="/demo"
              className="px-3 py-1.5 rounded-md border border-border bg-[hsl(var(--surface-1))] hover:border-primary/40 hover:bg-primary/[0.04] transition-colors"
            >
              Try the demo
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
