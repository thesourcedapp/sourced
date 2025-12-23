from pathlib import Path
from openai import OpenAI
from backend.config import OPENAI_API_KEY
import re
import unicodedata


ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

LEET_MAP = {
    "0": "o", "1": "i", "3": "e", "4": "a",
    "5": "s", "7": "t", "@": "a", "$": "s",
}

client = OpenAI(api_key=OPENAI_API_KEY)


def load_banned_words() -> set[str]:
    path = Path(__file__).parent / "bannedwords.txt"

    banned = set()
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            word = line.strip().lower()
            if word and not word.startswith("#"):
                banned.add(word)

    return banned

BANNED_WORDS = load_banned_words()



def normalize(text: str) -> str:
    text = text.lower()
    text = unicodedata.normalize("NFKD", text)

    for k, v in LEET_MAP.items():
        text = text.replace(k, v)

    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    return text

def image_is_safe(image_url: str) -> bool:
    """
    Returns True if image is safe, False if flagged.
    """
    response = client.moderations.create(
        model="omni-moderation-latest",
        input=image_url,
    )

    result = response.results[0]

    # flagged == True means unsafe
    return not result.flagged

def contains_banned_language(text: str) -> bool:
    normalized = normalize(text)

    tokens = normalized.split(" ")

    # exact token match
    for token in tokens:
        if token in BANNED_WORDS:
            return True

    # substring match (important for compound words)
    for banned in BANNED_WORDS:
        if banned in normalized:
            return True

    return False
