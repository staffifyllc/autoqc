"""
PhotoQC Lambda Handler
Processes SQS messages containing QC job requests.
Downloads photos from S3, runs all QC checks, applies auto-fixes,
and updates the database with results.
"""

import json
import os
import tempfile
import traceback
from typing import Any

import boto3
import psycopg2

from checks.verticals import check_verticals
from checks.horizon import check_horizon
from checks.color import check_color
from checks.exposure import check_exposure
from checks.sharpness import check_sharpness
from checks.composition import check_composition
from checks.consistency import check_consistency
from checks.lens_distortion import check_lens_distortion
from checks.chromatic_aberration import check_chromatic_aberration
from checks.window_blowout import check_window_blowout
from checks.hdr_artifacts import check_hdr_artifacts
from checks.sky import check_sky
from checks.distraction_removal import detect_distractions

from fixes.vertical_fix import fix_verticals
from fixes.color_fix import fix_color
from fixes.horizon_fix import fix_horizon
from fixes.sharpness_fix import fix_sharpness
from fixes.ai_deblur import ai_deblur
from fixes.blur_personal import apply_privacy_blur
from fixes.apply_actions import apply_recommended_actions
from fixes.remove_distractions import remove_distractions

from hdr.merge import merge_brackets_from_s3, decode_single_raw_from_s3
from hdr.style_transfer import (
    deserialize_profile,
    match_image_path,
    apply_learned_path,
)
from hdr.lens_correct import lens_applies, correct_distortion
from checks.window_protect import protect_windows

s3 = boto3.client("s3")
BUCKET = os.environ["AWS_S3_BUCKET"]
DB_URL = os.environ["DATABASE_URL"]


def get_db():
    return psycopg2.connect(DB_URL)


def download_photo(s3_key: str) -> str:
    """Download a photo from S3 to a temp file."""
    suffix = "." + s3_key.split(".")[-1]
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    s3.download_file(BUCKET, s3_key, tmp.name)
    return tmp.name


def upload_fixed(local_path: str, s3_key: str) -> str:
    """
    Upload a fixed photo to S3.

    For HDR shoots the original key has a .arw / .dng / .cr3 extension
    but the fixed bytes are always JPEG (Mertens or rawpy output). Swap
    the extension so browsers and downstream MIME-checking code render
    the fixed image. Also set ContentType so the S3 metadata matches.
    """
    fixed_key = s3_key.replace("/original/", "/fixed/")
    ext = fixed_key.rsplit(".", 1)[-1].lower()
    raw_exts = {"arw", "cr2", "cr3", "nef", "dng", "raf", "orf", "rw2"}
    if ext in raw_exts:
        fixed_key = fixed_key.rsplit(".", 1)[0] + ".jpg"
    content_type = "image/jpeg"
    s3.upload_file(
        local_path,
        BUCKET,
        fixed_key,
        ExtraArgs={"ContentType": content_type},
    )
    return fixed_key


def upload_preview_jpeg(local_path: str, s3_key: str) -> str:
    """
    For HDR shoots: upload the post-Mertens, pre-style JPEG into the
    "original" prefix so the dashboard before/after slider has a
    browser-renderable "before" image. Browsers cant decode ARW/DNG;
    without this the Original side of the compare slider rendered
    blank ("1px-by-1px" effect Paul saw). We keep the RAW brackets
    referenced via Photo.bracketKeys for downstream archival; the
    s3KeyOriginal column gets rewritten to this preview path.
    """
    ext = s3_key.rsplit(".", 1)[-1].lower()
    raw_exts = {"arw", "cr2", "cr3", "nef", "dng", "raf", "orf", "rw2"}
    if ext in raw_exts:
        preview_key = s3_key.rsplit(".", 1)[0] + ".jpg"
    else:
        # For non-RAW originals just write to the existing key so the
        # caller never has to care which path it came from.
        preview_key = s3_key
    s3.upload_file(
        local_path,
        BUCKET,
        preview_key,
        ExtraArgs={"ContentType": "image/jpeg"},
    )
    return preview_key


def get_profile_thresholds(db, agency_id: str, client_profile_id: str = None):
    """Get QC thresholds from the agency's style profile and optional client overrides."""
    cursor = db.cursor()

    # Default thresholds - CONSERVATIVE by default
    # Goal: only flag photos that have clear, visible issues
    # Style-specific edits (warm editorial, moody, etc.) should NOT be flagged
    thresholds = {
        "vertical_tolerance": 1.5,      # degrees - forgiving for RE photos
        "horizon_tolerance": 1.0,        # degrees
        "color_temp_min": 2800,          # Kelvin - allow warm cozy styles
        "color_temp_max": 7500,          # Kelvin - allow cool bright-airy styles
        "color_temp_consistency": 500,   # Max Kelvin variance across a set
        "exposure_min": -1.5,            # EV
        "exposure_max": 2.0,             # EV
        "saturation_min": 10,            # percentage
        "saturation_max": 90,            # percentage
        "sharpness_threshold": 50.0,     # Laplacian variance - truly blurry only
        "halo_max_px": 8,                # max halo width in pixels
        "chromatic_aberration_threshold": 3.0,  # pixel fringe width
    }

    # Try to get agency default profile (Prisma uses camelCase column names)
    cursor.execute(
        """
        SELECT "verticalTolerance", "sharpnessThreshold",
               "colorTempMin", "colorTempMax", "colorTempAvg",
               "saturationMin", "saturationMax", "saturationAvg",
               "exposureMin", "exposureMax", "exposureAvg"
        FROM "StyleProfile"
        WHERE "agencyId" = %s AND "isDefault" = true
        LIMIT 1
        """,
        (agency_id,),
    )
    row = cursor.fetchone()
    if row:
        if row[0] is not None:
            thresholds["vertical_tolerance"] = row[0]
        if row[1] is not None:
            thresholds["sharpness_threshold"] = row[1]
        if row[2] is not None:
            thresholds["color_temp_min"] = row[2]
        if row[3] is not None:
            thresholds["color_temp_max"] = row[3]
        if row[5] is not None:
            thresholds["saturation_min"] = row[5]
        if row[6] is not None:
            thresholds["saturation_max"] = row[6]
        if row[8] is not None:
            thresholds["exposure_min"] = row[8]
        if row[9] is not None:
            thresholds["exposure_max"] = row[9]

    # Apply client overrides if present
    if client_profile_id:
        cursor.execute(
            """
            SELECT "colorTempOverride", "saturationOverride",
                   "contrastOverride", "exposureOverride", "verticalTolOverride"
            FROM "ClientProfile"
            WHERE id = %s
            """,
            (client_profile_id,),
        )
        client_row = cursor.fetchone()
        if client_row:
            if client_row[4] is not None:
                thresholds["vertical_tolerance"] = client_row[4]

    cursor.close()
    return thresholds


def calculate_qc_score(issues: dict, checks_run: int) -> float:
    """
    Calculate a 0-100 QC score based on issues found.
    Each issue category has a weight reflecting its importance
    in real estate photography.
    """
    weights = {
        "vertical_tilt": 15,        # Very important in RE photos
        "horizon_tilt": 10,
        "color_temp": 12,
        "overexposed": 10,
        "underexposed": 10,
        "soft_focus": 12,           # Blurry photos are unusable
        "chromatic_aberration": 5,
        "lens_distortion": 8,
        "composition": 8,
        "reflection": 5,
        "toilet_visible": 3,
        "clutter": 3,
        "consistency": 8,
        "window_blowout": 8,
        "hdr_artifact": 7,
        "sky_issue": 5,
    }

    total_weight = sum(weights.values())
    deductions = 0

    for issue_key, severity in issues.items():
        # Skip metadata keys stored alongside real issues (e.g. _room_type,
        # _scene, etc). These hold context strings, not severity scores, and
        # must not feed into the deduction math or float() will crash.
        if isinstance(issue_key, str) and issue_key.startswith("_"):
            continue
        weight = weights.get(issue_key, 5)
        # Severity is 0-1, where 1 is worst
        if isinstance(severity, dict):
            sev = severity.get("severity", 0.5)
        else:
            try:
                sev = float(severity) if severity else 0.5
            except (TypeError, ValueError):
                # Non-numeric value slipped in. Log and skip rather than
                # crash the finalization for the whole property.
                print(f"WARN skipping non-numeric severity for {issue_key}: {severity!r}")
                continue
        deductions += weight * sev

    score = max(0, 100 - (deductions / total_weight * 100))
    return round(score, 1)


def process_photo(
    photo_id: str,
    s3_key: str,
    thresholds: dict,
    all_photo_data: list = None,
    tier: str = "STANDARD",
    distraction_categories: list = None,
    pre_processed_local_path: str | None = None,
) -> dict:
    """
    Run all QC checks on a single photo.

    pre_processed_local_path: when set, skip the S3 download and use
    this local file as the starting point. Used by the HDR merge flow
    (handler merges brackets to a local JPEG, then calls process_photo
    with that path so the existing composition + smart_editor stack
    runs unchanged on the merged frame). s3_key is still used for the
    output upload destination.
    """
    if pre_processed_local_path:
        local_path = pre_processed_local_path
    else:
        local_path = download_photo(s3_key)
    issues = {}
    metrics = {}
    fixes_applied = []
    ai_notes = None
    fixed_s3_key = None
    # HDR path: the merged / RAW-decoded JPEG IS itself a transform
    # of the originals (browsers cant render the ARW / DNG sitting in
    # s3KeyOriginal). Force-flag the upload so even when no fix module
    # triggers later, the dashboard has a renderable image to show.
    force_upload_fixed = pre_processed_local_path is not None

    try:
        # === GEOMETRIC CHECKS ===

        # 1. Vertical alignment (walls, door frames, window frames)
        vert_result = check_verticals(local_path, thresholds["vertical_tolerance"])
        metrics["vertical_dev"] = vert_result["deviation"]
        if vert_result["failed"]:
            issues["vertical_tilt"] = {
                "severity": min(vert_result["deviation"] / 5.0, 1.0),
                "deviation": vert_result["deviation"],
                "direction": vert_result["direction"],
            }

        # 2. Horizon level
        horiz_result = check_horizon(local_path, thresholds["horizon_tolerance"])
        metrics["horizon_dev"] = horiz_result["deviation"]
        if horiz_result["failed"]:
            issues["horizon_tilt"] = {
                "severity": min(horiz_result["deviation"] / 3.0, 1.0),
                "deviation": horiz_result["deviation"],
            }

        # 3. Lens distortion
        distort_result = check_lens_distortion(local_path)
        if distort_result["failed"]:
            issues["lens_distortion"] = {
                "severity": distort_result["severity"],
                "type": distort_result["type"],
            }

        # === COLOR & EXPOSURE CHECKS ===

        # 4. Color temperature and white balance
        color_result = check_color(
            local_path,
            thresholds["color_temp_min"],
            thresholds["color_temp_max"],
        )
        metrics["color_temp"] = color_result["color_temp"]
        metrics["saturation"] = color_result["saturation"]
        if color_result["failed"]:
            issues["color_temp"] = {
                "severity": color_result["severity"],
                "detected_temp": color_result["color_temp"],
                "color_cast": color_result.get("color_cast"),
            }

        # 5. Exposure
        exp_result = check_exposure(
            local_path,
            thresholds["exposure_min"],
            thresholds["exposure_max"],
        )
        metrics["exposure"] = exp_result["exposure"]
        if exp_result["overexposed"]:
            issues["overexposed"] = {
                "severity": exp_result["severity"],
                "blown_percentage": exp_result.get("blown_percentage"),
            }
        if exp_result["underexposed"]:
            issues["underexposed"] = {
                "severity": exp_result["severity"],
                "crushed_percentage": exp_result.get("crushed_percentage"),
            }

        # 6. Window blowout (interior vs exterior exposure)
        window_result = check_window_blowout(local_path)
        if window_result["failed"]:
            issues["window_blowout"] = {
                "severity": window_result["severity"],
                "window_regions": window_result.get("count", 0),
            }

        # === TECHNICAL QUALITY CHECKS ===

        # 7. Sharpness
        sharp_result = check_sharpness(local_path, thresholds["sharpness_threshold"])
        metrics["sharpness"] = sharp_result["sharpness"]
        if sharp_result["failed"]:
            issues["soft_focus"] = {
                "severity": sharp_result["severity"],
                "variance": sharp_result["sharpness"],
            }

        # 8. Chromatic aberration
        ca_result = check_chromatic_aberration(
            local_path, thresholds["chromatic_aberration_threshold"]
        )
        if ca_result["failed"]:
            issues["chromatic_aberration"] = {
                "severity": ca_result["severity"],
                "fringe_width": ca_result["fringe_width"],
            }

        # 9. HDR artifacts (halos, ghosting, flat tone mapping)
        hdr_result = check_hdr_artifacts(local_path, thresholds["halo_max_px"])
        if hdr_result["failed"]:
            issues["hdr_artifact"] = {
                "severity": hdr_result["severity"],
                "type": hdr_result["artifact_type"],
            }

        # 10. Sky quality
        sky_result = check_sky(local_path)
        if sky_result["failed"]:
            issues["sky_issue"] = {
                "severity": sky_result["severity"],
                "type": sky_result["issue_type"],
            }

        # === COMPREHENSIVE AI AUDIT (Claude Vision, Real Estate framework) ===
        # This is the primary QC signal. OpenCV checks above provide algorithmic
        # verification; Claude Vision provides the nuanced real-estate judgment.
        comp_result = check_composition(local_path)
        ai_notes = comp_result.get("analysis", "")
        full_analysis = comp_result.get("full_analysis")
        fix_actions = comp_result.get("fix_actions", [])
        structured_actions = comp_result.get("structured_actions", [])
        room_type = comp_result.get("room_type")

        # Merge every category issue from the vision analysis into the flat
        # issues dict. These come pre-tagged with severity and category.
        for key, val in comp_result.items():
            if key in (
                "analysis",
                "full_analysis",
                "fix_actions",
                "structured_actions",
                "room_type",
                "confidence",
                "privacy",
            ):
                continue
            if isinstance(val, dict) and "severity" in val:
                issues[key] = val

        # === AUTO-FIX ===
        # Philosophy: reliably fix the mechanical stuff every single time.
        # Tilted photos, minor WB drift, soft focus - these should never ship.
        # No "only fix if score is bad enough" gating.
        needs_fix = False
        prelim_score = calculate_qc_score(issues, 12)
        should_autofix = True  # Always attempt fixes; individual modules self-gate

        # Fix verticals - ALWAYS when detected (0.5 to 5 degree range)
        # A tilted photo is never acceptable even at a 90 QC score.
        vert_dev = vert_result.get("deviation", 0)
        if vert_dev > 0.5 and vert_dev < 5.0:
            fixed_path = fix_verticals(
                local_path, vert_dev, vert_result.get("direction", "left")
            )
            if fixed_path:
                local_path = fixed_path
                fixes_applied.append(f"Vertical corrected ({vert_dev:.1f} deg)")
                needs_fix = True

        # Fix horizon - ALWAYS when detected (0.5 to 3 degree range)
        horiz_dev = horiz_result.get("deviation", 0)
        if horiz_dev > 0.5 and horiz_dev < 3.0:
            fixed_path = fix_horizon(local_path, horiz_dev)
            if fixed_path:
                local_path = fixed_path
                fixes_applied.append(f"Horizon leveled ({horiz_dev:.1f} deg)")
                needs_fix = True

        # HDR shoots have already been color-matched to the agency's
        # learned style histogram earlier in the handler. The generic
        # WB / color-cast fixer here would pull them back toward neutral
        # and undo that match. Skip color_fix when we are on the HDR
        # path (pre_processed_local_path was set by the caller).
        is_hdr_pass = pre_processed_local_path is not None

        # Fix WB - ANY detected cast on interior photo (not just fluorescent).
        # Exteriors and already-neutral photos are gated inside fix_color() itself.
        # The clamped scale (+/- 10%) prevents the destructive magenta disaster.
        if (
            not is_hdr_pass
            and color_result.get("color_cast")
            and color_result.get("cast_strength", 0) > 0.04
            and not color_result.get("is_exterior", False)
            and not color_result.get("already_neutral", False)
        ):
            # Force should_autofix so fix_color will act on any detected cast
            color_result["should_autofix"] = True
            fixed_path = fix_color(local_path, color_result)
            if fixed_path:
                local_path = fixed_path
                fixes_applied.append(
                    f"Removed {color_result.get('color_cast', 'color')} cast"
                )
                needs_fix = True

        # Fix sharpness - runs on actually-soft photos
        if "soft_focus" in issues:
            sharpness_val = sharp_result["sharpness"]

            if sharpness_val >= 30 and sharpness_val < 50:
                # Clearly soft - try AI deblur
                fixed_path, description = ai_deblur(local_path, sharpness_val)
                if fixed_path:
                    local_path = fixed_path
                    fixes_applied.append(description)
                    needs_fix = True
            # Below 30 or above 50: don't touch. Too blurry to save or sharp enough.

        # === RECOMMENDED ADJUSTMENTS (Lightroom-style, from Claude Vision) ===
        # Every structured action from the composition check gets executed
        # here: exposure, highlights, shadows, contrast, saturation (global
        # and per-channel), temperature, tint. Magnitudes are clamped inside
        # the executor so Claude cannot over-do it even if the prompt drifts.
        #
        # Skip on the HDR path: the LAB histogram match already pushed
        # the merged image toward the agency's learned aesthetic, and
        # Claude Vision evaluates against generic standards so its
        # nudges would partially undo that match.
        if structured_actions and not is_hdr_pass:
            adjusted_path, applied = apply_recommended_actions(
                local_path, structured_actions
            )
            if adjusted_path and applied:
                local_path = adjusted_path
                for a in applied:
                    label = a["op"]
                    if a.get("channel"):
                        label = f"{label} ({a['channel']})"
                    fixes_applied.append(
                        f"{label} {a['amount']:+.2f}"
                        + (f" — {a['reason']}" if a.get("reason") else "")
                    )
                needs_fix = True
                # Record what ran so the UI can show applied-not-suggested
                issues["_applied_actions"] = applied

        # === PRIVACY BLUR (PREMIUM tier only) ===
        # Uses the privacy data already returned from the unified composition call.
        # Saves an extra Claude Vision API call (halves rate limit pressure).
        if tier == "PREMIUM":
            privacy_data = comp_result.get("privacy", {})
            regions = privacy_data.get("regions", [])
            if privacy_data.get("has_personal") and regions:
                blurred_path = apply_privacy_blur(local_path, regions)
                if blurred_path:
                    local_path = blurred_path
                    region_count = len(regions)
                    fixes_applied.append(
                        f"Privacy blur applied to {region_count} personal item"
                        + ("s" if region_count != 1 else "")
                    )
                    issues["privacy_blurred"] = {
                        "severity": 0.1,
                        "category": "privacy",
                        "detail": f"{region_count} personal items blurred",
                        "region_count": region_count,
                    }
                    needs_fix = True

        # === DISTRACTION REMOVAL (PREMIUM tier only, opt-in categories) ===
        # Detects transient clutter (trash bins, hoses, toys, cables) and
        # inpaints them out with LaMa. Only runs when the property has an
        # explicit non-empty category list. Risky categories (cars,
        # satellite dishes, power lines) have to be opted into from the UI.
        if tier == "PREMIUM" and distraction_categories:
            dist_result = detect_distractions(local_path, distraction_categories)
            dist_regions = dist_result.get("regions", [])
            if dist_result.get("has_distractions") and dist_regions:
                cleaned_path = remove_distractions(local_path, dist_regions)
                if cleaned_path:
                    local_path = cleaned_path
                    per_type_counts: dict = {}
                    for r in dist_regions:
                        t = r.get("type", "distraction")
                        per_type_counts[t] = per_type_counts.get(t, 0) + 1
                    count = len(dist_regions)
                    fixes_applied.append(
                        f"Removed {count} distraction"
                        + ("s" if count != 1 else "")
                    )
                    issues["distractions_removed"] = {
                        "severity": 0.1,
                        "category": "distraction_removal",
                        "detail": dist_result.get("summary", ""),
                        "region_count": count,
                        "per_type": per_type_counts,
                        # Keep bbox + type so the UI can list them; drop the
                        # heavy base64 mask payloads so the Photo.issues
                        # JSONB row stays small.
                        "regions": [
                            {
                                "type": r.get("type"),
                                "description": r.get("description"),
                                "bbox": r.get("bbox"),
                                "confidence": r.get("confidence"),
                            }
                            for r in dist_regions
                        ],
                    }
                    needs_fix = True
            elif dist_result.get("regions") is not None:
                # Detection ran, found nothing. Leave a small breadcrumb
                # so the UI can show "checked, nothing to remove" instead
                # of staying silent. No severity.
                issues["distractions_checked"] = {
                    "severity": 0,
                    "category": "distraction_removal",
                    "detail": dist_result.get("summary", "No distractions found"),
                    "region_count": 0,
                }

        # Upload fixed version. force_upload_fixed is set for HDR
        # shoots so the merged/decoded JPEG always lands in s3KeyFixed
        # — without it, RAW shoots that no fix module touched would
        # leave only the unrenderable ARW/DNG in s3KeyOriginal.
        if needs_fix or force_upload_fixed:
            fixed_s3_key = upload_fixed(local_path, s3_key)

    except Exception as e:
        print(f"Error processing photo {photo_id}: {e}")
        traceback.print_exc()
        issues["processing_error"] = {"severity": 1.0, "error": str(e)}

    finally:
        # Cleanup temp files
        try:
            os.unlink(local_path)
        except:
            pass

    # Calculate QC score - prefer Claude's holistic overall score if available
    # (it evaluates all 9 RE categories). Fall back to algorithmic score.
    if full_analysis and full_analysis.get("overall", {}).get("score") is not None:
        qc_score = float(full_analysis["overall"]["score"])
    else:
        qc_score = calculate_qc_score(issues, checks_run=12)

    # Determine status from Claude's tier if available
    overall = (full_analysis or {}).get("overall", {})
    tier = overall.get("tier") or overall.get("pass_fail")  # backward compat
    ethics_risk = (
        (full_analysis or {})
        .get("categories", {})
        .get("ethics", {})
        .get("high_risk", False)
    )

    if ethics_risk or tier == "reject":
        status = "FLAGGED"  # Ethics or severe issues - human must review
    elif tier in ("premium", "pass_high", "pass") or (
        not tier and qc_score >= 80
    ):
        status = "PASSED"
    elif fixes_applied:
        status = "FIXED"
    elif tier in ("pass_low", "minor_fail", "major_fail", "minor", "major") or (
        not tier and qc_score < 80
    ):
        status = "FLAGGED"
    else:
        status = "PASSED"

    # Build AI notes that are useful to the user (issue summary + fix actions)
    if full_analysis and fix_actions:
        fix_lines = "\n".join(f"- {a}" for a in fix_actions)
        ai_notes = f"{ai_notes}\n\nRecommended fixes:\n{fix_lines}".strip()

    # Store the full Claude analysis inside issues JSON so the UI can render
    # category breakdown, fix actions, and room type without a schema change
    if full_analysis:
        issues["_full_analysis"] = full_analysis
    if fix_actions:
        issues["_fix_actions"] = fix_actions
    if room_type:
        issues["_room_type"] = room_type

    return {
        "photo_id": photo_id,
        "status": status,
        "qc_score": qc_score,
        "metrics": metrics,
        "issues": issues,
        "fixes_applied": fixes_applied,
        "ai_notes": ai_notes,
        "fixed_s3_key": fixed_s3_key,
    }


def update_photo_in_db(db, result: dict):
    """Update a photo record with QC results."""
    cursor = db.cursor()
    cursor.execute(
        """
        UPDATE "Photo" SET
            status = %s,
            "qcScore" = %s,
            "verticalDev" = %s,
            "horizonDev" = %s,
            "colorTemp" = %s,
            exposure = %s,
            sharpness = %s,
            saturation = %s,
            issues = %s,
            "aiNotes" = %s,
            "fixesApplied" = %s,
            "s3KeyFixed" = %s,
            "fixedAt" = CASE WHEN %s IS NOT NULL THEN NOW() ELSE NULL END,
            "updatedAt" = NOW()
        WHERE id = %s
        """,
        (
            result["status"],
            result["qc_score"],
            result["metrics"].get("vertical_dev"),
            result["metrics"].get("horizon_dev"),
            result["metrics"].get("color_temp"),
            result["metrics"].get("exposure"),
            result["metrics"].get("sharpness"),
            result["metrics"].get("saturation"),
            json.dumps(result["issues"]),
            result["ai_notes"],
            result["fixes_applied"],
            result["fixed_s3_key"],
            result["fixed_s3_key"],
            result["photo_id"],
        ),
    )
    cursor.close()


def update_property_status(db, property_id: str):
    """Update the property status based on all photo results."""
    cursor = db.cursor()

    cursor.execute(
        """
        SELECT status FROM "Photo" WHERE "propertyId" = %s
        """,
        (property_id,),
    )
    statuses = [row[0] for row in cursor.fetchall()]

    if not statuses:
        return

    # Calculate aggregate stats
    pass_count = statuses.count("PASSED") + statuses.count("APPROVED")
    fixed_count = statuses.count("FIXED")
    flagged_count = statuses.count("FLAGGED")

    if flagged_count > 0:
        property_status = "REVIEW"
    else:
        property_status = "APPROVED"

    # Calculate average QC score
    cursor.execute(
        """
        SELECT AVG("qcScore") FROM "Photo"
        WHERE "propertyId" = %s AND "qcScore" IS NOT NULL
        """,
        (property_id,),
    )
    avg_score = cursor.fetchone()[0]

    cursor.execute(
        """
        UPDATE "Property" SET
            status = %s,
            "qcPassCount" = %s,
            "qcFailCount" = %s,
            "totalQcScore" = %s,
            "updatedAt" = NOW()
        WHERE id = %s
        """,
        (property_status, pass_count + fixed_count, flagged_count, avg_score, property_id),
    )
    cursor.close()


def run_finalization(db, property_id, thresholds):
    """
    Finalization: set consistency check + property status update.
    Called by the last photo Lambda to finish processing.
    """
    cursor = db.cursor()

    # Get all processed photos' metrics for consistency check
    cursor.execute(
        """
        SELECT id, status, "colorTemp", exposure, saturation, "qcScore", issues
        FROM "Photo"
        WHERE "propertyId" = %s
        """,
        (property_id,),
    )
    rows = cursor.fetchall()

    all_metrics = []
    for row in rows:
        all_metrics.append({
            "id": row[0],
            "status": row[1],
            "color_temp": row[2],
            "exposure": row[3],
            "saturation": row[4],
            "qc_score": row[5],
            "issues": row[6] or {},
        })

    # Set consistency check
    if len(all_metrics) > 1:
        consistency_results = check_consistency(
            all_metrics, thresholds["color_temp_consistency"]
        )
        for i, is_inconsistent in enumerate(
            consistency_results.get("inconsistent_indices", [])
        ):
            if is_inconsistent and all_metrics[i]["status"] == "PASSED":
                photo_id = all_metrics[i]["id"]
                current_issues = all_metrics[i]["issues"]
                if isinstance(current_issues, str):
                    current_issues = json.loads(current_issues)
                current_issues["consistency"] = {
                    "severity": 0.5,
                    "detail": "Color temperature differs significantly from the rest of the set",
                }
                new_score = calculate_qc_score(current_issues, 12)
                cursor.execute(
                    """
                    UPDATE "Photo" SET
                        status = 'FLAGGED',
                        issues = %s,
                        "qcScore" = %s,
                        "updatedAt" = NOW()
                    WHERE id = %s
                    """,
                    (json.dumps(current_issues), new_score, photo_id),
                )

    cursor.close()
    update_property_status(db, property_id)


def handler(event, context):
    """
    AWS Lambda handler. Processes SQS messages.

    Supports two message modes:
    - "photo": process a single photo (parallel)
    - "batch" (legacy): process all photos for a property sequentially
    """
    db = get_db()

    try:
        for record in event.get("Records", []):
            body = json.loads(record["body"])
            mode = body.get("mode", "batch")
            property_id = body["propertyId"]
            agency_id = body["agencyId"]
            client_profile_id = body.get("clientProfileId")
            tier = body.get("tier", "STANDARD")

            thresholds = get_profile_thresholds(db, agency_id, client_profile_id)

            # Fetch the property's enabled distraction categories (Premium
            # only). Empty array means skip the distraction step.
            distraction_categories: list = []
            cursor = db.cursor()
            cursor.execute(
                'SELECT "distractionCategories" FROM "Property" WHERE id = %s',
                (property_id,),
            )
            prop_row = cursor.fetchone()
            cursor.close()
            if prop_row and prop_row[0]:
                distraction_categories = list(prop_row[0])

            if mode == "photo":
                # Single photo processing (parallel mode)
                photo_id = body["photoId"]

                cursor = db.cursor()
                cursor.execute(
                    'SELECT id, "s3KeyOriginal", "bracketKeys" FROM "Photo" WHERE id = %s',
                    (photo_id,),
                )
                row = cursor.fetchone()
                cursor.close()

                if not row:
                    print(f"Photo {photo_id} not found, skipping")
                    continue

                # HDR / RAW pre-processing runs BEFORE the standard pipeline.
                # Three cases depending on Photo.bracketKeys:
                #   len >= 2: Mertens-fuse the brackets into one JPEG.
                #   len == 1: decode the single RAW via rawpy (drone
                #             hero shots, dropped frames, mixed shoots).
                #   empty:    fall through to the standard JPEG path.
                # In the first two cases we hand a JPEG to process_photo
                # via pre_processed_local_path so the existing
                # composition + smart_editor stack runs unchanged.
                hdr_local_path: str | None = None
                hdr_meta: dict = {}
                bracket_keys = row[2] or []
                if bracket_keys and len(bracket_keys) >= 2:
                    print(
                        f"HDR merge: photo={photo_id} brackets={len(bracket_keys)}"
                    )
                    hdr_local_path, hdr_meta = merge_brackets_from_s3(
                        s3, BUCKET, bracket_keys
                    )
                    if hdr_local_path is None:
                        print(
                            f"HDR merge failed for {photo_id}: {hdr_meta.get('error')}"
                        )
                elif bracket_keys and len(bracket_keys) == 1:
                    print(f"Single RAW decode: photo={photo_id}")
                    hdr_local_path, hdr_meta = decode_single_raw_from_s3(
                        s3, BUCKET, bracket_keys[0]
                    )
                    if hdr_local_path is None:
                        print(
                            f"Single RAW decode failed for {photo_id}: {hdr_meta.get('error')}"
                        )

                # Stage 1.5 — LENS DISTORTION CORRECTION. Runs on the
                # merged result right after Mertens, BEFORE the preview
                # upload and style, and crucially BEFORE the vertical
                # (keystone) fix in process_photo — de-bow first so the
                # Hough vertical detector sees straight lines. Scoped by
                # EXIF lens model (Sony FE PZ 16-35); focal-keyed
                # strength (strong at 16mm, ~nothing by 24mm+). Applies
                # to all subjects on that lens (interior + exterior);
                # the lens bows lines regardless of what it's pointed at.
                if hdr_local_path and lens_applies(hdr_meta.get("lens_model")):
                    try:
                        _img = cv2.imread(hdr_local_path)
                        if _img is not None:
                            _corrected = correct_distortion(
                                _img, hdr_meta.get("focal_mm")
                            )
                            cv2.imwrite(
                                hdr_local_path, _corrected,
                                [cv2.IMWRITE_JPEG_QUALITY, 95],
                            )
                            hdr_meta.setdefault("operations", []).append(
                                f"Lens corrected ({hdr_meta.get('lens_model')} "
                                f"@ {hdr_meta.get('focal_mm')}mm)"
                            )
                            print(
                                f"Lens correction applied for {photo_id} "
                                f"@ {hdr_meta.get('focal_mm')}mm"
                            )
                    except Exception as lens_err:
                        print(
                            f"Lens correction skipped for {photo_id}: {lens_err}"
                        )

                # Write a JPEG preview of the Mertens / RAW-decoded
                # result BEFORE style transfer, and update s3KeyOriginal
                # to point at it. The dashboard before/after slider
                # uses s3KeyOriginal as the "Before" side; without this,
                # the slider tries to render the source RAW (ARW/DNG)
                # and browsers cant — leading to the "1px" / compressed
                # preview Paul reported. The original RAW brackets stay
                # referenced via Photo.bracketKeys for archival.
                if hdr_local_path:
                    try:
                        new_orig_key = upload_preview_jpeg(local_path=hdr_local_path, s3_key=row[1])
                        if new_orig_key and new_orig_key != row[1]:
                            cursor = db.cursor()
                            cursor.execute(
                                'UPDATE "Photo" SET "s3KeyOriginal" = %s WHERE id = %s',
                                (new_orig_key, photo_id),
                            )
                            db.commit()
                            cursor.close()
                            # From here on use the JPEG key as the s3
                            # base so process_photo's upload_fixed
                            # builds the /fixed/ counterpart correctly.
                            row = (row[0], new_orig_key, row[2])
                            print(
                                f"Preview JPEG uploaded for {photo_id}: {new_orig_key}"
                            )
                    except Exception as prev_err:
                        print(
                            f"Preview JPEG upload skipped for {photo_id}: {prev_err}"
                        )

                # Style transfer: when the HDR pipeline ran (merge or
                # single decode) AND the agency has a default style
                # profile with a learned histogram, push the image
                # toward the agency's finished look via LAB
                # histogram matching. This is what gets the output
                # from "generic Mertens" to "looks like Lightroom-
                # finished work." Skips silently if no histogram is
                # trained yet.
                if hdr_local_path:
                    try:
                        cursor = db.cursor()
                        cursor.execute(
                            """
                            SELECT "styleHistogram"
                            FROM "StyleProfile"
                            WHERE "agencyId" = %s AND "isDefault" = true
                            LIMIT 1
                            """,
                            (agency_id,),
                        )
                        row_sp = cursor.fetchone()
                        cursor.close()
                        if row_sp and row_sp[0]:
                            profile = deserialize_profile(row_sp[0])
                            if profile:
                                # Stage 5 — style transfer. Owns INTERIOR
                                # tonal look only. Writes to a SEPARATE
                                # styled path so the merged (window-intact)
                                # frame survives for stage 4.
                                merged_path = hdr_local_path
                                styled_path = hdr_local_path + ".styled.jpg"
                                # Prefer the LEARNED model (the editor's
                                # actual recipe from raw->finished pairs:
                                # brighten + warm). It beat the histogram
                                # 16.8 vs 21.6 and applies color safely
                                # because it's a fixed learned transform,
                                # not a per-image distribution match.
                                # Fall back to the histogram if no learned
                                # model is bundled.
                                styled = apply_learned_path(
                                    merged_path, styled_path, strength=1.0
                                )
                                style_kind = "learned model"
                                if not styled:
                                    styled = match_image_path(
                                        merged_path, profile, styled_path,
                                        strength=0.6,
                                    )
                                    style_kind = "histogram"
                                if styled:
                                    hdr_meta.setdefault("operations", []).append(
                                        f"Style applied ({style_kind})"
                                    )
                                    # Stage 4 — window protection. Composite
                                    # the merged window region back over the
                                    # styled interior so the global LAB remap
                                    # cannot blow the exterior. Per contract:
                                    # window = local region = stage-4 mask,
                                    # never a global stage-5 weight.
                                    # window_protect works in RGB; cv2 is BGR.
                                    merged_bgr = cv2.imread(merged_path)
                                    styled_bgr = cv2.imread(styled_path)
                                    if merged_bgr is not None and styled_bgr is not None:
                                        merged_rgb = cv2.cvtColor(
                                            merged_bgr, cv2.COLOR_BGR2RGB
                                        )
                                        styled_rgb = cv2.cvtColor(
                                            styled_bgr, cv2.COLOR_BGR2RGB
                                        )
                                        final_rgb = protect_windows(
                                            merged_rgb,
                                            styled_rgb,
                                            debug_dir="/tmp/debug",
                                        )
                                        final_bgr = cv2.cvtColor(
                                            final_rgb, cv2.COLOR_RGB2BGR
                                        )
                                        cv2.imwrite(
                                            hdr_local_path,
                                            final_bgr,
                                            [cv2.IMWRITE_JPEG_QUALITY, 95],
                                        )
                                        hdr_meta.setdefault(
                                            "operations", []
                                        ).append("Window protection (stage 4)")
                                        print(
                                            f"Window protection applied for {photo_id}"
                                        )
                                    else:
                                        # Could not reload for compositing;
                                        # fall back to the styled frame so we
                                        # still produce output.
                                        cv2.imwrite(
                                            hdr_local_path,
                                            styled_bgr
                                            if styled_bgr is not None
                                            else merged_bgr,
                                        )
                                    print(
                                        f"Style transfer applied for {photo_id}"
                                    )
                    except Exception as st_err:
                        print(f"Style transfer skipped for {photo_id}: {st_err}")

                # ----- HARD SAFETY NET -----
                # process_photo's internal try/except only covers the
                # main processing block. If anything past it raises
                # (qc_score float() on a malformed value, ai notes
                # builder, status calculation with unexpected keys),
                # the photo would otherwise stay PROCESSING forever
                # while the SQS message retries through to DLQ. This
                # outer wrap guarantees the photo gets a terminal
                # status, an error trail in issues, and the next
                # photo in the batch continues.
                #
                # Customers seeing PROCESSING for 24+ hours was a real
                # symptom (Chris's 27 + TJ's 45 stranded photos
                # 2026-05). Don't remove this wrap.
                try:
                    result = process_photo(
                        row[0],
                        row[1],
                        thresholds,
                        tier=tier,
                        distraction_categories=distraction_categories,
                        pre_processed_local_path=hdr_local_path,
                    )
                    # If HDR merge ran, surface that in fixes_applied and
                    # the issues breadcrumb so the dashboard shows it
                    # alongside the standard auto-fixes.
                    if hdr_local_path and hdr_meta:
                        result.setdefault("fixes_applied", [])
                        result["fixes_applied"] = (
                            list(hdr_meta.get("operations", []))
                            + result["fixes_applied"]
                        )
                        result.setdefault("issues", {})
                        result["issues"]["_hdr_merge"] = {
                            "frame_count": hdr_meta.get("frame_count"),
                            "resolution": list(
                                hdr_meta.get("merged_resolution", ())
                            ),
                        }
                except Exception as photo_err:
                    print(f"Uncaught error in process_photo({photo_id}): {photo_err}")
                    traceback.print_exc()
                    # Fall back to a minimal FLAGGED result so the photo
                    # leaves PROCESSING. The customer sees it in their
                    # FLAGGED bucket with a clear error note and can
                    # manually re-run if needed.
                    result = {
                        "photo_id": photo_id,
                        "s3_key_fixed": None,
                        "status": "FLAGGED",
                        "qc_score": 0.0,
                        "issues": {
                            "processing_error": {
                                "severity": 1.0,
                                "error": str(photo_err)[:500],
                            }
                        },
                        "ai_notes": f"Auto-flagged after engine error: {str(photo_err)[:200]}",
                        "fixes_applied": [],
                        "vertical_dev": None,
                        "horizon_dev": None,
                        "color_temp": None,
                        "exposure": None,
                        "sharpness": None,
                        "saturation": None,
                    }

                try:
                    update_photo_in_db(db, result)
                    db.commit()
                except Exception as db_err:
                    # Final safety: if the DB write itself fails, force
                    # status=FLAGGED via a minimal direct UPDATE so the
                    # photo doesn't stay PROCESSING. Worst case we lose
                    # the rich fix details but the user can act on it.
                    print(f"update_photo_in_db failed for {photo_id}: {db_err}")
                    db.rollback()
                    try:
                        cursor = db.cursor()
                        cursor.execute(
                            """
                            UPDATE "Photo"
                            SET status = 'FLAGGED',
                                "aiNotes" = %s,
                                "updatedAt" = NOW()
                            WHERE id = %s AND status = 'PROCESSING'
                            """,
                            (
                                f"Auto-flagged: DB write failed ({str(db_err)[:140]})",
                                photo_id,
                            ),
                        )
                        cursor.close()
                        db.commit()
                    except Exception as final_err:
                        print(f"Final fallback also failed for {photo_id}: {final_err}")
                        db.rollback()

                # Atomically check if this is the last photo to finish
                # If yes, run finalization (consistency check + property status)
                cursor = db.cursor()
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM "Photo"
                    WHERE "propertyId" = %s AND status = 'PROCESSING'
                    """,
                    (property_id,),
                )
                remaining = cursor.fetchone()[0]
                cursor.close()

                if remaining == 0:
                    # Try to atomically claim the finalization role
                    # Only one Lambda can transition the property from PROCESSING
                    cursor = db.cursor()
                    cursor.execute(
                        """
                        UPDATE "Property"
                        SET status = 'REVIEW'
                        WHERE id = %s AND status = 'PROCESSING'
                        RETURNING id
                        """,
                        (property_id,),
                    )
                    claimed = cursor.fetchone()
                    cursor.close()

                    if claimed:
                        print(f"Finalizing property {property_id}")
                        run_finalization(db, property_id, thresholds)
                        db.commit()
                        print(f"Finalized property {property_id}")
                    else:
                        print(f"Property {property_id} already finalized by another Lambda")

                print(f"Processed photo {photo_id}, {remaining} remaining")

            else:
                # Legacy batch mode (kept for backward compat)
                photo_ids = body.get("photoIds", [])

                cursor = db.cursor()
                cursor.execute(
                    """
                    SELECT id, "s3KeyOriginal" FROM "Photo"
                    WHERE id = ANY(%s)
                    """,
                    (photo_ids,),
                )
                photos = cursor.fetchall()
                cursor.close()

                for photo_id, s3_key in photos:
                    result = process_photo(
                        photo_id,
                        s3_key,
                        thresholds,
                        tier=tier,
                        distraction_categories=distraction_categories,
                    )
                    update_photo_in_db(db, result)

                db.commit()
                run_finalization(db, property_id, thresholds)
                db.commit()
                print(f"Processed {len(photos)} photos for property {property_id}")

    except Exception as e:
        print(f"Handler error: {e}")
        traceback.print_exc()
        db.rollback()
        raise

    finally:
        db.close()

    return {"statusCode": 200}
