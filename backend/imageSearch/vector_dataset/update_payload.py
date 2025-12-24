from qdrant_client import QdrantClient
from qdrant_client.http.models import PayloadSchemaType



client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

def add_filterable_fields():
    """
    Adds filterable indexes to the existing Qdrant collection.
    Assumes 'client' and 'COLLECTION_NAME' are already defined.
    """
    filterable_fields = [
        "item_linker_id",
        "name"
    ]

    for field in filterable_fields:
        try:
            client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name=field,
                field_type=PayloadSchemaType.KEYWORD  # correct parameter for string fields
            )
            print(f"✅ Created index for field: {field}")
        except Exception as e:
            print(f"⚠️ Could not create index for {field}: {e}")


def get_item(point_id):
    """Return the item (payload + vector) from Qdrant using its point ID."""
    point = client.get_point(collection_name=COLLECTION_NAME, id=point_id)
    return {
        "id": point.id,
        "payload": point.payload,
        "vector": point.vector
    }
