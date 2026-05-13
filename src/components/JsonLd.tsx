// Site-wide structured data. Three blocks ship on every page:
//
//   1. Organization — feeds the knowledge panel and links our social
//      profiles so Google can connect the brand to off-domain mentions.
//   2. WebSite with SearchAction — makes the site eligible for the
//      sitelinks searchbox in the SERP.
//   3. SoftwareApplication with multi-tier AggregateOffer — surfaces
//      the price range in rich results without lying about the lowest
//      number.
//
// Page-specific schemas (FAQPage, BreadcrumbList, comparison Article)
// are rendered by the individual route components, not here.

const SITE_URL = "https://www.autoqc.io";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "AutoQC",
  alternateName: "AutoQC by Staffify",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/og.jpg`,
    width: 1200,
    height: 630,
  },
  description:
    "AI-powered quality control and automated editing for real estate photography agencies. Catch what your editors miss before your agent does.",
  foundingDate: "2026",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "hello@autoqc.io",
    availableLanguage: ["English"],
  },
  sameAs: [
    "https://www.linkedin.com/company/autoqc",
    "https://twitter.com/autoqcio",
    "https://github.com/staffifyllc/autoqc",
  ],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: "AutoQC",
  publisher: { "@id": `${SITE_URL}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
  inLanguage: "en-US",
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#software`,
  name: "AutoQC",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Real Estate Photography",
  operatingSystem: "Web",
  url: SITE_URL,
  publisher: { "@id": `${SITE_URL}/#organization` },
  description:
    "AutoQC runs a 14-point quality audit on every real estate property photo, applies safe auto-fixes for verticals, horizon, color, exposure, and sharpness, then optionally adds privacy blur, distraction removal, virtual staging, and virtual twilight. Designed to catch what editors miss before the photos reach the listing agent.",
  // AggregateOffer with low + high lets Google show the actual price
  // range in rich results rather than only the floor price. lowPrice
  // is the Scale-pack credit rate, highPrice is the PAYG Premium rate.
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "8.00",
    highPrice: "20.00",
    offerCount: "2",
    offers: [
      {
        "@type": "Offer",
        name: "Standard tier",
        price: "8.00",
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "8.00",
          priceCurrency: "USD",
          unitText: "per property (Scale credit pack)",
        },
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Premium tier",
        price: "20.00",
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "20.00",
          priceCurrency: "USD",
          unitText: "per property (pay-as-you-go)",
        },
        availability: "https://schema.org/InStock",
      },
    ],
  },
  featureList: [
    "14-point quality audit per photo",
    "Vertical straightening up to 7 degrees",
    "Horizon leveling up to 5 degrees",
    "White balance and color cast correction",
    "Exposure and highlight recovery",
    "HSL saturation tuning per color channel",
    "AI deblur for soft focus",
    "Composition and sharpness audit by Claude Vision",
    "Privacy blur for personal photos and diplomas (Premium)",
    "Distraction removal (Premium)",
    "Window blowout detection",
    "HDR artifact detection",
    "MLS room-type classification and sort",
    "Virtual staging at $2 per room",
    "Virtual twilight at $1 per exterior",
    "Lightroom XMP export with sidecars",
    "Dropbox and AutoHDR automatic pipeline",
    "Team and VA seats included",
  ],
};

export function JsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
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
