"""
Set Consistency Analysis

Compares photos within a property set to detect:
- Color temperature drift between rooms
- Exposure inconsistency
- Style drift (saturation, contrast changes)

Standard: White balance should be consistent within 300K across frames.
"""

import numpy as np


def check_consistency(
    all_metrics: list,
    color_temp_max_variance: float = 300,
) -> dict:
    """
    Check consistency across all photos in a property set.

    Args:
        all_metrics: List of metric dicts from each photo
        color_temp_max_variance: Max allowed color temp variance in Kelvin
    """
    if len(all_metrics) < 2:
        return {"consistent": True, "inconsistent_indices": []}

    # Extract color temperatures
    color_temps = [
        m.get("color_temp", 5500) for m in all_metrics if m.get("color_temp")
    ]
    exposures = [
        m.get("exposure", 0) for m in all_metrics if m.get("exposure") is not None
    ]
    saturations = [
        m.get("saturation", 50) for m in all_metrics if m.get("saturation")
    ]

    inconsistent_indices = [False] * len(all_metrics)

    if len(color_temps) >= 2:
        median_temp = np.median(color_temps)
        for i, m in enumerate(all_metrics):
            temp = m.get("color_temp")
            if temp and abs(temp - median_temp) > color_temp_max_variance:
                inconsistent_indices[i] = True

    if len(exposures) >= 2:
        median_exp = np.median(exposures)
        for i, m in enumerate(all_metrics):
            exp = m.get("exposure")
            if exp is not None and abs(exp - median_exp) > 1.5:
                inconsistent_indices[i] = True

    if len(saturations) >= 2:
        median_sat = np.median(saturations)
        for i, m in enumerate(all_metrics):
            sat = m.get("saturation")
            if sat and abs(sat - median_sat) > 20:
                inconsistent_indices[i] = True

    return {
        "consistent": not any(inconsistent_indices),
        "inconsistent_indices": inconsistent_indices,
        "color_temp_range": (
            round(min(color_temps), 0) if color_temps else None,
            round(max(color_temps), 0) if color_temps else None,
        ),
        "color_temp_variance": (
            round(max(color_temps) - min(color_temps), 0) if color_temps else 0
        ),
    }
