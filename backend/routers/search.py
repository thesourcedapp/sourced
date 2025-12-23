from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse
from typing import List
from pydantic import BaseModel
import sys
from pathlib import Path

# Go up TWO levels to reach Sourced folder
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.imageSearch.backupSearch.main_utils.image_to_web import fe_image_to_search

router = APIRouter()

class Product(BaseModel):
    name: str
    price: str
    seller: str
    image_url: str
    item_url: str

@router.post("/search", response_model=List[Product])
def search(file: UploadFile = File(...)):
    try:
        image_bytes = file.file.read()
        items = fe_image_to_search(image_bytes)

        products = [
            {
                "name": item.get("name", ""),
                "price": item.get("price", ""),
                "seller": item.get("seller", ""),
                "image_url": item.get("image") or item.get("thumbnail") or "",
                "item_url": item.get("real_url") or item.get("product_link") or "",
            }
            for item in items
        ]

        return products

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})