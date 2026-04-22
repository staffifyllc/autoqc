// Structured data for Google — helps rich results like pricing, logo,
// and the knowledge panel. Rendered as raw JSON-LD in a <script> tag,
// which is the pattern Google documents.

const SITE_URL = "https://www.autoqc.io";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AutoQC",
  url: SITE_URL,
  logo: `${SITE_URL}/og.jpg`,
  description:
    "AI-powered quality control and automated editing for real estate photography agencies. Catch what your editors miss before your agent does.",
  foundingDate: "2026",
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AutoQC",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Real Estate Photography",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "A twelve-point audit on every real estate property photo before it reaches the agent. Verticals, color, exposure, privacy blur, distraction removal. Automated in minutes.",
  offers: {
    "@type": "Offer",
    price: "8.00",
    priceCurrency: "USD",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "8.00",
      priceCurrency: "USD",
      unitText: "per property",
    },
  },
  featureList: [
    "Vertical straightening",
    "Horizon leveling",
    "White balance correction",
    "Color temperature tuning",
    "Exposure and highlight recovery",
    "HSL saturation tuning per color",
    "AI deblur for soft focus",
    "Composition and sharpness audit",
    "Privacy blur for personal photos",
    "Distraction removal (trash cans, hoses, cables, photographer reflections)",
    "Window blowout detection",
    "HDR artifact detection",
  ],
};

export function JsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationSchema),
        }}
      />
    </>
  );
}
