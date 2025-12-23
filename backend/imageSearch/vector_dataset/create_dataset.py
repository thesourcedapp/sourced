from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance

QDRANT_URL = "https://77cba74c-2354-4dad-91fa-dfd55f032cbb.us-east4-0.gcp.cloud.qdrant.io"
QDRANT_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.HkUrGA1QsrF5_bH3j8iFtzSxLXhdj7GTfoiFy8WPVvU"

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