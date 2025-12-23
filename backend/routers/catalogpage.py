from fastapi import APIRouter, Form
from fastapi.responses import JSONResponse
from typing import Optional, List
from pydantic import BaseModel
import sys
from pathlib import Path

# Go up TWO levels to reach Sourced folder
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.catalogs.base_functions import (
    get_items_in_catalog,
    add_item_to_catalog
)

router = APIRouter()


class CatalogItem(BaseModel):
    id: str
    catalog_id: str
    name: str
    seller: str
    image_url: Optional[str]
    url: Optional[str]


@router.get("/{catalog_id}")
def get_catalog_detail(catalog_id: str):
    """Get details of a specific catalog"""
    try:
        from backend.catalogs.supabase_client import supabase

        result = supabase.table("catalogs") \
            .select("*") \
            .eq("id", catalog_id) \
            .execute()

        if not result.data or len(result.data) == 0:
            return JSONResponse(status_code=404, content={"error": "Catalog not found"})

        return result.data[0]
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/{catalog_id}/items")
def get_catalog_items_endpoint(catalog_id: str):
    """Get all items in a catalog"""
    try:
        items = get_items_in_catalog(catalog_id)
        return items
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/{catalog_id}/items")
async def add_item_endpoint(
        catalog_id: str,
        name: str = Form(...),
        seller: str = Form(...),  # Add seller field
        image_url: Optional[str] = Form(None),
        url: Optional[str] = Form(None)
):
    """Add an item to a catalog"""
    try:
        item = add_item_to_catalog(
            catalog_id=catalog_id,
            name=name,
            seller=seller,  # Pass seller
            image_url=image_url,
            url=url
        )
        return item
    except ValueError as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.delete("/items/{item_id}")
def delete_item_endpoint(item_id: str):
    """Delete a single item from catalog"""
    try:
        from backend.catalogs.supabase_client import supabase

        res = supabase.table("catalog_items") \
            .delete() \
            .eq("id", item_id) \
            .execute()

        return {"success": True, "data": res.data}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/items/delete-multiple")
async def delete_multiple_items_endpoint(item_ids: List[str]):
    """Delete multiple items at once"""
    try:
        from backend.catalogs.supabase_client import supabase

        res = supabase.table("catalog_items") \
            .delete() \
            .in_("id", item_ids) \
            .execute()

        return {"success": True, "deleted_count": len(item_ids), "data": res.data}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})