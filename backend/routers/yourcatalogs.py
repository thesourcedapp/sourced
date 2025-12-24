from fastapi import APIRouter, File, UploadFile, Form
from fastapi.responses import JSONResponse
from typing import Optional
from pydantic import BaseModel
import sys
from pathlib import Path

# Go up TWO levels to reach Sourced folder
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.imageSearch.backupSearch.helper_utils.search_helper_utils import upload_image_bytes_and_get_url
from backend.catalogs.base_functions import (
    create_catalog,
    display_catalogs,
    delete_catalog
)

owner_id = ""
router = APIRouter()


class Catalog(BaseModel):
    id: str
    owner_id: str
    title: str
    image_url: str
    visibility: str


@router.get("/list")
def list_catalogs(owner_id: str, include_private: bool = True):
    """Get all catalogs for a user"""
    try:
        catalogs = display_catalogs("22ca65f1-8a37-4836-bd94-69f90ab57b60", include_private)
        return catalogs
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.delete("/delete/{catalog_id}")
def delete_catalog_endpoint(catalog_id: str):
    """Delete a catalog"""
    try:
        result = delete_catalog(catalog_id)
        return {"success": True, "data": result}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/create")
async def create_catalog_endpoint(
        title: str = Form(...),
        owner_id: str = Form(...),
        visibility: str = Form("public"),
        image_type: str = Form(...),
        image_url: Optional[str] = Form(None),
        image: Optional[UploadFile] = File(None)
):
    try:
        final_image_url = None

        if image_type == "url":
            if not image_url:
                return JSONResponse(status_code=400, content={"error": "Image URL is required"})
            final_image_url = image_url

        elif image_type == "file":
            if not image:
                return JSONResponse(status_code=400, content={"error": "No image file provided"})

            image_bytes = await image.read()
            final_image_url = upload_image_bytes_and_get_url(image_bytes)

            if not final_image_url:
                return JSONResponse(status_code=500, content={"error": "Failed to upload image"})
        else:
            return JSONResponse(status_code=400, content={"error": "Invalid image type"})

        catalog_data = create_catalog(
            owner_id=owner_id,
            title=title,
            image=final_image_url,
            visibility=visibility
        )

        return catalog_data

    except ValueError as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=400, content={"error": str(e)})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})