// AutoQC changelog. Add a new entry at the TOP when you ship anything
// customer-visible. Older entries stay where they are.
//
// Version scheme: semver-ish.
//   MAJOR = rare, only for breaking workflow changes
//   MINOR = every new customer-facing feature or bundle
//   PATCH = bug fixes, copy tweaks, tiny polish
//
// The Updates sidebar unread badge compares the latest version here to
// a timestamp the client stores in localStorage, so every new MINOR or
// MAJOR bump automatically lights up for every user who has not checked
// the page yet.

export type UpdateCategory = "Feature" | "Fix" | "Polish" | "Security";

export type UpdateEntry = {
  version: string;       // e.g. "1.4.0"
  date: string;          // ISO YYYY-MM-DD
  title: string;         // short headline for the whole bundle
  tagline?: string;      // one-line summary under the title
  changes: Array<{
    category: UpdateCategory;
    title: string;
    body: string;
    href?: string;       // optional link to the relevant dashboard page
  }>;
};

export const updates: UpdateEntry[] = [
  {
    version: "1.5.0",
    date: "2026-04-23",
    title: "Self-serve signup",
    tagline: "Create your own AutoQC account. Pay as you go, save on volume.",
    changes: [
      {
        category: "Feature",
        title: "Create an account in 30 seconds",
        body: "Brand-new visitors can sign up directly at autoqc.io/signup. Email, password (10+ characters), and you are in. First run lands in Onboarding where we set up your agency. Credits are pay as you go with volume discounts up to 20% on bulk packs.",
        href: "/signup",
      },
      {
        category: "Feature",
        title: "Sign-in page now links to signup",
        body: "The login page no longer dead-ends with 'ask your agency admin.' If you do not have an account, the link right under the form walks you into signup.",
      },
    ],
  },
  {
    version: "1.4.1",
    date: "2026-04-23",
    title: "Landing page: speed and scale, up front",
    tagline: "New visitors see exactly what AutoQC does and how fast it does it.",
    changes: [
      {
        category: "Polish",
        title: "Stats bar in the hero",
        body: "14 QC checks, 45 photos in under two minutes, from $8 per property, zero subscriptions. The capability and the price now register in the first two seconds of the page.",
      },
      {
        category: "Polish",
        title: "What it does, counted",
        body: "The features headline now leads with the numbers: 14 checks, 9 auto-fixes, 3 AI rescues. Readers skim, numbers anchor.",
      },
      {
        category: "Polish",
        title: "How it works, timed",
        body: "Each of the four steps now shows exactly how long it takes. Upload ~30s. Scan ~90s. Fix is zero manual labor. Deliver is one click. No more vague 'fast'.",
      },
      {
        category: "Fix",
        title: "Outdated check count",
        body: "The Why section was still calling it a twelve-point audit. Updated to the current fourteen.",
      },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-04-22",
    title: "Homepage refresh + Updates tab",
    tagline: "Virtual Twilight on the front page and this very changelog.",
    changes: [
      {
        category: "Feature",
        title: "Updates tab",
        body: "This page. Every new feature, fix, and polish shipped lands here with a version number and a date, so you can see at a glance what changed between your sessions.",
        href: "/dashboard/updates",
      },
      {
        category: "Polish",
        title: "Homepage rebuild",
        body: "New Virtual Twilight hero section with animated dusk gradient. Clearer positioning up top so visitors understand AutoQC plugs in after your editor, not in place of one. Feature cards now pulse when they are new and light up as your cursor moves across them.",
      },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-04-22",
    title: "Virtual Twilight",
    tagline: "Daytime exteriors transformed into dusk. Preview free, keep for $1.",
    changes: [
      {
        category: "Feature",
        title: "Virtual Twilight on any exterior photo",
        body: "Click Preview Twilight on an exterior and get a photorealistic dusk render in about 10 seconds. Architecture and landscaping are preserved exactly, warm interior lights glow through windows, ambient dusk lighting on all surfaces. Keep the version you like for 1 credit ($1). Included in all downloads and platform pushes once purchased.",
      },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-04-22",
    title: "Photo workflow polish",
    tagline: "Sort, revert, and a cleaner pipeline.",
    changes: [
      {
        category: "Feature",
        title: "Auto-sort photos by room type",
        body: "Every photo is already tagged with its room type during QC. Flip auto-sort on in Configure → Photo Order and AutoQC groups photos in your agency's preferred sequence everywhere: QC grid, bulk download ZIP, and platform pushes. Drag-to-reorder the room sequence.",
        href: "/dashboard/configure/sort-order",
      },
      {
        category: "Feature",
        title: "One-click revert to original",
        body: "When the auto-fix went too far, the photo detail modal now has a Revert to original button. Per photo, instant, non-destructive. Export and MLS push use the original bytes until you flip it back.",
      },
      {
        category: "Fix",
        title: "No more fake cyan skies on overcast exteriors",
        body: "The auto-editor was globally boosting saturation on some exterior shots, turning subtle overcast blue into aggressive cyan. That boost is now blocked at the executor level and the prompt was tightened so Claude never recommends it. MLS ethics matter.",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-04-22",
    title: "Passwords and Bug Reports",
    tagline: "Real auth, real feedback loop.",
    changes: [
      {
        category: "Security",
        title: "Per-user email + password",
        body: "Login now requires a password. Your temporary password was sent via email. Change it in Account → Password on first sign-in. Existing email-only login removed.",
        href: "/dashboard/account",
      },
      {
        category: "Feature",
        title: "Report a bug button",
        body: "A floating Report a bug button now lives on every dashboard page. File a report with title, description, severity, and optional screenshot. Critical reports email us instantly. You get an email when the fix ships, so you can see what your feedback moved.",
        href: "/dashboard/account/bugs",
      },
    ],
  },
];
