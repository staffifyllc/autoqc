import type { Metadata } from "next";
import Link from "next/link";

// Comparison page: AutoQC vs Imagen AI for real estate photography.
// Honest framing — Imagen is great for what it was built for
// (wedding/portrait catalog-trained editing). It is just not a
// pre-delivery QC tool for real estate, which is the lane AutoQC owns.

export const metadata: Metadata = {
  title: "AutoQC vs Imagen AI for Real Estate Photography",
  description:
    "Side-by-side comparison of AutoQC and Imagen AI for real estate photographers. Pre-delivery QC, MLS-aware checks, virtual staging, privacy blur, per-property pricing. When to pick which.",
  alternates: {
    canonical: "https://www.autoqc.io/compare/imagen",
  },
  openGraph: {
    title: "AutoQC vs Imagen AI for Real Estate Photography",
    description:
      "Pre-delivery QC vs catalog-trained AI editing. Side-by-side comparison for real estate photographers.",
    url: "https://www.autoqc.io/compare/imagen",
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
      item: "https://www.autoqc.io/compare/imagen",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "AutoQC vs Imagen",
      item: "https://www.autoqc.io/compare/imagen",
    },
  ],
};

interface Row {
  feature: string;
  autoqc: string;
  imagen: string;
}

const rows: Row[] = [
  { feature: "Built for", autoqc: "Real estate photography", imagen: "Wedding, portrait, event" },
  { feature: "Pre-delivery QC checks", autoqc: "14 structured checks", imagen: "Not a QC tool" },
  { feature: "Pricing model", autoqc: "Per property, no subscription", imagen: "Per image, prepaid credits" },
  { feature: "Typical price", autoqc: "From $8 / property", imagen: "Around $0.20-0.30 / image" },
  { feature: "Style training", autoqc: "3 reference photos", imagen: "Full Lightroom catalog" },
  { feature: "MLS room-type classification", autoqc: "Yes", imagen: "No" },
  { feature: "Vertical / horizon correction", autoqc: "Sub-degree, up to 7° / 5°", imagen: "Lightroom auto-upright" },
  { feature: "Privacy blur (family photos, diplomas)", autoqc: "Yes, Premium tier", imagen: "No" },
  { feature: "Distraction removal", autoqc: "Yes, Premium tier", imagen: "No" },
  { feature: "Virtual staging", autoqc: "Yes, $2 / room", imagen: "No" },
  { feature: "Virtual twilight", autoqc: "Yes, $1 / photo", imagen: "No" },
  { feature: "Window blowout detection", autoqc: "Yes", imagen: "No" },
  { feature: "Lightroom XMP export", autoqc: "Yes", imagen: "Native plugin" },
  { feature: "Dropbox / AutoHDR pipeline", autoqc: "Yes", imagen: "No" },
  { feature: "Team / VA access", autoqc: "Unlimited seats", imagen: "Limited" },
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
          <Link href="/compare/imagen" className="hover:text-foreground transition-colors">
            Compare
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <span className="text-foreground">AutoQC vs Imagen</span>
        </nav>

        <header className="mb-12">
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground mb-3">
            Side by side
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            AutoQC vs Imagen AI<br />
            for real estate photography.
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Both use AI. They solve different problems. Imagen learns a personal editing style from your Lightroom catalog and applies it across wedding or portrait work. AutoQC catches what gets missed before a real estate shoot reaches the agent. If you only have time to read one paragraph, this is it.
          </p>
        </header>

        <section className="mb-12 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            The short answer
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Pick <strong className="text-foreground">Imagen</strong> if you shoot weddings or portraits and want a personal AI profile trained on years of your Lightroom edits, applied automatically to new shoots.
          </p>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Pick <strong className="text-foreground">AutoQC</strong> if you shoot real estate and want a 14-point quality audit on every photo before it lands in your agent's inbox: tilted verticals, blown windows, missed privacy blurs, distraction removal, MLS-aware room-type sorting, virtual staging, twilight conversion. Imagen is a stylist. AutoQC is a checkpoint.
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
                    Imagen AI
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
                    <td className="p-4 text-muted-foreground">{r.imagen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[12px] text-muted-foreground font-mono">
            Imagen feature data summarized from public documentation and customer reviews. Pricing directional, not live-scraped.
          </p>
        </section>

        <section className="mb-12 grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-6">
            <h3 className="text-lg font-semibold tracking-tight mb-3">
              When AutoQC wins
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              <li>Real estate is your primary or only vertical</li>
              <li>You deliver to MLS and care about compliance</li>
              <li>You need privacy blur, distraction removal, or virtual staging</li>
              <li>You want per-property pricing instead of per-image</li>
              <li>You want pre-delivery QC, not just stylistic polish</li>
              <li>You have VAs or editors and want them on a single console</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-[hsl(var(--surface-1))] p-6">
            <h3 className="text-lg font-semibold tracking-tight mb-3">
              When Imagen wins
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              <li>You shoot weddings, portraits, or events</li>
              <li>You already have a deep Lightroom catalog to train on</li>
              <li>You want a personal style profile applied per-image</li>
              <li>You prefer a Lightroom plugin workflow over a web dashboard</li>
              <li>Your output target is client galleries, not MLS</li>
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-8 md:p-10">
          <h2 className="text-2xl font-semibold tracking-tight mb-3">
            Run one real shoot through AutoQC.
          </h2>
          <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
            5 free credits at signup. No card. Upload one property, see what comes back. The math is faster than the comparison table.
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
              href="/faq"
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold hover:border-primary/40 transition"
            >
              Read the FAQ
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
