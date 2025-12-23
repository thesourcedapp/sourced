from qdrant_client import QdrantClient
from qdrant_client.models import PointsSelector


#Authorization
QDRANT_URL = "https://77cba74c-2354-4dad-91fa-dfd55f032cbb.us-east4-0.gcp.cloud.qdrant.io"
QDRANT_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.HkUrGA1QsrF5_bH3j8iFtzSxLXhdj7GTfoiFy8WPVvU"

#name of database
COLLECTION_NAME = "clothing_database"


client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
print("Connected to Qdrant cloud")

# Delete all points in the collection
client.delete_collection(collection_name=COLLECTION_NAME)
print(f"✅ Collection '{COLLECTION_NAME}' has been deleted.")