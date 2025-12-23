from openai import OpenAI
from backend.config import OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL


client = OpenAI(api_key=OPENAI_API_KEY)

import uuid
import mimetypes
from supabase import create_client


BUCKET = "image-search"
SUPABASE_URL = NEXT_PUBLIC_SUPABASE_URL
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def upload_image_bytes_and_get_url(
    image_bytes: bytes,
    filename: str = "image.jpg",
) -> str:
    assert image_bytes, "Empty image bytes"

    ext = filename.split(".")[-1] if "." in filename else "jpg"
    object_name = f"{uuid.uuid4()}.{ext}"

    content_type, _ = mimetypes.guess_type(filename)
    content_type = content_type or "image/jpeg"

    # 🚨 upload() throws on failure — no error object
    supabase.storage.from_(BUCKET).upload(
        object_name,
        image_bytes,
        {"content-type": content_type},
    )

    # If we reached here, upload succeeded
    public_url = supabase.storage.from_(BUCKET).get_public_url(object_name)

    assert public_url.startswith("http"), "Invalid public URL"

    return public_url


def image_to_search_query(image_url: str) -> str | None:
    prompt = """
You are a fashion-only product recognition expert.

Your job:
1. Look at the image.
2. If the image contains ANY clothing item (shirt, hoodie, jacket, pants, shorts, shoes, accessories like hats/bags), return the BEST search query for that clothing item.
3. If the image does NOT clearly show a clothing item, respond with EXACTLY: "NOT_CLOTHING"

Search query rules:
- Identify likely brand (commit)
- Identify graphics, logos, text, colors, garment type
- Keep it concise & optimized for search engines
- No extra words. ONLY the search query.

If it is NOT clothing → return ONLY "NOT_CLOTHING".
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]
            }
        ]
    )

    output = response.choices[0].message.content.strip()

    # 🔥 Hard enforcement — prevents accidental false positives
    if output.upper() == "NOT_CLOTHING":
        return None

    return output