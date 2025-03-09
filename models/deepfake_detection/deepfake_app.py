import io
import os
import base64
import cv2
import torch
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify
from torchvision import transforms
from network.models import model_selection
from dataset.transform import xception_default_data_transforms

app = Flask(__name__)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = 'deepfake_detection/pretrained_model/14_finetuned_xception.pkl'
model = model_selection(modelname='xception', num_out_classes=2, dropout=0.5)
model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
if isinstance(model, torch.nn.DataParallel):
    model = model.module
model.to(device)
model.eval()

target_layer = model.model.block8 

class GradCAM:
    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        self._register_hooks()

    def _register_hooks(self):
        def forward_hook(module, input, output):
            self.activations = output.detach()

        def backward_hook(module, grad_input, grad_output):
            self.gradients = grad_output[0].detach()

        self.target_layer.register_forward_hook(forward_hook)
        self.target_layer.register_backward_hook(backward_hook)

    def generate_heatmap(self, input_tensor, class_idx=None):
        output = self.model(input_tensor)
        if class_idx is None:
            class_idx = output.argmax(dim=1).item()

        self.model.zero_grad()
        one_hot = torch.zeros_like(output)
        one_hot[0, class_idx] = 1
        output.backward(gradient=one_hot, retain_graph=True)

        grads = self.gradients  # (B, C, H, W)
        acts = self.activations  # (B, C, H, W)

        weights = grads.mean(dim=(2, 3), keepdim=True)
        cam = torch.sum(weights * acts, dim=1, keepdim=True)
        cam = torch.relu(cam)
        cam = cam.squeeze().cpu().numpy()

        cam -= np.min(cam)
        cam /= (np.max(cam) + 1e-8)
        return cam

grad_cam = GradCAM(model, target_layer)
transform = xception_default_data_transforms['test']

def overlay_heatmap_on_image(original_img, heatmap, alpha=0.5, colormap=cv2.COLORMAP_JET):
    heatmap = cv2.resize(heatmap, (original_img.shape[1], original_img.shape[0]))
    heatmap = np.uint8(255 * heatmap)
    heatmap = cv2.applyColorMap(heatmap, colormap)
    overlay = cv2.addWeighted(original_img, 1 - alpha, heatmap, alpha, 0)
    return overlay

@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400

    file = request.files['image']
    try:
        pil_img = Image.open(file.stream).convert("RGB")
    except Exception as e:
        return jsonify({'error': 'Invalid image file'}), 400

    image_tensor = transform(pil_img).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(image_tensor)
        _, pred = torch.max(outputs, 1)
    prediction = pred.item()

    heatmap = grad_cam.generate_heatmap(image_tensor, class_idx=prediction)
    orig_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    overlay = overlay_heatmap_on_image(orig_img, heatmap)

    # Encode overlay image as JPEG and then to base64
    _, buffer = cv2.imencode('.jpg', overlay)
    overlay_bytes = buffer.tobytes()
    overlay_base64 = base64.b64encode(overlay_bytes).decode('utf-8')

    response = {
        'prediction': prediction,
        'heatmap_image': overlay_base64
    }
    return jsonify(response)
