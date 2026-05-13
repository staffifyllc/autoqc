import type { Metadata } from "next";
import Link from "next/link";

// Comparison page: AutoQC vs BoxBrownie. BoxBrownie is the classic
// human + AI hybrid service. Honest framing — they win on certain
// jobs (full virtual staging suite, floor plan redraw, hand-edited
// item removal). AutoQC wins on speed, price, and pre-delivery QC.

export const metadata: Metadata = {
  title: "AutoQC vs BoxBrownie for Real Estate Photo Editing",
  description:
    "AutoQC (fully automated, minutes) vs BoxBrownie (human + AI, 24-48h). Compare pricing, turnaround, QC, virtual staging, virtual twilight, distraction removal. When to pick which.",
  alternates: {
    canonical: "https://www.autoqc.io/compare/boxbrownie",
  },
  openGraph: {
    title: "AutoQC vs BoxBrownie for Real Estate Photo Editing",
    description:
      "Automated minutes vs human-assisted hours. Compare pricing, turnaround, QC, and feature set.",
    url: "https://www.autoqc.io/compare/boxbrownie",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.autoqc.io/" },
    {
      "@type": "ListItem",
      position: 2,
      name: "Compare",
      item: "https://www.autoqc.io/compare/boxbrownie",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "AutoQC vs BoxBrownie",
      item: "https://www.autoqc.io/compare/boxbrownie",
    },
  ],
};

interface Row {
  feature: string;
  autoqc: string;
  bb: string;
}

const rows: Row[] = [
  { feature: "Workflow", autoqc: "Fully automated", bb: "Human editor + AI assist" },
  { feature: "Turnaround", autoqc: "About 4 minutes per property", bb: "Typically 24-48 hours" },
  { feature: "Pricing model", autoqc: "Per property", bb: "Per image / per service" },
  { feature: "Typical price", autoqc: "$8-12 per property", bb: "$1.60-3.20 per photo (~$50-100 / property)" },
  { feature: "Pre-delivery QC checks", autoqc: "14 structured checks", bb: "Manual editor review" },
  { feature: "Vertical / horizon correction", autoqc: "Automatic, sub-degree", bb: "Manual" },
  { feature: "Privacy blur", autoqc: "Automatic, Premium tier", bb: "Manual request" },
  { feature: "Distraction removal", autoqc: "Automatic, Premium tier", bb: "Hand-edited" },
  { feature: "Virtual staging", autoqc: "$2 / room render", bb: "$32 / room human-staged" },
  { feature: "Virtual twilight (day-to-dusk)", autoqc: "$1 / photo", bb: "Per-photo human edit" },
  { feature: "Floor plan redraw", autoqc: "Not yet", bb: "Yes" },
  { feature: "Style consistency across shoot", autoqc: "Style Profile per agency", bb: "Editor-dependent" },
  { feature: "Direct Dropbox / AutoHDR pipeline", autoqc: "Yes", bb: "Email or portal upload" },
];

export default function ComparePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <nav
          aria-label="Breadcrumb"
          className="mb-8 text-[12px] font-mono uppercase tracking-wider text-muted-foreground"
        >
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <Link href="/compare/boxbrownie" className="hover:text-foreground transition-colors">
            Compare
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <span className="text-foreground">AutoQC vs BoxBrownie</span>
        </nav>

        <header className="mb-12">
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground mb-3">
            Side by side
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            AutoQC vs BoxBrownie<br />
            for real estate photo editing.
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            BoxBrownie is human-assisted. AutoQC is automated. Both serve real estate. The choice usually comes down to whether you need a human in the loop for a few hand-edited assets (BoxBrownie's lane) or a fast, repeatable QC pass on every property you ship (AutoQC's lane). Both can live in the same workflow.
          </p>
        </header>

        <section className="mb-12 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            The short answer
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Pick <strong className="text-foreground">BoxBrownie</strong> when you need a small number of hand-edited assets done by a human: a complicated virtual staging job, a floor-plan redraw, a tricky single-photo retouch. The 24-48 hour turnaround and per-photo price are the cost of human craft.
          </p>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Pick <strong className="text-foreground">AutoQC</strong> when you ship dozens of properties a month and need a fast, structured QC pass on every one of them before delivery. Verticals, color, exposure, sharpness, window blowout, privacy blur, distraction removal, MLS-aware room sorting, virtual staging, twilight, all running in minutes per property at a per-property price.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight mb-6">
            Feature by feature
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(var(--surface-2))] text-left">
                  <th className="p-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Feature
                  </th>
                  <th className="p-4 font-mono text-[11px] uppercase tracking-wider text-primary">
                    AutoQC
                  </th>
                  <th className="p-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    BoxBrownie
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-border hover:bg-[hsl(var(--surface-1))] transition-colors"
                  >
                    <td className="p-4 font-medium">{r.feature}</td>
                    <td className="p-4 text-foreground">{r.autoqc}</td>
                    <td className="p-4 text-muted-foreground">{r.bb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[12px] text-muted-foreground font-mono">
            BoxBrownie feature data summarized from public service pages and customer reviews. Per-photo pricing varies by service tier.
          </p>
        </section>

        <section className="mb-12 grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-6">
            <h3 className="text-lg font-semibold tracking-tight mb-3">
              When AutoQC wins
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              <li>You ship 10+ properties a month and want consistent output</li>
              <li>You want next-day delivery on every shoot</li>
              <li>Per-property pricing fits your model better than per-photo</li>
              <li>You want a QC pass on every photo, not just hand-picked ones</li>
              <li>You have an AutoHDR or Dropbox pipeline already running</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-[hsl(var(--surface-1))] p-6">
            <h3 className="text-lg font-semibold tracking-tight mb-3">
              When BoxBrownie wins
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              <li>You need a floor plan drawn from scratch</li>
              <li>You want a hand-edited virtual staging job, not an AI render</li>
              <li>One-off, high-touch edits where human judgment matters</li>
              <li>You are okay waiting 24-48 hours for the result</li>
              <li>You only do a handful of properties a month</li>
            </ul>
          </div>
        </section>

        <section className="mb-12 p-6 rounded-2xl border border-border bg-[hsl(var(--surface-1))]">
          <h3 className="text-lg font-semibold tracking-tight mb-3">
            Can you use both?
          </h3>
          <p className="text-sm md:text-[15px] text-muted-foreground leading-relaxed">
            Yes, and it's a common pattern. Run every property through AutoQC for fast structured QC and standard auto-fixes. Send the handful of shots per month that need a human retouch or a floor-plan redraw to BoxBrownie. AutoQC handles the volume, BoxBrownie handles the craftsmanship.
          </p>
        </section>

        <section className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-8 md:p-10">
          <h2 className="text-2xl font-semibold tracking-tight mb-3">
            See AutoQC against your own work.
          </h2>
          <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
            5 free credits at signup. Upload one real property. The math gets clearer when you watch it run on something you shot.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-xl accent-bg text-sm font-semibold text-background hover:opacity-90 transition"
            >
              Start free &rarr;
            </Link>
            <Link
              href="/demo"
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold hover:border-primary/40 transition"
            >
              Try the demo
            </Link>
            <Link
              href="/compare/imagen"
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold hover:border-primary/40 transition"
            >
              vs Imagen AI
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
