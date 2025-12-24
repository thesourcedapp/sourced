from backend.imageSearch.backupSearch.helper_utils.google_web_scrapper import scrape
from backend.imageSearch.backupSearch.helper_utils.search_helper_utils import image_to_search_query, upload_image_bytes_and_get_url


def fe_image_to_search(image):
    imagen = upload_image_bytes_and_get_url(image)
    query = image_to_search_query(imagen)
    return scrape(query)
