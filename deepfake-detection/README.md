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

