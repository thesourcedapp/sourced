from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
import unicodedata
import re

router = APIRouter()

# Leet speak mapping
LEET_MAP = {
    "0": "o", "1": "i", "3": "e", "4": "a",
    "5": "s", "7": "t", "@": "a", "$": "s",
}


def load_banned_words() -> set[str]:
    """Load banned words from file"""
    path = Path(__file__).resolve().parent.parent / "catalogs" / "bannedwords.txt"

    banned = set()
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                word = line.strip().lower()
                if word and not word.startswith("#"):
                    banned.add(word)
        print(f"✅ Loaded {len(banned)} banned words")
    except FileNotFoundError:
        print(f"⚠️ Warning: bannedwords.txt not found at {path}")

    return banned


BANNED_WORDS = load_banned_words()


def normalize(text: str) -> str:
    """Normalize text to detect obfuscated banned words"""
    text = text.lower()
    text = unicodedata.normalize("NFKD", text)

    for k, v in LEET_MAP.items():
        text = text.replace(k, v)

    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    return text


def contains_banned_word(username: str) -> bool:
    """Check if username contains any banned words"""
    normalized = normalize(username)

    # Check each banned word
    for banned in BANNED_WORDS:
        if banned in normalized:
            print(f"🚫 Blocked username '{username}' - matched: {banned}")
            return True

    # Check without spaces (catches concatenated words)
    no_spaces = normalized.replace(" ", "")
    for banned in BANNED_WORDS:
        if banned in no_spaces:
            print(f"🚫 Blocked username '{username}' - matched: {banned}")
            return True

    return False


class UsernameCheckRequest(BaseModel):
    username: str


class UsernameCheckResponse(BaseModel):
    safe: bool
    error: str | None = None


@router.post("/check-username", response_model=UsernameCheckResponse)
async def check_username(request: UsernameCheckRequest):
    """
    Check if username is safe (doesn't contain banned words)
    """
    username = request.username

    if not username or not isinstance(username, str):
        raise HTTPException(status_code=400, detail="Invalid username")

    # Check for banned words
    is_banned = contains_banned_word(username)

    if is_banned:
        return UsernameCheckResponse(
            safe=False,
            error="Username contains inappropriate content"
        )

    print(f"✅ Approved username: '{username}'")
    return UsernameCheckResponse(safe=True)