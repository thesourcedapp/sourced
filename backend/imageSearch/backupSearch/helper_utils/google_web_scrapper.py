import asyncio
import requests
from playwright.async_api import async_playwright
from backend.config import SERPAPI_KEY


def serpapi_shopping_search(query: str, limit: int):
    """Get top products from SerpAPI Google Shopping search, skipping eBay/Poshmark sellers."""
    url = "https://serpapi.com/search"

    params = {
        "engine": "google_shopping",
        "q": query,
        "api_key": SERPAPI_KEY,
        "hl": "en",
        "gl": "us"
    }

    response = requests.get(url, params=params)
    data = response.json()

    results = data.get("shopping_results", [])
    cleaned = []

    for item in results[:limit]:
        seller = item.get("source", "").lower()
        if "ebay" in seller or "poshmark" in seller:
            continue  # skip these sellers

        google_product_link = (
            item.get("product_link") or
            (item.get("rich_product_summary") or {}).get("product_link")
        )

        cleaned.append({
            "name": item.get("title"),
            "seller": item.get("source"),
            "price": item.get("price"),
            "image": item.get("thumbnail"),
            "product_link": google_product_link,  # temporary for Playwright
        })

    return cleaned


async def get_first_seller_href(product_link: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"]
        )
        page = await browser.new_page()

        await page.goto(product_link, wait_until="networkidle")

        # Force lazy-loaded sections
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(1)

        selectors = [
            '[jsname="wN9W3"]',
            'a[href*="/shopping/product"]',
            'a[href^="http"]'
        ]

        seller_href = None

        for _ in range(5):  # retry loop
            for selector in selectors:
                try:
                    locator = page.locator(selector)
                    if await locator.count() > 0:
                        seller_href = await locator.first.get_attribute("href")
                        if seller_href:
                            break
                except:
                    pass

            if seller_href:
                break

            await asyncio.sleep(1)

        await browser.close()

        if not seller_href:
            raise RuntimeError("Failed to extract seller href")

        return seller_href


async def get_real_seller_urls_for_items(items):
    """Given a list of SerpAPI items, get real seller URLs using Playwright."""
    results = []
    for item in items:
        if not item.get("product_link"):
            continue

        real_url = await get_first_seller_href(item["product_link"])
        results.append({
            "name": item["name"],
            "seller": item["seller"],
            "price": item["price"],
            "image": item["image"],
            "real_url": real_url
        })
    return results


def scrape_items(query: str, limit: int):
    """Main function: get structured shopping items with real seller URLs, skipping eBay/Poshmark."""
    items = serpapi_shopping_search(query, limit)
    formatted_items = asyncio.run(get_real_seller_urls_for_items(items))
    return formatted_items

