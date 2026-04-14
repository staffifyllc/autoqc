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

from fixes.vertical_fix import fix_verticals
from fixes.color_fix import fix_color
from fixes.horizon_fix import fix_horizon
from fixes.sharpness_fix import fix_sharpness
from fixes.ai_deblur import ai_deblur

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
    """Upload a fixed photo to S3."""
    fixed_key = s3_key.replace("/original/", "/fixed/")
    s3.upload_file(local_path, BUCKET, fixed_key)
    return fixed_key


def get_profile_thresholds(db, agency_id: str, client_profile_id: str = None):
    """Get QC thresholds from the agency's style profile and optional client overrides."""
    cursor = db.cursor()

    # Default thresholds based on real estate photography industry standards
    thresholds = {
        "vertical_tolerance": 1.0,      # degrees - industry standard is 0.5-1.0
        "horizon_tolerance": 0.5,        # degrees
        "color_temp_min": 3500,          # Kelvin
        "color_temp_max": 6500,          # Kelvin
        "color_temp_consistency": 300,   # Max Kelvin variance across a set
        "exposure_min": -1.0,            # EV
        "exposure_max": 1.5,             # EV
        "saturation_min": 15,            # percentage
        "saturation_max": 85,            # percentage
        "sharpness_threshold": 100.0,    # Laplacian variance
        "halo_max_px": 5,               # max halo width in pixels
        "chromatic_aberration_threshold": 2.0,  # pixel fringe width
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
        weight = weights.get(issue_key, 5)
        # Severity is 0-1, where 1 is worst
        if isinstance(severity, dict):
            sev = severity.get("severity", 0.5)
        else:
            sev = float(severity) if severity else 0.5
        deductions += weight * sev

    score = max(0, 100 - (deductions / total_weight * 100))
    return round(score, 1)


def process_photo(
    photo_id: str,
    s3_key: str,
    thresholds: dict,
    all_photo_data: list = None,
) -> dict:
    """Run all QC checks on a single photo."""
    local_path = download_photo(s3_key)
    issues = {}
    metrics = {}
    fixes_applied = []
    ai_notes = None
    fixed_s3_key = None

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

        # === AI COMPOSITION CHECK (Claude Vision) ===

        # 11. Composition analysis via Claude Vision API
        comp_result = check_composition(local_path)
        ai_notes = comp_result.get("analysis", "")
        for issue_key in ["reflection", "toilet_visible", "clutter", "composition"]:
            if comp_result.get(issue_key):
                issues[issue_key] = {
                    "severity": comp_result[issue_key]["severity"],
                    "detail": comp_result[issue_key].get("detail", ""),
                }

        # === AUTO-FIX ===
        needs_fix = False

        # Fix verticals if off by more than tolerance but less than 5 degrees
        if "vertical_tilt" in issues and vert_result["deviation"] < 5.0:
            fixed_path = fix_verticals(local_path, vert_result["deviation"], vert_result["direction"])
            if fixed_path:
                local_path = fixed_path
                fixes_applied.append(f"Vertical corrected ({vert_result['deviation']:.1f} deg)")
                needs_fix = True

        # Fix horizon if off
        if "horizon_tilt" in issues and horiz_result["deviation"] < 3.0:
            fixed_path = fix_horizon(local_path, horiz_result["deviation"])
            if fixed_path:
                local_path = fixed_path
                fixes_applied.append(f"Horizon leveled ({horiz_result['deviation']:.1f} deg)")
                needs_fix = True

        # Fix color temperature if out of range
        if "color_temp" in issues:
            fixed_path = fix_color(local_path, color_result)
            if fixed_path:
                local_path = fixed_path
                fixes_applied.append(f"White balance corrected ({color_result['color_temp']:.0f}K)")
                needs_fix = True

        # Fix sharpness - three-tier approach:
        # 1. Barely soft (80-100): local unsharp mask (free, instant)
        # 2. Moderately soft (50-80): AI deblur via Replicate (~$0.001, better results)
        # 3. Heavy blur (<50): try AI deblur but likely unrecoverable
        if "soft_focus" in issues:
            sharpness_val = sharp_result["sharpness"]

            if sharpness_val >= 80:
                # Barely soft - local sharpening is sufficient and free
                fixed_path, description = fix_sharpness(local_path, sharpness_val)
                if fixed_path:
                    local_path = fixed_path
                    fixes_applied.append(description)
                    needs_fix = True
            elif sharpness_val >= 30:
                # Moderately soft - try AI deblur first (better quality for this range)
                fixed_path, description = ai_deblur(local_path, sharpness_val)
                if fixed_path:
                    local_path = fixed_path
                    fixes_applied.append(description)
                    needs_fix = True
                else:
                    # AI deblur failed or unavailable, fall back to local sharpening
                    fixed_path, description = fix_sharpness(local_path, sharpness_val)
                    if fixed_path:
                        local_path = fixed_path
                        fixes_applied.append(description)
                        needs_fix = True
            # Below 30: too blurry, flagged for reshoot (no fix attempted)

        # Upload fixed version
        if needs_fix:
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

    # Calculate QC score
    qc_score = calculate_qc_score(issues, checks_run=12)

    # Determine status
    FIXABLE_ISSUES = {"vertical_tilt", "horizon_tilt", "color_temp", "soft_focus"}
    if len(issues) == 0:
        status = "PASSED"
    elif fixes_applied and all(k in FIXABLE_ISSUES for k in issues.keys()):
        status = "FIXED"
    else:
        status = "FLAGGED"

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


def handler(event, context):
    """AWS Lambda handler. Processes SQS messages."""
    db = get_db()

    try:
        for record in event.get("Records", []):
            body = json.loads(record["body"])
            property_id = body["propertyId"]
            agency_id = body["agencyId"]
            photo_ids = body["photoIds"]
            client_profile_id = body.get("clientProfileId")

            # Get thresholds
            thresholds = get_profile_thresholds(db, agency_id, client_profile_id)

            # Get photo S3 keys
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

            # Process each photo
            all_results = []
            for photo_id, s3_key in photos:
                result = process_photo(photo_id, s3_key, thresholds)
                all_results.append(result)
                update_photo_in_db(db, result)

            # Run set consistency check
            if len(all_results) > 1:
                consistency_results = check_consistency(
                    [r["metrics"] for r in all_results],
                    thresholds["color_temp_consistency"],
                )
                # Flag inconsistent photos
                for i, is_inconsistent in enumerate(consistency_results.get("inconsistent_indices", [])):
                    if is_inconsistent and all_results[i]["status"] == "PASSED":
                        all_results[i]["issues"]["consistency"] = {
                            "severity": 0.5,
                            "detail": "Color temperature differs significantly from the rest of the set",
                        }
                        all_results[i]["status"] = "FLAGGED"
                        all_results[i]["qc_score"] = calculate_qc_score(
                            all_results[i]["issues"], 12
                        )
                        update_photo_in_db(db, all_results[i])

            # Update property status
            update_property_status(db, property_id)
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
