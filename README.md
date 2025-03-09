
# Meet **Truth Fairy** 🧚 – Your Chrome Extension Ally Against Misinformation

Truth Fairy empowers you to spot misinformation as you browse. Whether it’s a suspicious text snippet or a manipulated image, our extension brings the truth to light—fast and fun!

---

## ✨ Key Features
- **Instant Verification ✅/❌:** Simply highlight content. If it’s false, it turns red; if true, it briefly glows green with extra info.
- **Image Analysis 👁️:** Our enhanced deep learning model, powered by explainable AI (using Grad-CAM), detects deepfakes and highlights manipulated regions.
- **Community Engagement 💬:** Join real-time discussions and view fact-checked comments via our built-in panel.
- **Misinformation Scoring 📊:** Each statement is scored to indicate its reliability.


---

## 🚀 Setup Environment

Set up your development environment with the following commands:

```bash
# Create and activate the conda environment
conda create --name truth_fairy python=3.12
conda activate truth_fairy

# Install dependencies
npm install
pip install -r requirements.txt
```

---

## 🏃‍♂️ Running the App

Follow these steps to launch the application:

1. **Configure Environment:**  
   Create a `.env` file with your OpenAI key.

2. **Start the Backend Server:**  
   ```bash
   cd extension/backend
   node index.js
   ```

3. **Start the Deepfake Detection Server:**  
   ```bash
   cd ../..
   cd models/deepfake_detection
   # Place the pretrained weights in the 'pretrained_model' folder (see link below)
   pip install .
   cd ..
   python app.py
   ```

Now both servers are up and running!

---

## 🧩 Using the Extension

1. Open **Google Chrome** and go to **Manage Extensions**.
2. Click **Load Unpacked** and select the `Truth Fairy` folder.
3. Enjoy safer browsing and join the conversation!

---

## 📥 Pretrained Weights

Download the pretrained weights here:  
[Pretrained Weights on Google Drive](https://drive.google.com/drive/folders/16bI7-2H2FaCOE0FTw4ZaRdpsJIzT4EjZ?usp=sharing)

---

Feel free to contribute and help us build a more truthful online community!

