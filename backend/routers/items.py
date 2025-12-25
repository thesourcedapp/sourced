from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
import openai
import os
import json
from backend.config import NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
router = APIRouter()

# Initialize clients
SUPABASE_URL = NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_KEY = SUPABASE_SERVICE_ROLE_KEY
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

openai.api_key = OPENAI_API_KEY


class CreateItemRequest(BaseModel):
    catalog_id: str
    title: str
    image_url: str
    product_url: str | None = None
    seller: str | None = None
    price: str | None = None
    user_id: str


class CreateItemResponse(BaseModel):
    success: bool
    item_id: str | None = None
    message: str
    metadata: dict | None = None


async def check_image_safety(image_url: str) -> bool:
    """
    Check if image is safe using OpenAI moderation.
    Returns True if safe, False if unsafe.
    """
    try:
        # Use OpenAI's moderation API or vision model
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Is this image appropriate and safe? Answer only YES or NO."},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                }
            ],
            max_tokens=10
        )

        answer = response.choices[0].message.content.strip().upper()
        return "YES" in answer

    except Exception as e:
        print(f"Image safety check error: {e}")
        # Fail safe - reject on error
        return False


async def categorize_item(title: str, image_url: str, product_url: str | None, price: str | None) -> dict:
    """
    Categorize item using AI. Returns metadata dict.
    """
    try:
        system_prompt = """You are a fashion expert AI. Categorize clothing items with precision.
Return ONLY valid JSON, no markdown."""

        user_prompt = f"""Analyze this item:

TITLE: {title}
PRICE: {price or 'Unknown'}
URL: {product_url or 'Not provided'}

Return JSON with:
{{
  "category": "tops/bottoms/outerwear/shoes/accessories/dresses/activewear/bags/jewelry/other",
  "subcategory": "specific type",
  "brand": "brand name or null",
  "product_type": "casual/formal/athletic/streetwear",
  "colors": ["array"],
  "primary_color": "main color",
  "material": "material or null",
  "pattern": "pattern or null",
  "style_tags": ["tag1", "tag2"],
  "season": "spring/summer/fall/winter/all-season",
  "formality": "casual/business-casual/formal/athletic",
  "gender": "men/women/unisex",
  "fit_type": "slim/regular/oversized or null",
  "occasion_tags": ["everyday", "work"],
  "price_tier": "budget/mid-range/luxury or null",
  "confidence": 0.95
}}"""

        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                }
            ],
            max_tokens=500,
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        result = response.choices[0].message.content.strip()
        if result.startswith("```json"):
            result = result.replace("```json", "").replace("```", "").strip()

        return json.loads(result)

    except Exception as e:
        print(f"Categorization error: {e}")
        # Return default metadata on error
        return {
            "category": "other",
            "subcategory": "unknown",
            "brand": None,
            "product_type": "casual",
            "colors": ["unknown"],
            "primary_color": "unknown",
            "material": None,
            "pattern": None,
            "style_tags": ["uncategorized"],
            "season": "all-season",
            "formality": "casual",
            "gender": "unisex",
            "fit_type": None,
            "occasion_tags": ["everyday"],
            "price_tier": None,
            "confidence": 0.0
        }


@router.post("/create-catalog-item", response_model=CreateItemResponse)
async def create_catalog_item(request: CreateItemRequest):
    """
    ONE ENDPOINT TO RULE THEM ALL

    Does everything:
    1. Verifies user owns catalog
    2. Checks image safety
    3. Categorizes with AI
    4. Inserts to database

    Returns: Success + item data with metadata
    """

    try:
        # 1. Verify ownership
        catalog = supabase.table('catalogs').select('owner_id').eq('id', request.catalog_id).single().execute()

        if not catalog.data:
            raise HTTPException(status_code=404, detail="Catalog not found")

        if catalog.data['owner_id'] != request.user_id:
            raise HTTPException(status_code=403, detail="You don't own this catalog")

        # 2. Check image safety
        is_safe = await check_image_safety(request.image_url)

        if not is_safe:
            raise HTTPException(
                status_code=400,
                detail="Image contains inappropriate content"
            )

        # 3. Categorize with AI
        metadata = await categorize_item(
            title=request.title,
            image_url=request.image_url,
            product_url=request.product_url,
            price=request.price
        )

        # 4. Insert to database WITH metadata
        item_data = {
            'catalog_id': request.catalog_id,
            'title': request.title,
            'image_url': request.image_url,
            'product_url': request.product_url,
            'seller': request.seller,
            'price': request.price,
            # AI metadata
            'category': metadata.get('category'),
            'subcategory': metadata.get('subcategory'),
            'brand': metadata.get('brand'),
            'product_type': metadata.get('product_type'),
            'colors': metadata.get('colors'),
            'primary_color': metadata.get('primary_color'),
            'material': metadata.get('material'),
            'pattern': metadata.get('pattern'),
            'style_tags': metadata.get('style_tags'),
            'season': metadata.get('season'),
            'formality': metadata.get('formality'),
            'gender': metadata.get('gender'),
            'fit_type': metadata.get('fit_type'),
            'occasion_tags': metadata.get('occasion_tags'),
            'price_tier': metadata.get('price_tier'),
            'categorization_confidence': metadata.get('confidence')
        }

        result = supabase.table('catalog_items').insert(item_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create item")

        return CreateItemResponse(
            success=True,
            item_id=result.data[0]['id'],
            message="Item created successfully",
            metadata=metadata
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))