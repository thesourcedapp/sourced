from qdrant_client import QdrantClient
from qdrant_client.models import PointsSelector



client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
print("Connected to Qdrant cloud")

# Delete all points in the collection
client.delete_collection(collection_name=COLLECTION_NAME)
print(f"✅ Collection '{COLLECTION_NAME}' has been deleted.")
