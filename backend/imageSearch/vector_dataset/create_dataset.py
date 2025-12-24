from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance



# important variables
COLLECTION_NAME = "clothing_database"
VECTOR_SIZE = 512 # depends on what Clip you use
DISTANCE_METRIC = Distance.COSINE


# Connect to Qdrant Cloud
client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY,)

if client.collection_exists(COLLECTION_NAME):
    print(f"✅ Collection '{COLLECTION_NAME}' already exists — skipping creation.")
else:
    print(f"⚙️ Creating new collection: {COLLECTION_NAME}")
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=VECTOR_SIZE, distance=DISTANCE_METRIC)
    )
    print(f"✅ Collection '{COLLECTION_NAME}' created successfully!")
