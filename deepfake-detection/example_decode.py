import base64
from io import BytesIO
from PIL import Image

heatmap_base64 = result["heatmap_image"]
heatmap_bytes = base64.b64decode(heatmap_base64)
heatmap_image = Image.open(BytesIO(heatmap_bytes))
heatmap_image.show()  # Display the image
heatmap_image.save("heatmap_output.jpg")  # Save the image
