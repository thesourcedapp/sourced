from backend.imageSearch.backupSearch.helper_utils.search_helper_utils import upload_image_bytes_and_get_url

with open("//dataset/testPhotos/IMG_9936 2.JPG", "rb") as f:
    image_bytes = f.read()

image_url = upload_image_bytes_and_get_url(image_bytes)

print(image_url)