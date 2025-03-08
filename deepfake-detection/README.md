# Deep-fake detection model

## Installing dependencies
```
pip install -r requirements.txt
```

## Run command to start flask server
```
python app.py
```

## Using api
```
curl -X POST http://127.0.0.1:5000/predict -F "image=@path/to/your/image.jpg"
```

## Understand input and output
**Input** :  An image file in formats like .jpg, .jpeg, .png, etc.

**Output** : prediction - An integer representing the predicted class.
         heatmap_image - A Base64-encoded string representing the Grad-CAM heatmap overlay.


**e.g.** {
    "prediction": 1,
    "heatmap_image": "/9j/4AAQSkZJRgABAQAAAQABAAD...."
}


Prediction 0 -> Fake
Prediction 1 -> Real

## U need to decode the base64 to display the image
### Decoding logic
Refer to the example_decode file if unsure


