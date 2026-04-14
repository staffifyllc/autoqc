"""
Style Profile Learning

Analyzes a set of "approved" reference photos to learn an agency's
editing style. Extracts statistical parameters for:
- Color temperature (average, min, max, std dev)
- Saturation levels
- Contrast curves
- Exposure patterns
- Vertical precision

These parameters become the baseline for QC checks.
"""

import json
import os
import tempfile

import boto3
import cv2
import numpy as np
import psycopg2

from checks.color import estimate_color_temperature
from checks.verticals import check_verticals
from checks.sharpness import check_sharpness
from checks.exposure import check_exposure

s3 = boto3.client("s3")
BUCKET = os.environ["AWS_S3_BUCKET"]
DB_URL = os.environ["DATABASE_URL"]


def download_photo(s3_key: str) -> str:
    suffix = "." + s3_key.split(".")[-1]
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    s3.download_file(BUCKET, s3_key, tmp.name)
    return tmp.name


def analyze_reference_photo(image_path: str) -> dict:
    """Extract style parameters from a single reference photo."""
    img = cv2.imread(image_path)
    if img is None:
        return {}

    # Color temperature
    color_temp = estimate_color_temperature(img)

    # Saturation
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    saturation = float(np.mean(hsv[:, :, 1]) / 255 * 100)

    # Contrast (standard deviation of luminance)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    contrast = float(np.std(gray))

    # Exposure
    exp_result = check_exposure(image_path)
    exposure = exp_result["exposure"]

    # Sharpness
    sharp_result = check_sharpness(image_path)
    sharpness = sharp_result["sharpness"]

    # Vertical precision
    vert_result = check_verticals(image_path)
    vertical_dev = vert_result["deviation"]

    return {
        "color_temp": color_temp,
        "saturation": saturation,
        "contrast": contrast,
        "exposure": exposure,
        "sharpness": sharpness,
        "vertical_dev": vertical_dev,
    }


def learn_profile(profile_id: str, reference_keys: list) -> dict:
    """
    Analyze all reference photos and compute style parameters.

    Returns computed averages, mins, maxes, and recommended tolerances.
    """
    all_params = []

    for s3_key in reference_keys:
        try:
            local_path = download_photo(s3_key)
            params = analyze_reference_photo(local_path)
            if params:
                all_params.append(params)
            os.unlink(local_path)
        except Exception as e:
            print(f"Error analyzing {s3_key}: {e}")
            continue

    if not all_params:
        return {"error": "No reference photos could be analyzed"}

    # Compute statistics
    def stat(key):
        values = [p[key] for p in all_params if key in p]
        if not values:
            return None, None, None, None
        return (
            float(np.mean(values)),
            float(np.min(values)),
            float(np.max(values)),
            float(np.std(values)),
        )

    ct_avg, ct_min, ct_max, ct_std = stat("color_temp")
    sat_avg, sat_min, sat_max, sat_std = stat("saturation")
    con_avg, con_min, con_max, con_std = stat("contrast")
    exp_avg, exp_min, exp_max, exp_std = stat("exposure")
    sharp_avg, _, _, _ = stat("sharpness")
    vert_avg, _, vert_max, _ = stat("vertical_dev")

    # Set tolerances based on the std dev of reference photos
    # (wider variance in references = more tolerant QC)
    vertical_tolerance = max(vert_max or 1.0, 0.5)

    return {
        "color_temp_avg": ct_avg,
        "color_temp_min": ct_min - (ct_std or 0) if ct_min else None,
        "color_temp_max": ct_max + (ct_std or 0) if ct_max else None,
        "saturation_avg": sat_avg,
        "saturation_min": max(sat_min - (sat_std or 5), 0) if sat_min else None,
        "saturation_max": min(sat_max + (sat_std or 5), 100) if sat_max else None,
        "contrast_avg": con_avg,
        "contrast_min": con_min,
        "contrast_max": con_max,
        "exposure_avg": exp_avg,
        "exposure_min": exp_min - 0.5 if exp_min else None,
        "exposure_max": exp_max + 0.5 if exp_max else None,
        "sharpness_threshold": sharp_avg * 0.6 if sharp_avg else 100.0,
        "vertical_tolerance": round(vertical_tolerance, 2),
        "photos_analyzed": len(all_params),
    }


def handler(event, context):
    """Lambda handler for profile learning jobs."""
    db = psycopg2.connect(DB_URL)

    try:
        body = json.loads(event.get("body", "{}"))
        profile_id = body["profileId"]

        cursor = db.cursor()
        cursor.execute(
            'SELECT "referencePhotos" FROM "StyleProfile" WHERE id = %s',
            (profile_id,),
        )
        row = cursor.fetchone()
        if not row:
            return {"statusCode": 404, "body": "Profile not found"}

        reference_keys = row[0]
        if not reference_keys:
            return {"statusCode": 400, "body": "No reference photos"}

        # Learn the profile
        result = learn_profile(profile_id, reference_keys)

        if "error" in result:
            return {"statusCode": 400, "body": result["error"]}

        # Update the profile in the database
        cursor.execute(
            """
            UPDATE "StyleProfile" SET
                "colorTempAvg" = %s,
                "colorTempMin" = %s,
                "colorTempMax" = %s,
                "saturationAvg" = %s,
                "saturationMin" = %s,
                "saturationMax" = %s,
                "contrastAvg" = %s,
                "contrastMin" = %s,
                "contrastMax" = %s,
                "exposureAvg" = %s,
                "exposureMin" = %s,
                "exposureMax" = %s,
                "sharpnessThreshold" = %s,
                "verticalTolerance" = %s,
                "updatedAt" = NOW()
            WHERE id = %s
            """,
            (
                result["color_temp_avg"],
                result["color_temp_min"],
                result["color_temp_max"],
                result["saturation_avg"],
                result["saturation_min"],
                result["saturation_max"],
                result["contrast_avg"],
                result["contrast_min"],
                result["contrast_max"],
                result["exposure_avg"],
                result["exposure_min"],
                result["exposure_max"],
                result["sharpness_threshold"],
                result["vertical_tolerance"],
                profile_id,
            ),
        )
        db.commit()
        cursor.close()

        print(f"Profile {profile_id} learned from {result['photos_analyzed']} photos")

        return {
            "statusCode": 200,
            "body": json.dumps(result),
        }

    except Exception as e:
        print(f"Profile learning error: {e}")
        db.rollback()
        return {"statusCode": 500, "body": str(e)}

    finally:
        db.close()
