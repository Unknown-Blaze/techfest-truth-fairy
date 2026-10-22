# Meet **Truth Fairy** 🧚 – Your Chrome Extension Ally Against Misinformation

Chrome extension that fact-checks highlighted text and flags manipulated images with a deepfake detector explained by Grad-CAM; Top 5 at NTU TechFest.

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Chrome extension](https://img.shields.io/badge/Chrome-extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions)
[![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![Flask](https://img.shields.io/badge/Flask-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Top 5](https://img.shields.io/badge/Top%205%20%C2%B7%20NTU%20TechFest-Truth%20Fairy-FFB000?style=flat-square)](#)

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
# Create and activate the virtual environment
python -m venv env
source env/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install backend dependencies
cd extension/backend
npm install
cd ../..
```

---

## 🏃‍♂️ Running the App

Follow these steps to launch the application:

1. **Create a .env file with the following content**
```bash
# Create a .env file and add the OPEN_AI and BRAVE_API keys. Ask a maintainer for the API keys.
OPENAI_KEY = "ACTUAL OPENAI API KEY"
BRAVE_API_KEY = "ACTUAL BRAVE API KEY"
``` 

2. **Start the Backend Server:**  
```bash
cd extension/backend
node index.js

#It'll prompt you for firebase_credentials.json, ask a maintainer for it, then rerun the node command.
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
2. Click **Load Unpacked** and select the `extension/frontend` folder.
3. Enjoy safer browsing and join the conversation!

---

## 📥 Pretrained Weights

Download the pretrained weights here:  
[Pretrained Weights on Google Drive](https://drive.google.com/drive/folders/16bI7-2H2FaCOE0FTw4ZaRdpsJIzT4EjZ?usp=sharing)

---

Feel free to contribute and help us build a more truthful online community!

