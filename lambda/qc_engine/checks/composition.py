"""
Real Estate Photography QC - Comprehensive Claude Vision Analysis

Based on industry standards (NAR, MLS guidance, professional RE photography):
"believable > dramatic, accurate > flashy, consistent > cool, true-to-space > hyper-processed"

Evaluates 9 dimensions:
1. Geometry / vertical alignment
2. Exposure / tonal balance
3. White balance / color accuracy
4. Window treatment realism
5. Lens distortion / optical defects
6. Sharpness / noise / artifacts
7. Composition / room readability
8. Listing-set consistency (per-photo contribution)
9. Ethics / misrepresentation risk

Returns structured data: category scores, detected issues, fix actions, ethics flag, confidence.
"""

import base64
import json
import os

import anthropic


SYSTEM_PROMPT = """You are an expert real estate photography QC auditor. You evaluate images against industry standards used by MLS boards, the National Association of REALTORS®, and professional real estate photography companies.

Your judgment is guided by these principles:
- "True picture" over dramatic edits (NAR ethics guidance)
- Believable over flashy
- Accurate over flattering
- Consistent over individually striking
- A buyer should understand the space quickly without feeling tricked

A great real estate image is: accurate, bright, spacious, straight, clean, natural, and believable. It shows the property truthfully while still being polished.

You must NOT reward these common generic-image-model preferences:
- extra contrast
- super-saturated blue skies
- extreme clarity/sharpening
- over-warm interiors
- giant-looking rooms from extreme wide angle
- glossy fake window pulls
- HDR fantasy looks

You MUST evaluate across 9 categories and return structured output with category scores (0-100), detected issues, specific fix actions, an ethics flag, and confidence.

Return ONLY valid JSON, no markdown fences, no explanation."""


USER_PROMPT = """Evaluate this real estate photograph across all 9 categories. Return JSON with this exact schema:

{
  "overall": {
    "pass_fail": "pass" | "minor" | "major" | "reject",
    "score": 0-100,
    "summary": "one sentence describing the photo's status"
  },
  "categories": {
    "geometry": {
      "score": 0-100,
      "issues": ["verticals_converging", "horizon_tilt", "lens_distortion_barrel", "transform_overcorrected", "edge_stretching"],
      "detail": "specific description if score < 80"
    },
    "exposure": {
      "score": 0-100,
      "issues": ["window_blowout", "highlight_clipping", "shadow_crush", "muddy_midtones", "flat_hdr", "halo_artifacts", "too_dark", "too_bright"],
      "detail": "specific description if score < 80"
    },
    "white_balance": {
      "score": 0-100,
      "issues": ["wb_too_warm", "wb_too_cool", "green_cast", "magenta_cast", "mixed_lighting_unresolved", "neutral_surfaces_not_neutral"],
      "detail": "what surfaces should be neutral but aren't"
    },
    "window_realism": {
      "score": 0-100,
      "issues": ["window_not_recovered", "window_mask_halo", "window_view_fake", "window_too_dark", "window_too_saturated", "inconsistent_window_style"],
      "detail": "specific if applicable"
    },
    "lens_optics": {
      "score": 0-100,
      "issues": ["chromatic_aberration", "vignetting_excessive", "barrel_distortion", "corner_stretching"],
      "detail": "specific if applicable"
    },
    "sharpness_noise": {
      "score": 0-100,
      "issues": ["soft_focus", "motion_blur", "over_sharpened", "noise_excessive", "noise_reduction_smearing"],
      "detail": "specific if applicable"
    },
    "composition": {
      "score": 0-100,
      "issues": ["composition_confusing", "feature_not_emphasized", "too_much_ceiling", "too_much_floor", "awkward_crop", "ultrawide_distortion", "visible_photographer", "clutter", "toilet_lid_up"],
      "detail": "what's wrong or what was cropped awkwardly"
    },
    "set_polish": {
      "score": 0-100,
      "issues": ["oversaturated", "undersaturated", "over_processed", "amateur_feel"],
      "detail": "overall style impression"
    },
    "ethics": {
      "score": 0-100,
      "issues": ["possible_defect_concealment", "permanent_feature_removed", "view_misrepresented", "virtual_staging_undisclosed", "digitally_altered_high_risk", "sky_replacement_undisclosed"],
      "detail": "specific risk if applicable",
      "high_risk": false
    }
  },
  "fix_actions": [
    "specific action-oriented instruction like: Reduce green cast in cabinetry and ceiling",
    "Straighten verticals by approximately X degrees",
    "Recover highlights in window region",
    "Reduce saturation in lawn and exterior foliage"
  ],
  "room_type": "kitchen" | "living_room" | "bedroom" | "bathroom" | "exterior_front" | "exterior_back" | "dining_room" | "office" | "hallway" | "basement" | "other",
  "confidence": 0-1.0
}

Scoring guidance:
- 90-100: publication-ready, no issues visible
- 80-89: good, minor polish possible
- 70-79: acceptable but noticeable issues
- 50-69: major issues, needs re-edit
- 0-49: reject, needs reshoot or major work

Pass/fail rules:
- "pass" if overall score >= 80 AND no category below 60 AND ethics.high_risk is false
- "minor" if overall score 70-79 with fixable issues
- "major" if any category < 60 or overall < 70
- "reject" if ethics.high_risk is true OR multiple hard-fail categories below 50

Hard-fail categories (push toward "major" or "reject"): geometry, exposure, white_balance, ethics, sharpness_noise.

Ethics high_risk when there's visible evidence of concealing defects, removing permanent site features (power lines, neighboring buildings, highways), fake sky replacements that misrepresent lighting, or virtual staging that could mislead buyers.

Be honest but not harsh. A well-edited photo should score 85+. Don't punish intentional stylistic choices (warm cozy interior, moody dark floors) if the image is still accurate and truthful."""


def check_composition(image_path: str) -> dict:
    """
    Send image to Claude Vision for full 9-category RE photography analysis.

    Returns structured data matching Paul's real estate QC spec:
    - overall pass/fail + score
    - 9 category scores with specific issues
    - action-oriented fix instructions
    - ethics risk flag
    - confidence
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return _empty_result("Claude Vision API key not configured")

    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    ext = image_path.lower().split(".")[-1]
    media_type = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }.get(ext, "image/jpeg")

    client = anthropic.Anthropic(api_key=api_key)

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data,
                            },
                        },
                        {"type": "text", "text": USER_PROMPT},
                    ],
                }
            ],
        )

        text = response.content[0].text.strip()
        # Strip any markdown fences if Claude added them anyway
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
            text = text.strip()

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return _empty_result(f"Could not parse Claude response: {text[:200]}")

        # Transform into format expected by handler
        # Returns both the original structured data AND flat issue dict for backward compat
        output = {
            "full_analysis": parsed,
            "analysis": parsed.get("overall", {}).get("summary", ""),
            "room_type": parsed.get("room_type"),
            "confidence": parsed.get("confidence", 0.8),
            "fix_actions": parsed.get("fix_actions", []),
        }

        # Convert category issues into flat flags that handler can use
        # Each issue gets severity derived from the category score
        categories = parsed.get("categories", {})
        for cat_name, cat_data in categories.items():
            score = cat_data.get("score", 100)
            if score < 80:
                severity = max(0, min(1, (80 - score) / 80))
                for issue_key in cat_data.get("issues", []):
                    output[issue_key] = {
                        "severity": severity,
                        "detail": cat_data.get("detail", ""),
                        "category": cat_name,
                    }

        # Ethics flag
        if categories.get("ethics", {}).get("high_risk"):
            output["ethics_high_risk"] = {
                "severity": 1.0,
                "detail": categories["ethics"].get("detail", "High ethics risk detected"),
                "category": "ethics",
            }

        return output

    except Exception as e:
        return _empty_result(f"Vision API error: {str(e)[:150]}")


def _empty_result(reason: str) -> dict:
    """Return a safe empty result when vision is unavailable."""
    return {
        "analysis": reason,
        "full_analysis": None,
        "fix_actions": [],
        "confidence": 0,
    }
