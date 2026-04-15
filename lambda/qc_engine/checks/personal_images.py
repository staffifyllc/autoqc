"""
Personal Image Detection

Uses Claude Vision to detect framed photos, personal images, kids/family
photos, diplomas with names, and other privacy-sensitive items that need
to be blurred in real estate listing photos.

Returns approximate bounding boxes (as 0-1 normalized coordinates) that
the blur fix can apply Gaussian blur to.
"""

import base64
import json
import os

import anthropic


DETECTION_PROMPT = """Identify any PRIVATE / PERSONAL items in this real estate photo that must be blurred before the property is listed publicly.

Items that SHOULD be blurred:
- Framed family photos, portraits, wedding pictures
- Pictures of children, kids' artwork, school photos on fridges
- Personal photos (pets with owners, vacation shots, personal portraits)
- Framed certificates, diplomas, awards with visible names
- Personal documents or papers with visible text
- Religious portraits of identifiable people
- Personal trophies or sports pictures with names
- Calendars showing names/events
- Memo boards with personal info

Items that should NOT be blurred:
- Generic artwork (landscapes, abstract art, stock photos)
- Framed mirrors
- Decorative posters without people
- Decorative prints of non-personal subjects
- Wall hangings without identifiable people

Return JSON with this exact schema:

{
  "has_personal": true | false,
  "regions": [
    {
      "type": "family_photo" | "child_photo" | "portrait" | "diploma_with_name" | "personal_document" | "pet_with_owner" | "other_personal",
      "description": "brief description of what was detected",
      "bbox": {
        "x": 0.0-1.0,
        "y": 0.0-1.0,
        "width": 0.0-1.0,
        "height": 0.0-1.0
      },
      "confidence": 0.0-1.0
    }
  ],
  "summary": "brief description of what needs blurring"
}

Coordinates are normalized 0-1 where (0,0) is top-left and (1,1) is bottom-right.
Pad the bbox slightly (+5% each side) to ensure the blur fully covers the item.
Only include regions with confidence >= 0.7.
Return ONLY valid JSON, no markdown."""


def detect_personal_images(image_path: str) -> dict:
    """
    Detect personal/private images in a real estate photo.

    Returns:
        {
          "has_personal": bool,
          "regions": [{type, bbox, confidence, ...}],
          "summary": str
        }
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"has_personal": False, "regions": [], "summary": "API not configured"}

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
            max_tokens=1000,
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
                        {"type": "text", "text": DETECTION_PROMPT},
                    ],
                }
            ],
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
            return {
                "has_personal": False,
                "regions": [],
                "summary": f"Could not parse: {text[:100]}",
            }

        # Filter by confidence threshold
        regions = [
            r for r in parsed.get("regions", [])
            if r.get("confidence", 0) >= 0.7
        ]

        return {
            "has_personal": len(regions) > 0,
            "regions": regions,
            "summary": parsed.get("summary", ""),
        }

    except Exception as e:
        return {
            "has_personal": False,
            "regions": [],
            "summary": f"Detection error: {str(e)[:100]}",
        }
