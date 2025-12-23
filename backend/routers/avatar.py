from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
import httpx
import re
import base64
from backend.config import OPENAI_API_KEY
router = APIRouter()

client = OpenAI(
    api_key=OPENAI_API_KEY)


class ImageCheckRequest(BaseModel):
    image_url: str


class ImageCheckResponse(BaseModel):
    safe: bool
    error: str | None = None


def is_data_uri(url: str) -> bool:
    """Check if string is a data URI"""
    return url.startswith('data:image/')


def is_valid_http_url(url: str) -> bool:
    """Check if string is a valid HTTP/HTTPS URL"""
    return url.startswith('http://') or url.startswith('https://')


@router.post("/check-image", response_model=ImageCheckResponse)
async def check_image(request: ImageCheckRequest):
    """
    Check if image is safe using OpenAI moderation API
    """
    image_url = request.image_url.strip()

    if not image_url:
        raise HTTPException(status_code=400, detail="Invalid image URL")

    print(f"🔍 Checking image (length: {len(image_url)} chars)")

    try:
        # If it's already a data URI, use it directly
        if is_data_uri(image_url):
            print(f"📊 Using provided data URI")
            data_uri = image_url

        # If it's a valid HTTP URL, download it
        elif is_valid_http_url(image_url):
            print(f"📥 Downloading from URL: {image_url[:100]}...")

            async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as http_client:
                response = await http_client.get(
                    image_url,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                )

                print(f"📊 Response status: {response.status_code}")
                response.raise_for_status()

                # Verify it's actually an image
                content_type = response.headers.get('content-type', '')
                if not content_type.startswith('image/'):
                    print(f"❌ Not an image! Content-Type: {content_type}")
                    return ImageCheckResponse(
                        safe=False,
                        error="URL does not point to an image"
                    )

                # Get image bytes and convert to base64
                image_bytes = response.content
                base64_image = base64.b64encode(image_bytes).decode('utf-8')
                data_uri = f"data:{content_type};base64,{base64_image}"

                print(f"✓ Image downloaded successfully ({len(image_bytes)} bytes)")
        else:
            print(f"❌ Invalid URL format")
            return ImageCheckResponse(
                safe=False,
                error="Please provide a valid image URL (http:// or https://)"
            )

        # Send to OpenAI moderation
        print(f"🤖 Sending to OpenAI moderation...")
        moderation_response = client.moderations.create(
            model="omni-moderation-latest",
            input=[
                {
                    "type": "image_url",
                    "image_url": {
                        "url": data_uri
                    }
                }
            ]
        )

        result = moderation_response.results[0]
        print(f"📊 Moderation result - flagged: {result.flagged}")

        if result.flagged:
            flagged_categories = [cat for cat, flagged in result.categories.__dict__.items() if flagged]
            print(f"🚫 Blocked image - categories: {flagged_categories}")
            return ImageCheckResponse(
                safe=False,
                error="Image contains inappropriate content"
            )

        print(f"✅ Approved image")
        return ImageCheckResponse(safe=True)

    except httpx.TimeoutException:
        print(f"❌ Timeout downloading image")
        return ImageCheckResponse(
            safe=False,
            error="Image download timed out"
        )
    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP error: {e.response.status_code}")
        return ImageCheckResponse(
            safe=False,
            error=f"Failed to download image (HTTP {e.response.status_code})"
        )
    except httpx.RequestError as e:
        print(f"❌ Request error: {str(e)}")
        return ImageCheckResponse(
            safe=False,
            error="Failed to download image - check URL format"
        )
    except Exception as e:
        print(f"❌ Unexpected error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return ImageCheckResponse(
            safe=False,
            error="Failed to verify image safety"
        )