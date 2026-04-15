"""
Real Estate Photography QC - Unified Claude Vision Analysis

ONE call per photo returns both:
- 9-category QC audit (geometry, exposure, WB, composition, ethics, etc.)
- Privacy detection (family photos, kids, diplomas) with bounding boxes

Consolidating avoids rate-limit pressure and saves ~30% on API costs vs
running two separate calls.

Includes exponential backoff retry on 429 rate-limit errors.
"""

import base64
import json
import os
import random
import time

import anthropic


SYSTEM_PROMPT = """You are an expert real estate photography QC auditor trained by a professional real estate photographer. You evaluate images against industry standards used by MLS boards, the National Association of REALTORS®, and professional real estate photography companies.

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

GRADING TIERS (most photos should score in PASS or higher):
- PREMIUM: 95-100, publication-ready, hero image quality, no notable issues
- PASS_HIGH: 88-94, professional quality, minor polish possible
- PASS: 80-87, solid for MLS, acceptable issues
- PASS_LOW: 70-79, usable but noticeable issues
- MINOR_FAIL: 60-69, fixable in post but not deliverable as-is
- MAJOR_FAIL: 40-59, significant issues, needs re-edit
- REJECT: <40 or ethics violation

Use NUANCED severity language: "slight", "mild", "minor", "moderate", "significant", "severe". A "slight" issue should not drop a photo below PASS_HIGH. Only "moderate+" issues should pull a photo into PASS_LOW or below.

Return ONLY valid JSON, no markdown fences, no explanation."""


USER_PROMPT = """Analyze this real estate photograph and return ONE JSON object containing both the QC audit and personal-image detection for privacy blur.

{
  "overall": {
    "tier": "premium" | "pass_high" | "pass" | "pass_low" | "minor_fail" | "major_fail" | "reject",
    "score": 0-100,
    "summary": "one sentence describing the photo"
  },
  "categories": {
    "geometry": {
      "score": 0-100,
      "issues": ["verticals_converging","verticals_slight_tilt","horizon_tilt","horizon_slight_tilt","lens_distortion_barrel","transform_overcorrected","edge_stretching"],
      "detail": "specific description if score < 80"
    },
    "exposure": {
      "score": 0-100,
      "issues": ["window_blowout","highlight_clipping","ceiling_highlights_flat","minor_overexposure_upper_range","shadow_crush","shadow_density_high","muddy_midtones","flat_hdr","low_microcontrast","halo_artifacts","too_dark","too_bright","counter_highlight_flat","window_underexposed_relative"],
      "detail": "..."
    },
    "white_balance": {
      "score": 0-100,
      "issues": ["wb_too_warm","wb_slightly_warm","wb_too_cool","wb_slightly_cool","green_cast","green_shadow_cast","magenta_cast","mixed_lighting_unresolved","neutral_surfaces_not_neutral"],
      "detail": "..."
    },
    "window_realism": {
      "score": 0-100,
      "issues": ["window_not_recovered","window_mask_halo","window_view_fake","window_too_dark","window_too_saturated","inconsistent_window_style","window_underexposed_relative"],
      "detail": "..."
    },
    "lens_optics": {
      "score": 0-100,
      "issues": ["chromatic_aberration","vignetting_excessive","barrel_distortion","corner_stretching"],
      "detail": "..."
    },
    "sharpness_noise": {
      "score": 0-100,
      "issues": ["soft_focus","motion_blur","over_sharpened","noise_excessive","noise_reduction_smearing"],
      "detail": "..."
    },
    "composition": {
      "score": 0-100,
      "issues": ["composition_confusing","feature_not_emphasized","too_much_ceiling","too_much_floor","awkward_crop","ultrawide_distortion","visible_photographer","clutter","toilet_lid_up"],
      "detail": "..."
    },
    "set_polish": {
      "score": 0-100,
      "issues": ["oversaturated","sky_oversaturated_minor","greens_slightly_boosted","undersaturated","over_processed","amateur_feel"],
      "detail": "..."
    },
    "ethics": {
      "score": 0-100,
      "issues": ["possible_defect_concealment","permanent_feature_removed","view_misrepresented","virtual_staging_undisclosed","digitally_altered_high_risk","sky_replacement_undisclosed"],
      "detail": "...",
      "high_risk": false
    }
  },
  "fix_actions": [
    "Human-readable action, short, present tense. e.g. 'Pull highlights -8 to recover ceiling detail'"
  ],
  "structured_actions": [
    { "op": "exposure", "amount": -0.3, "reason": "Ceiling slightly over-bright" },
    { "op": "highlights", "amount": -10, "reason": "Recover window detail" },
    { "op": "shadows", "amount": 8, "reason": "Lift dark floor corners" },
    { "op": "contrast", "amount": -5, "reason": "Soften harsh midtone contrast" },
    { "op": "saturation_global", "amount": -4, "reason": "Slight overprocessing" },
    { "op": "saturation_channel", "channel": "greens", "amount": -6, "reason": "Grass oversaturated" },
    { "op": "temperature", "amount": -3, "reason": "Cool slightly toward neutral" },
    { "op": "tint", "amount": 2, "reason": "Neutralize green cast" }
  ],
  "room_type": "kitchen" | "living_room" | "bedroom" | "bathroom" | "exterior_front" | "exterior_back" | "exterior_pool" | "dining_room" | "office" | "hallway" | "basement" | "other",
  "confidence": 0-1.0,
  "privacy": {
    "has_personal": true | false,
    "regions": [
      {
        "type": "family_photo" | "child_photo" | "portrait" | "diploma_with_name" | "personal_document" | "pet_with_owner" | "other_personal",
        "description": "brief description",
        "bbox": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1 },
        "confidence": 0-1
      }
    ]
  }
}

PRIVACY detection rules - items that SHOULD be blurred:
- Framed family photos, portraits, wedding pictures
- Pictures of children, kids artwork, school photos on fridges
- Personal photos (pets with owners, vacation shots, personal portraits)
- Framed certificates/diplomas/awards with visible names
- Personal documents with visible text
- Religious portraits of identifiable people
- Calendars with personal events

Items that should NOT be blurred:
- Generic artwork (landscapes, abstract art, stock prints)
- Framed mirrors
- Decorative posters without people
- Wall hangings without identifiable people

Bounding boxes: normalized 0-1 where (0,0) is top-left. Pad boxes +5% each side. Only include regions with confidence >= 0.7.

Calibration: most professional photos should land PASS_HIGH (88-94) or PASS (80-87). Don't punish stylistic choices (warm cozy interior, moody dark floors) if the photo is accurate and truthful.

STRUCTURED ACTIONS are what the system executes automatically. Rules:
- Use them for anything you would adjust in Lightroom global panels. Skip "fix_actions" that require local brush work.
- Supported ops: exposure, highlights, shadows, contrast, saturation_global, saturation_channel (with channel in reds, oranges, yellows, greens, aquas, blues, purples, magentas), temperature, tint.
- Magnitudes are clamped. Stay conservative: exposure +/- 0.5 max, highlights/shadows/contrast/saturation in -20 to +20 range, temperature/tint in -10 to +10. Real RE adjustments rarely need big moves.
- Only emit an action when the photo actually needs it. An empty array is a valid answer for a clean photo.
- Every action MUST have a short "reason" (under 80 chars) so the agent knows why it was applied.
- "fix_actions" is the human-readable version for the UI. "structured_actions" is what the fixer runs. Keep them consistent; every structured action should have a matching fix_actions line when an adjustment is executed.

ABSOLUTE RULE, NO EXCEPTIONS:
- NEVER suggest cropping, recomposing, changing framing, zooming, or altering the aspect ratio of the photo.
- NEVER recommend a "slight crop to center the subject" or "trim the edges" or anything that changes what is included in the frame. The photographer composed the shot intentionally. Composition is not something this tool changes.
- NEVER suggest rotating the image. Vertical alignment and horizon leveling are already handled automatically by the pipeline in another step. Do not mention them in fix_actions at all.
- If a photo would benefit from a different composition, say so once in the "analysis" field only. Do NOT put it in fix_actions and do NOT put it in structured_actions."""


def _call_with_retry(client, args: dict, max_attempts: int = 5) -> anthropic.types.Message:
    """Call Anthropic with exponential backoff for rate-limit errors."""
    last_err = None
    for attempt in range(max_attempts):
        try:
            return client.messages.create(**args)
        except anthropic.RateLimitError as e:
            last_err = e
            wait = (2 ** attempt) + random.random()
            wait = min(wait, 60)
            print(f"Rate limited, retrying in {wait:.1f}s (attempt {attempt + 1}/{max_attempts})")
            time.sleep(wait)
        except anthropic.APIStatusError as e:
            if e.status_code == 429:
                last_err = e
                wait = (2 ** attempt) + random.random()
                wait = min(wait, 60)
                print(f"429 retry in {wait:.1f}s (attempt {attempt + 1}/{max_attempts})")
                time.sleep(wait)
            else:
                raise
    raise last_err if last_err else RuntimeError("Unknown retry failure")


def check_composition(image_path: str) -> dict:
    """
    Unified Claude Vision analysis: QC audit + privacy detection in ONE call.

    Returns structured data:
    - overall (tier, score, summary)
    - categories (9 category scores + issues)
    - fix_actions
    - room_type, confidence
    - privacy (has_personal, regions with bboxes)
    - Flat issue keys for handler backward-compat
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
        response = _call_with_retry(
            client,
            {
                "model": "claude-sonnet-4-6",
                "max_tokens": 2500,
                "system": SYSTEM_PROMPT,
                "messages": [
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
            },
        )

        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
            text = text.strip()

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return _empty_result(f"Could not parse Claude response: {text[:200]}")

        # Build output matching what the handler expects
        raw_fix_actions = parsed.get("fix_actions", []) or []
        raw_structured = parsed.get("structured_actions", []) or []

        # Hard filter. Cropping and composition changes are never allowed
        # regardless of what Claude returned. Belt and suspenders behind
        # the prompt instruction. Keywords cover the common phrasings.
        _banned_keywords = (
            "crop", "cropping", "cropped",
            "recompose", "recomposition",
            "reframe", "reframing",
            "trim the edge", "trim edges",
            "aspect ratio",
            "zoom in", "zoom out",
            "tighten the frame", "tighter framing", "tighter frame",
            "straighten", "rotate", "rotation",
            "level the horizon", "level horizon",
        )

        def _is_banned(text: str) -> bool:
            if not isinstance(text, str):
                return False
            low = text.lower()
            return any(kw in low for kw in _banned_keywords)

        fix_actions = [a for a in raw_fix_actions if not _is_banned(a)]

        # Similarly for structured actions: drop any op this pipeline does
        # not support. The executor already ignores unknown ops, but
        # filtering here keeps issues._applied_actions accurate.
        _supported_ops = {
            "exposure", "highlights", "shadows", "contrast",
            "saturation_global", "saturation_channel",
            "temperature", "tint",
        }
        structured_actions = [
            a for a in raw_structured
            if isinstance(a, dict) and a.get("op") in _supported_ops
        ]

        output = {
            "full_analysis": parsed,
            "analysis": parsed.get("overall", {}).get("summary", ""),
            "room_type": parsed.get("room_type"),
            "confidence": parsed.get("confidence", 0.8),
            "fix_actions": fix_actions,
            "structured_actions": structured_actions,
            "privacy": parsed.get("privacy", {"has_personal": False, "regions": []}),
        }

        # Flatten category issues into individual keys for backward compat
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

        if categories.get("ethics", {}).get("high_risk"):
            output["ethics_high_risk"] = {
                "severity": 1.0,
                "detail": categories["ethics"].get("detail", "High ethics risk"),
                "category": "ethics",
            }

        return output

    except Exception as e:
        return _empty_result(f"Vision API error: {str(e)[:150]}")


def _empty_result(reason: str) -> dict:
    return {
        "analysis": reason,
        "full_analysis": None,
        "fix_actions": [],
        "confidence": 0,
        "privacy": {"has_personal": False, "regions": []},
    }


# Backward-compat shim - old personal_images.detect_personal_images(image_path)
# now just reads from the unified composition result, so handler should use
# comp_result["privacy"] instead of calling detect_personal_images separately.
