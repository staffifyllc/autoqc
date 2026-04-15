/**
 * Lightroom / Camera Raw XMP Sidecar Generator
 *
 * Converts AutoQC analysis data into XMP sidecars that Lightroom,
 * Adobe Camera Raw, Bridge, and Photoshop will auto-read when the
 * user imports the photo. All AutoQC recommendations appear as
 * pre-applied adjustments in Lightroom's Develop module.
 *
 * User workflow:
 * 1. Download photo.jpg + photo.xmp together
 * 2. Put both in a folder on their disk
 * 3. Open in Lightroom - adjustments are applied automatically
 * 4. Fine-tune sliders, export as usual
 */

interface AutoQCFullAnalysis {
  overall?: {
    tier?: string;
    score?: number;
    summary?: string;
  };
  categories?: Record<
    string,
    {
      score?: number;
      issues?: string[];
      detail?: string;
    }
  >;
  fix_actions?: string[];
}

interface XMPAdjustments {
  // Core tone
  exposure?: number;      // -5.00 to +5.00 EV
  contrast?: number;      // -100 to +100
  highlights?: number;    // -100 to +100
  shadows?: number;       // -100 to +100
  whites?: number;        // -100 to +100
  blacks?: number;        // -100 to +100

  // Presence
  clarity?: number;       // -100 to +100
  dehaze?: number;        // -100 to +100
  vibrance?: number;      // -100 to +100
  saturation?: number;    // -100 to +100

  // White balance
  temperature?: number;   // 2000-50000 or relative shift
  tint?: number;          // -150 to +150

  // HSL per color (optional granular)
  greenSat?: number;
  blueSat?: number;
  yellowSat?: number;
  orangeSat?: number;

  // Geometry
  rotate?: number;        // degrees (for straightening)
  upright?: "auto" | "level" | "vertical" | "full" | "off";

  // Lens corrections
  lensProfileEnable?: boolean;
  chromaticAberration?: boolean;

  // Sharpening
  sharpening?: number;    // 0-150

  // Crop / straighten (via Rotate angle)
  straightenDegrees?: number;
}

/**
 * Map AutoQC issues and Claude fix_actions to Lightroom adjustments.
 * These are CONSERVATIVE recommendations - Lightroom user has full
 * control to modify.
 */
function analysisToAdjustments(
  analysis: AutoQCFullAnalysis,
  verticalDev?: number | null,
  horizonDev?: number | null
): XMPAdjustments {
  const adj: XMPAdjustments = {
    lensProfileEnable: true,
    chromaticAberration: true,
    sharpening: 25, // Lightroom default for RE photos
  };

  // Straighten horizon / verticals - use whichever is more off
  const maxTilt = Math.max(
    Math.abs(verticalDev || 0),
    Math.abs(horizonDev || 0)
  );
  if (maxTilt > 0.5) {
    // Lightroom rotates the whole image by the horizon angle.
    // For mild tilts we suggest the straightening number.
    if (horizonDev && Math.abs(horizonDev) > 0.5) {
      adj.straightenDegrees = -horizonDev; // negate: if horizon tilts +, rotate back -
    }
  }

  // If verticals significantly off, recommend Upright
  if (verticalDev && Math.abs(verticalDev) > 1.5) {
    adj.upright = "level"; // Upright: Level attempts to straighten horizon
  }

  // Collect issues from all categories
  const allIssues: string[] = [];
  const cats = analysis.categories || {};
  for (const catData of Object.values(cats)) {
    if (catData?.issues) {
      allIssues.push(...catData.issues);
    }
  }

  // Map issues to adjustments (additive - multiple issues can compound)
  const addAdjust = (key: keyof XMPAdjustments, delta: number) => {
    const current = (adj[key] as number) || 0;
    (adj as any)[key] = current + delta;
  };

  for (const issue of allIssues) {
    switch (issue) {
      // Exposure / tone
      case "ceiling_highlights_flat":
      case "counter_highlight_flat":
        addAdjust("highlights", -15);
        break;
      case "minor_overexposure_upper_range":
        addAdjust("highlights", -20);
        addAdjust("whites", -10);
        break;
      case "highlight_clipping":
      case "window_blowout":
        addAdjust("highlights", -35);
        addAdjust("whites", -20);
        break;
      case "shadow_crush":
        addAdjust("shadows", 30);
        addAdjust("blacks", 10);
        break;
      case "shadow_density_high":
        addAdjust("shadows", 20);
        break;
      case "muddy_midtones":
        addAdjust("contrast", 10);
        addAdjust("clarity", 10);
        break;
      case "flat_hdr":
        addAdjust("contrast", 15);
        addAdjust("clarity", 15);
        break;
      case "low_microcontrast":
        addAdjust("clarity", 15);
        break;
      case "halo_artifacts":
        addAdjust("dehaze", -10);
        break;
      case "too_dark":
        addAdjust("exposure", 0.5);
        addAdjust("shadows", 20);
        break;
      case "too_bright":
        addAdjust("exposure", -0.4);
        addAdjust("highlights", -15);
        break;
      case "window_underexposed_relative":
        addAdjust("shadows", 15);
        break;

      // White balance
      case "wb_slightly_warm":
        addAdjust("temperature", -400);
        break;
      case "wb_too_warm":
        addAdjust("temperature", -900);
        break;
      case "wb_slightly_cool":
        addAdjust("temperature", 400);
        break;
      case "wb_too_cool":
        addAdjust("temperature", 900);
        break;
      case "green_cast":
        addAdjust("tint", 15);
        addAdjust("greenSat", -15);
        break;
      case "green_shadow_cast":
        addAdjust("tint", 8);
        break;
      case "magenta_cast":
        addAdjust("tint", -12);
        break;
      case "neutral_surfaces_not_neutral":
        addAdjust("temperature", -200);
        addAdjust("tint", 3);
        break;

      // Saturation / polish
      case "sky_oversaturated_minor":
        addAdjust("blueSat", -8);
        break;
      case "sky_oversaturated":
        addAdjust("blueSat", -15);
        break;
      case "greens_slightly_boosted":
        addAdjust("greenSat", -8);
        break;
      case "oversaturated":
        addAdjust("vibrance", -15);
        addAdjust("saturation", -5);
        break;
      case "undersaturated":
        addAdjust("vibrance", 10);
        break;

      // Sharpness / noise
      case "soft_focus":
        adj.sharpening = 50;
        addAdjust("clarity", 8);
        break;
      case "over_sharpened":
        adj.sharpening = 10;
        break;

      // Lens
      case "chromatic_aberration":
        adj.chromaticAberration = true;
        break;
      case "barrel_distortion":
      case "lens_distortion_barrel":
        adj.lensProfileEnable = true;
        break;
    }
  }

  // Clamp all numeric adjustments to Lightroom's valid ranges
  const clamp = (v: number | undefined, min: number, max: number) =>
    v === undefined ? undefined : Math.max(min, Math.min(max, v));

  adj.exposure = clamp(adj.exposure, -5, 5);
  adj.contrast = clamp(adj.contrast, -100, 100);
  adj.highlights = clamp(adj.highlights, -100, 100);
  adj.shadows = clamp(adj.shadows, -100, 100);
  adj.whites = clamp(adj.whites, -100, 100);
  adj.blacks = clamp(adj.blacks, -100, 100);
  adj.clarity = clamp(adj.clarity, -100, 100);
  adj.dehaze = clamp(adj.dehaze, -100, 100);
  adj.vibrance = clamp(adj.vibrance, -100, 100);
  adj.saturation = clamp(adj.saturation, -100, 100);
  adj.temperature = clamp(adj.temperature, -2000, 2000);
  adj.tint = clamp(adj.tint, -50, 50);
  adj.greenSat = clamp(adj.greenSat, -100, 100);
  adj.blueSat = clamp(adj.blueSat, -100, 100);
  adj.yellowSat = clamp(adj.yellowSat, -100, 100);
  adj.orangeSat = clamp(adj.orangeSat, -100, 100);

  return adj;
}

/**
 * Build an XMP sidecar document that Lightroom / Camera Raw will auto-read.
 */
export function buildXMP(
  analysis: AutoQCFullAnalysis,
  verticalDev?: number | null,
  horizonDev?: number | null,
  options?: {
    photoFileName?: string;
    qcScore?: number;
  }
): string {
  const adj = analysisToAdjustments(analysis, verticalDev, horizonDev);

  // XMP uses specific attribute names - match Lightroom's exactly
  const lines: string[] = [];

  const pushAttr = (key: string, value: string | number | boolean) => {
    if (typeof value === "boolean") {
      lines.push(`    crs:${key}="${value ? "True" : "False"}"`);
    } else {
      lines.push(`    crs:${key}="${value}"`);
    }
  };

  pushAttr("Version", "15.5");
  pushAttr("ProcessVersion", "15.4");
  pushAttr("HasSettings", true);

  // Exposure & tone (Camera Raw 2012 naming)
  if (adj.exposure !== undefined && adj.exposure !== 0)
    pushAttr("Exposure2012", adj.exposure.toFixed(2));
  if (adj.contrast !== undefined && adj.contrast !== 0)
    pushAttr("Contrast2012", Math.round(adj.contrast));
  if (adj.highlights !== undefined && adj.highlights !== 0)
    pushAttr("Highlights2012", Math.round(adj.highlights));
  if (adj.shadows !== undefined && adj.shadows !== 0)
    pushAttr("Shadows2012", Math.round(adj.shadows));
  if (adj.whites !== undefined && adj.whites !== 0)
    pushAttr("Whites2012", Math.round(adj.whites));
  if (adj.blacks !== undefined && adj.blacks !== 0)
    pushAttr("Blacks2012", Math.round(adj.blacks));

  // Presence
  if (adj.clarity !== undefined && adj.clarity !== 0)
    pushAttr("Clarity2012", Math.round(adj.clarity));
  if (adj.dehaze !== undefined && adj.dehaze !== 0)
    pushAttr("Dehaze", Math.round(adj.dehaze));
  if (adj.vibrance !== undefined && adj.vibrance !== 0)
    pushAttr("Vibrance", Math.round(adj.vibrance));
  if (adj.saturation !== undefined && adj.saturation !== 0)
    pushAttr("Saturation", Math.round(adj.saturation));

  // WB (relative shift - "As Shot" is preserved, just a delta)
  if (adj.temperature !== undefined && adj.temperature !== 0) {
    // Lightroom Temperature is absolute K, so we use IncrementalTemperature
    pushAttr("IncrementalTemperature", Math.round(adj.temperature));
  }
  if (adj.tint !== undefined && adj.tint !== 0) {
    pushAttr("IncrementalTint", Math.round(adj.tint));
  }

  // HSL - Saturation per color
  if (adj.greenSat !== undefined && adj.greenSat !== 0)
    pushAttr("SaturationAdjustmentGreen", Math.round(adj.greenSat));
  if (adj.blueSat !== undefined && adj.blueSat !== 0)
    pushAttr("SaturationAdjustmentBlue", Math.round(adj.blueSat));
  if (adj.yellowSat !== undefined && adj.yellowSat !== 0)
    pushAttr("SaturationAdjustmentYellow", Math.round(adj.yellowSat));
  if (adj.orangeSat !== undefined && adj.orangeSat !== 0)
    pushAttr("SaturationAdjustmentOrange", Math.round(adj.orangeSat));

  // Straighten / rotate
  if (adj.straightenDegrees !== undefined) {
    pushAttr("CropAngle", adj.straightenDegrees.toFixed(3));
  }
  if (adj.upright) {
    // Upright mode: 0=off, 1=auto, 2=level, 3=vertical, 4=full
    const uprightMap = { off: 0, auto: 1, level: 2, vertical: 3, full: 4 };
    pushAttr("PerspectiveUpright", uprightMap[adj.upright]);
  }

  // Lens corrections
  if (adj.lensProfileEnable) {
    pushAttr("LensProfileEnable", 1);
  }
  if (adj.chromaticAberration) {
    pushAttr("AutoLateralCA", 1);
  }

  // Sharpening
  if (adj.sharpening !== undefined) {
    pushAttr("Sharpness", Math.round(adj.sharpening));
  }

  const attrs = lines.join("\n");
  const summary = analysis.overall?.summary || "Adjustments from AutoQC";
  const score = options?.qcScore ? ` (QC ${Math.round(options.qcScore)})` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="AutoQC">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
${attrs}
    crs:WhiteBalance="As Shot"
    crs:AutoWhiteVersion="134348800"
    xmp:CreatorTool="AutoQC${score}">
   <dc:description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${summary.replace(/[<>&"']/g, "")}</rdf:li>
    </rdf:Alt>
   </dc:description>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>`;
}
