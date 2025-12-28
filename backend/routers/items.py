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


async def categorize_item(title: str, image_url: str, product_url: str | None, price: str | None) -> dict:
    """
    Categorize item using AI and verify it's actually a fashion item.
    Returns metadata dict with is_fashion_item flag.
    """
    try:
        system_prompt = """You are a fashion expert AI. Categorize fashion items with precision.
IMPORTANT: First determine if this is actually a FASHION item. Fashion includes:
- Clothing (shirts, pants, dresses, etc.)
- Footwear (shoes, sneakers, boots, sandals)
- Accessories (bags, belts, hats, scarves, gloves)
- Jewelry (rings, necklaces, bracelets, earrings)
- Eyewear (sunglasses, glasses)
- Watches
- Hair accessories
- Any wearable fashion item

NOT fashion: furniture, food, electronics (unless wearable tech like smartwatches), home decor, cars, etc.
Return ONLY valid JSON, no markdown."""

        user_prompt = f"""Analyze this item:

TITLE: {title}
PRICE: {price or 'Unknown'}
URL: {product_url or 'Not provided'}

Return JSON with:
{{
  "is_fashion_item": true/false (Is this a wearable fashion item?),
  "category": "tops/bottoms/outerwear/shoes/accessories/dresses/activewear/bags/jewelry/eyewear/watches/other",
  "subcategory": "specific type",
  "brand": "brand name or null",
  "product_type": "casual/formal/athletic/streetwear/luxury",
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
}}

If is_fashion_item is false, still provide best-guess values for other fields but they won't be used."""

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
            "is_fashion_item": True,  # Assume it's fashion on error to not block legitimate items
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
    2. Categorizes with AI (includes fashion item verification)
    3. Inserts to database

    Accepts all fashion items: clothing, shoes, bags, accessories, jewelry, watches, eyewear, etc.

    Returns: Success + item data with metadata
    """

    try:
        # 1. Verify ownership
        catalog = supabase.table('catalogs').select('owner_id').eq('id', request.catalog_id).single().execute()

        if not catalog.data:
            raise HTTPException(status_code=404, detail="Catalog not found")

        if catalog.data['owner_id'] != request.user_id:
            raise HTTPException(status_code=403, detail="You don't own this catalog")

        # 2. Categorize with AI (includes fashion item check)
        metadata = await categorize_item(
            title=request.title,
            image_url=request.image_url,
            product_url=request.product_url,
            price=request.price
        )

        # 3. Verify it's actually a fashion item
        if not metadata.get('is_fashion_item', True):
            raise HTTPException(
                status_code=400,
                detail="This doesn't appear to be a fashion item. Sourced is for fashion and wearable items only."
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