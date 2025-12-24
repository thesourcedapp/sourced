import requests
import re
from urllib.parse import urlparse
from backend.config import FIRECRAWL_API_KEY

API_KEY = FIRECRAWL_API_KEY


def clean_title(title: str) -> str:
    if not title:
        return ""
    return re.split(r"[|\-–]+", title)[0].strip()


def extract_seller(url: str) -> str:
    if not url:
        return ""

    netloc = urlparse(url).netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]

    return netloc.split(".")[0]


def scrape(query: str, max_items: int = 6):
    endpoint = "https://api.firecrawl.dev/v2/search"

    payload = {
        "query": query,
        "sources": ["images"],
        "limit": max_items * 2  # overfetch to handle filtering
    }

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    response = requests.post(endpoint, json=payload, headers=headers)

    if response.status_code != 200:
        print("❌ Firecrawl API error:", response.text)
        return []

    image_results = response.json().get("data", {}).get("images", [])

    final_items = []
    seen_urls = set()

    for item in image_results:
        if len(final_items) >= max_items:
            break

        item_url = item.get("url")
        img = item.get("imageUrl")
        title = clean_title(item.get("title"))

        if not item_url or not img:
            continue

        # Basic sanity check (avoid Google cache / junk)
        parsed = urlparse(item_url)
        if not parsed.scheme.startswith("http"):
            continue

        if item_url in seen_urls:
            continue

        final_items.append({
            "name": title,
            "item_url": item_url,
            "image_url": img,
            "seller": extract_seller(item_url)
        })

        seen_urls.add(item_url)

    return final_items
