from setuptools import setup, find_packages
import os

# Ensure the required directories exist
required_dirs = ["pretrained_model", "network", "dataset"]

for directory in required_dirs:
    if not os.path.exists(directory):
        os.makedirs(directory)
        print(f"Created missing directory: {directory}")

setup(
    name="deepfake_detector",
    version="1.0",
    packages=find_packages(),
    install_requires=[
        "flask",
        "torch",
        "torchvision",
        "pillow",
        "numpy",
        "opencv-python"
    ],
    include_package_data=True,
    description="Deepfake Detection API with Grad-CAM visualization",
    author="Your Name",
    author_email="your.email@example.com",
    url="https://github.com/Unknown-Blaze/techfest-truth-fairy",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
