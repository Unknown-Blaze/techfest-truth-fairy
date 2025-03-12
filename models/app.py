import base64
import cv2
import numpy as np
import requests
from PIL import Image
import openai
import os
import torch
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from factcheck_model.rag_brave_pipeline import search_brave
from factcheck_model.retrieve_time import get_publish_date
from deepfake_detection.deepfake_app import model, transform, grad_cam, overlay_heatmap_on_image, device
from flask_cors import CORS
from io import BytesIO
from werkzeug.utils import secure_filename
from statistics import mode
import dlib  # For face detection

app = Flask(__name__)
CORS(app)
load_dotenv()

# Makes the request from a web browser client instead of our system, bypassing restrictions
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

api_key = os.getenv("OPENAI_KEY")
if api_key is None:
    raise ValueError(
        "API key is missing! Ensure you have set OPENAI_KEY in your .env file."
    )

@app.route("/fact-check", methods=["POST"])
def fact_check():
    data = request.json
    flagged_text = data.get("text", "")
    flagged_url = data.get("url", "")

    if not flagged_text:
        return jsonify({"error": "flagged_text is required"}), 400

    # Initialize OpenAI client with the API key
    client = openai.OpenAI(api_key=api_key)

    # First completion - Generating Query for Search API by invoking model
    search_query_completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You will receive textual data that users have flagged on the internet as possible sources of misinformation."
                "You will function as a generator for my search API. I need the user's highlighted text to be transformed into a web query such that the information inside the text can be validated by searching for relevant articles on the Internet."
                "The query should only transform what's present within the textual data and should not manufacture any details."
                "For example, if the statement reads: 'Joe Biden is the president of the U.S.', you need to transform and give me the question: Who is the president of the United States? Understood.",
            },
            {"role": "user", "content": flagged_text},
        ],
    )

    query = search_query_completion.choices[0].message.content
    results = search_brave(query)

    # Increase search context to the first five result descriptions returned by the search API
    search_context = "\n".join([result["description"] for result in results[:5]])
    timestamp = get_publish_date(url=flagged_url)

    full_context = (
        "Additional Context:"
        + search_context
        + "\nUser Flagged Text: "
        + flagged_text
        +"\nTimestamp:"
        + timestamp if timestamp is not None else "N/A"
        + "\n"
        + f"Article Information was derived from: {flagged_url}"
    )

    # Make the API call correctly
    fact_check_completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "Your function is that of a lie detector. I will pass additional context to inform your decision, followed by user-highlighted annotations of information widely available on the internet."
                "Users have flagged this text for a possible instance of misinformation. I need you to verify if this information is indeed misinformation or if it's real."
                "When fact-checking, ensure you cross-reference the flagged statement with multiple trusted and up-to-date sources to verify its validity. Avoid relying on a single source unless absolutely necessary."
                "For statements regarding facts that can change over time (e.g., rankings, statistics, or leadership positions), always check if the current data contradicts the claim, but also take into account the publication date of the source to assess if the statement was true at the time of publishing."
                "If the timestamp is N/A, disregard it. Otherwise, you should check whether the flagged statement is true or false as of the date it was written."
                "There's a possibility that the user-highlighted text requires context present within the article, hence you will see the webpage linked under 'Article Information was derived from:' as well to further influence your decisions."
                "Your decision should be made after consulting the additional context provided in the prompt, which could possibly influence your final decision."
                "Even though you consult the context, your focus is purely on validating the user flagged text."
                "The statements made in the additional context are entirely valid, as they're retrieved from current-day search engines. You should not try to falsify those."
                "As of right now, your response should only elicit one of three categories: [Real, Fake, Cannot Verify]."
                "Cannot verify should especially be used in situations where the highlighted text cannot be factually verified or in and of itself doesn't contain a statement that can be fact checked."
                "e.g. The user can highlight opinionated text, which should not proceed through your analysis and should be marked as Cannot Verify."
                "You need to follow your response with justification of how you arrived at that conclusion."
                "I need you to find and return the sources/links validating your justification, so users will know."
                "Please make your justification not more than 3 sentences long."
                "If the text is verified as Real or Fake, I need you to provide the specific sub-text you found to be misinformation and return that in the JSON as well. The sub-text should simply be a substring of the original text, do not paraphrase anything. If it's unverifiable, leave the string empty."
                "The output returned needs to be strictly in the JSON format provided: {'category': Chosen one from this list ['Real', 'Fake', 'Cannot Verify'], 'justification': provided justification, 'sources': a list of sources found on the relevant topics, 'subtext': subtext}",
            },
            {"role": "user", "content": full_context},
        ],
    )

    return fact_check_completion.choices[0].message.content


# Get Bounding Box from Face
def get_boundingbox(face, width, height, scale=1.3, minsize=None):
    x1 = face.left()
    y1 = face.top()
    x2 = face.right()
    y2 = face.bottom()
    size_bb = int(max(x2 - x1, y2 - y1) * scale)
    if minsize and size_bb < minsize:
         size_bb = minsize
    center_x = (x1 + x2) // 2
    center_y = (y1 + y2) // 2
    x1 = max(int(center_x - size_bb // 2), 0)
    y1 = max(int(center_y - size_bb // 2), 0)
    size_bb = min(width - x1, size_bb)
    size_bb = min(height - y1, size_bb)
    return x1, y1, size_bb

@app.route('/predict', methods=['POST'])
def predict():
    if 'imageUrl' not in request.json:
        return jsonify({'error': 'No URL provided'}), 400

    media_url = request.json['imageUrl']
    print(f"media_url: {media_url}")

    # Reject blob: URLs or missing scheme
    if media_url.startswith("blob:"):
        return jsonify({
            'error': "blob: URLs are not accessible from the server. Please send a direct HTTP/HTTPS link or upload the file/base64 data."
        }), 400

    if not (media_url.startswith("http://") or media_url.startswith("https://")):
        return jsonify({
            'error': "Invalid URL scheme. Must start with http:// or https://"
        }), 400

    try:
        response = requests.get(media_url, headers=headers, stream=True, timeout=15)
        if response.status_code != 200:
            return jsonify({'error': f'Failed to download media, status code {response.status_code}'}), 400
    except requests.exceptions.RequestException as e:
        return jsonify({'error': 'Failed to fetch media', 'details': str(e)}), 400

    content_type = response.headers.get('Content-Type', '').lower()
    if 'video' in content_type or media_url.lower().endswith(('.mp4', '.avi', '.mov')):
        # --- VIDEO PROCESSING ---
        try:
            video_temp_path = secure_filename('temp_video.mp4')
            with open(video_temp_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
        except Exception as e:
            return jsonify({'error': 'Invalid video file', 'details': str(e)}), 400

        cap = cv2.VideoCapture(video_temp_path)
        if not cap.isOpened():
            os.remove(video_temp_path)
            return jsonify({'error': 'OpenCV could not open the downloaded video'}), 400

        # Initialize dlib face detector
        face_detector = dlib.get_frontal_face_detector()

        predictions = []
        heatmap_frames = []
        frame_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_count += 1
            height, width = frame.shape[:2]
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_detector(gray, 1)
            # If a face is detected, process it; otherwise, skip the frame
            if len(faces) > 0:
                face = faces[0]  # Taking the first detected face
                x, y, size = get_boundingbox(face, width, height)
                if x < 0 or y < 0 or x+size > width or y+size > height:
                    continue
                cropped_face = frame[y:y+size, x:x+size]
                # Convert cropped face to PIL image for transformation
                pil_img = Image.fromarray(cv2.cvtColor(cropped_face, cv2.COLOR_BGR2RGB))
                image_tensor = transform(pil_img).unsqueeze(0).to(device)
                with torch.no_grad():
                    outputs = model(image_tensor)
                    _, pred = torch.max(outputs, 1)
                predictions.append(pred.item())

                # Generate Grad-CAM heatmap and overlay it on the cropped face
                heatmap = grad_cam.generate_heatmap(image_tensor, class_idx=pred.item())
                overlay_crop = overlay_heatmap_on_image(cropped_face, heatmap)
                # Place the processed crop back into the frame
                frame[y:y+size, x:x+size] = overlay_crop
                # Annotate the frame with a bounding box and label
                label = "fake" if pred.item() == 1 else "real"
                color = (0, 0, 255) if pred.item() == 1 else (0, 255, 0)
                cv2.rectangle(frame, (x, y), (x+size, y+size), color, 2)
                cv2.putText(frame, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
            heatmap_frames.append(frame.copy())

        cap.release()
        os.remove(video_temp_path)
        if len(predictions) == 0:
            return jsonify({'error': 'No faces detected in video'}), 400

        overall_prediction = mode(predictions) if predictions else None

        # Write processed frames into a new video file
        if heatmap_frames:
            height, width, _ = heatmap_frames[0].shape
            video_output_path = 'temp_output_video.avi'
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
            out = cv2.VideoWriter(video_output_path, fourcc, 20.0, (width, height))
            for frm in heatmap_frames:
                out.write(frm)
            out.release()

            with open(video_output_path, 'rb') as f:
                video_bytes = f.read()
            video_base64 = base64.b64encode(video_bytes).decode('utf-8')
            os.remove(video_output_path)
        else:
            video_base64 = None

        return jsonify({'prediction': overall_prediction, 'heatmap_video': video_base64})

    elif 'image' in content_type:
        # --- IMAGE PROCESSING ---
        try:
            image_bytes = BytesIO(response.content)
            pil_img = Image.open(image_bytes).convert("RGB")
        except Exception as e:
            return jsonify({'error': 'Invalid image file', 'details': str(e)}), 400

        image_tensor = transform(pil_img).unsqueeze(0).to(device)
        with torch.no_grad():
            outputs = model(image_tensor)
            _, pred = torch.max(outputs, 1)
        prediction = pred.item()

        heatmap = grad_cam.generate_heatmap(image_tensor, class_idx=prediction)
        orig_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        overlay = overlay_heatmap_on_image(orig_img, heatmap)

        _, buffer = cv2.imencode('.jpg', overlay)
        overlay_bytes = buffer.tobytes()
        overlay_base64 = base64.b64encode(overlay_bytes).decode('utf-8')

        return jsonify({'prediction': prediction, 'heatmap_image': overlay_base64})

    else:
        return jsonify({'error': f'Unsupported media type: {content_type}'}), 400

if __name__ == "__main__":
    app.run(debug=True)
