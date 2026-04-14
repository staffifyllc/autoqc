"""
AI Composition Analysis via Claude Vision API

Uses Claude's vision capabilities to detect semantic quality issues
that algorithmic checks can't catch:
- Photographer reflections in mirrors/windows/appliances
- Toilet lids up
- Clutter and personal items
- Cropped fixtures (half a chandelier, partial doorframe)
- Poor framing or room coverage
- Pets in frame
"""

import base64
import os

import anthropic


def check_composition(image_path: str) -> dict:
    """
    Send the image to Claude Vision for semantic composition analysis.
    Returns detected issues with severity scores.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"analysis": "Claude Vision API key not configured"}

    # Read and encode image
    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    # Determine media type
    ext = image_path.lower().split(".")[-1]
    media_type_map = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }
    media_type = media_type_map.get(ext, "image/jpeg")

    client = anthropic.Anthropic(api_key=api_key)

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=500,
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
                        {
                            "type": "text",
                            "text": """You are a real estate photography QC system. Analyze this property photo for quality issues.

Check for these specific issues and respond in JSON format:

1. "reflection" - Is the photographer or camera visible in any reflective surface (mirrors, windows, appliances, TV screens)?
2. "toilet_visible" - Is a toilet visible with the lid up?
3. "clutter" - Is there significant clutter, personal items, or mess that should have been staged/removed?
4. "composition" - Are there composition problems like cropped fixtures (partial chandelier, half doorframe), poor framing, or awkward angles?

For each issue found, provide:
- "detected": true/false
- "severity": 0.0-1.0 (0 = minor, 1 = severe)
- "detail": brief description

Also provide:
- "room_type": what room this appears to be
- "overall_notes": any other quality observations

Respond ONLY with valid JSON, no markdown.""",
                        },
                    ],
                }
            ],
        )

        # Parse the response
        import json

        try:
            result = json.loads(response.content[0].text)
        except json.JSONDecodeError:
            return {"analysis": response.content[0].text}

        output = {"analysis": result.get("overall_notes", "")}

        for key in ["reflection", "toilet_visible", "clutter", "composition"]:
            if result.get(key, {}).get("detected", False):
                output[key] = {
                    "severity": result[key].get("severity", 0.5),
                    "detail": result[key].get("detail", ""),
                }

        return output

    except Exception as e:
        return {"analysis": f"Vision API error: {str(e)}"}
