from backend.catalogs.supabase_client import supabase
from backend.catalogs.helpers import contains_banned_language, image_is_safe
from uuid import uuid4



def create_catalog(owner_id: str, title: str, image: str, visibility="public"):
    # 1️⃣ Check title
    if contains_banned_language(title):
        raise ValueError("Catalog title contains banned language")

    # 2️⃣ Check image
    if not image_is_safe(image):
        raise ValueError("Image violates content guidelines")

    # 3️⃣ Insert into Supabase
    result = supabase.table("catalogs").insert({
        "id": str(uuid4()),
        "owner_id": owner_id,
        "title": title,
        "image_url": image,
        "visibility": visibility,
    }).execute()

    return result.data[0]


def delete_catalog(catalog_id: str):
    response = supabase.table("catalogs") \
        .delete() \
        .eq("id", catalog_id) \
        .execute()

    return response.data

def add_item_to_catalog(
    catalog_id: str,
    name: str,
    seller: str,
    image_url: str | None = None,
    url: str | None = None,
):
    # 1️⃣ Check name
    if contains_banned_language(name):
        raise ValueError("Invalid item name")

    # 2️⃣ Check image (only if provided)
    if image_url and not image_is_safe(image_url):
        raise ValueError("Image violates content guidelines")

    # 3️⃣ Insert item
    result = supabase.table("catalog_items").insert({
        "catalog_id": catalog_id,
        "name": name,
        "seller": seller,
        "image_url": image_url,
        "url": url,
    }).execute()

    return result.data[0]


def delete_item_from_catalog(item_id: str):
    """
    Delete a single item from a catalog by item ID.
    """

    res = (
        supabase.table("catalog_items")
        .delete()
        .eq("id", item_id)
        .execute()
    )

    return res.data

def get_items_in_catalog(catalog_id: str):
    res = supabase.table("catalog_items") \
        .select("*") \
        .eq("catalog_id", catalog_id) \
        .order("created_at", desc=False) \
        .execute()

    return res.data

def display_catalogs(owner_id: str, include_private: bool = True):

    res = (
        supabase.table("catalogs")
        .select("id, title, image_url, visibility, created_at")
        .eq("owner_id", owner_id)
        .order("created_at", desc=True)
        .execute()
    )

    return res.data


def create_profile(user_id: str, username: str, full_name: str, avatar_url: [str] = None):
    """
    Create a profile in the profiles table

    Args:
        user_id: The user's ID from Supabase auth
        username: Unique username
        full_name: User's full name
        avatar_url: Optional URL to avatar image

    Returns:
        The created profile data
    """
    try:
        # Check if profile already exists
        existing = supabase.table("profiles").select("id").eq("id", user_id).execute()
        if existing.data and len(existing.data) > 0:
            raise ValueError("Profile already exists")

        # Prepare profile data
        profile_data = {
            "id": user_id,
            "username": username,
            "full_name": full_name,
        }

        if avatar_url:
            profile_data["avatar_url"] = avatar_url

        # Insert into profiles table
        result = supabase.table("profiles").insert(profile_data).execute()

        if not result.data:
            raise Exception("Failed to create profile")

        return result.data[0]

    except Exception as e:
        raise Exception(f"Error creating profile: {str(e)}")
