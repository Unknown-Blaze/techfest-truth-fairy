// contentScript.js
let selectedText = "";
let lastHoveredMedia = null; // will store either an image or video element
let isHoveringMedia = false;
let flagButtonTimeout = null;
const API_BASE_URL = "http://localhost:3000"; // YOUR ACTUAL BACKEND URL
let discussionPanel = null;

window.addEventListener('load', () => {
    fetchFlaggedMedia(); // Fetch flagged images and apply highlight
});

// Function to create and show the "flag" button (modified for media)
const showFlagButton = (x, y) => {
    let flagButton = document.getElementById('flag-text-button');
    let processingButton = document.getElementById('processing-button');

    if (!flagButton) {
        flagButton = document.createElement('button');
        flagButton.id = 'flag-text-button';
        flagButton.innerHTML = '🚩 Flag';
        flagButton.style.position = 'absolute';
        flagButton.style.zIndex = '10000';
        flagButton.style.marginRight = '5px';
        flagButton.addEventListener('click', () => {
            if (lastHoveredMedia) {
                if (lastHoveredMedia.tagName === 'IMG') {
                    handleImageFlag(lastHoveredMedia);
                } else if (lastHoveredMedia.tagName === 'VIDEO') {
                    handleVideoFlag(lastHoveredMedia);
                }
                lastHoveredMedia = null;
                isHoveringMedia = false;
            } else if (selectedText) {
                handleFlagClick();
            }
        });
        document.body.appendChild(flagButton);
    }

    if (!processingButton) {
        processingButton = document.createElement('button');
        processingButton.id = 'processing-button';
        processingButton.innerHTML = 'Processing...';
        processingButton.style.position = 'absolute';
        processingButton.style.zIndex = '10000';
        processingButton.style.padding = '8px 12px';
        processingButton.style.border = 'none';
        processingButton.style.background = '#007bff';
        processingButton.style.color = 'white';
        processingButton.style.borderRadius = '5px';
        processingButton.style.cursor = 'not-allowed';
        processingButton.style.fontSize = '14px';
        processingButton.style.fontWeight = 'bold';
        processingButton.style.display = 'none'; // Initially hidden
        document.body.appendChild(processingButton);
    }

    flagButton.style.left = `${x}px`;
    flagButton.style.top = `${y}px`;
    flagButton.style.display = 'block';

    processingButton.style.left = `${x - 120}px`; // Position next to Flag button
    processingButton.style.top = `${y}px`;
};

// Function to hide the "flag" button (No changes here)
const hideFlagButton = () => {
    const flagButton = document.getElementById('flag-text-button');
    if (flagButton) {
        flagButton.style.display = 'none';
    }
};

// Function to show the "Processing..." button
const showProcessingButton = () => {
    const processingButton = document.getElementById('processing-button');
    if (processingButton) {
        processingButton.style.display = 'block';
    }
};

// Function to hide the "Processing..." button
const hideProcessingButton = () => {
    const processingButton = document.getElementById('processing-button');
    if (processingButton) {
        processingButton.style.display = 'none';
    }
};

const AI_API_URL = "http://127.0.0.1:5000/fact-check"; // AI Model API
const IMAGE_API_URL = "http://127.0.0.1:5000/predict"; // Image (or media) Model API
const BACKEND_API_URL = "http://localhost:3000/store_analysis"; // Your backend API

const hideContextMenu = () => {
    let contextMenu = document.getElementById('credibility-context-menu');
    if (contextMenu) {
        contextMenu.remove();
    }
};

// Modify applyHighlight so it takes 3 arguments (no changes here)
const applyHighlight = (credibilityScore, justification, sources, text, category) => {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');

    const hue = category == "Fake" ? 0 : (category == "Real" ? 100 : 60);
    const saturation = 100;
    const lightness = 75;

    span.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    span.title = `Category: ${category}`;
    span.classList.add('credibility-highlight');
    span.dataset.originalText = text; // Store the original text
    console.log("applyHighlight text: ", text);
    addContextMenu(span, justification, sources, text, category);

    try {
        range.surroundContents(span);
        selection.removeAllRanges();
    } catch (e) {
        console.error("Error surrounding contents", e);
    }
};

const handleFlagClick = async (event) => {
    if (!selectedText) return;

    console.log("Flagging text:", selectedText);
    hideFlagButton();
    showProcessingButton();

    try {
        // Step 1: Process text using the AI model first
        console.log("Processing text with AI model...");
        const aiResponse = await fetch(AI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text: selectedText,
                url: window.location.href,
            }),
        });

        const aiData = await aiResponse.json();
        console.log("AI Model Response:", aiData);

        if (!aiData || aiData.error) {
            console.error("Error from AI model:", aiData?.error || "No response");
            return;
        }

        // Step 2: If flagged as fake, store it
        if (aiData.category === "Fake") {
            console.log("Flagging the text as fake...");
            const flagResponse = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    {
                        action: "flagText",
                        selectedText,
                        pageURL: window.location.href,
                        userId: chrome.runtime.id,
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            console.error("Runtime error:", chrome.runtime.lastError.message);
                            reject("Runtime error: " + chrome.runtime.lastError.message);
                        } else {
                            if (response?.credibilityScore !== undefined && aiData.justification && aiData.sources) {
                                console.log("Flagged text successfully:", response);
                                applyHighlight(response.credibilityScore, aiData.justification, aiData.sources, selectedText, aiData.category);
                                resolve(response);
                            } else {
                                console.error("Unexpected response:", response);
                                reject("Unexpected response received");
                            }
                        }
                    }
                );
            });

            console.log("Flag Response received:", flagResponse);

            // Store AI analysis in the backend
            console.log("Storing AI analysis in the database...");
            const storeResponse = await fetch(BACKEND_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text: selectedText,
                    url: window.location.href,
                    category: aiData.category,
                    justification: aiData.justification,
                    sources: aiData.sources,
                    credibilityScore: flagResponse.credibilityScore, // Including credibility score
                    userId: chrome.runtime.id, // Temporary user identifier
                }),
            });

            const storeResult = await storeResponse.json();
            console.log("Stored in database:", storeResult);

            if (!storeResult.success) {
                console.error("Error storing data:", storeResult.message);
            } else {
                console.log("Data stored successfully:", storeResult);
            }
        } else {
            // Step 3: Text is not fake, just highlight it
            console.log("Text is not fake, highlighting it...");
            const flagResponse = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    {
                        action: "highlightText",
                        selectedText,
                        pageURL: window.location.href,
                        userId: chrome.runtime.id,
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            console.error("Runtime error:", chrome.runtime.lastError.message);
                            reject("Runtime error: " + chrome.runtime.lastError.message);
                        } else if (response?.credibilityScore !== undefined) {
                            console.log("Highlighted text successfully:", response);
                            applyHighlight(response.credibilityScore, aiData.justification, aiData.sources, selectedText, aiData.category);
                            resolve(response);
                        } else {
                            console.error("Unexpected response:", response);
                            reject("Unexpected response received");
                        }
                    }
                );
            });

            console.log("Highlight Response received:", flagResponse);
        }
    } catch (error) {
        console.error("Error during flagText or AI processing:", error);
        hideProcessingButton();
        showErrorMessage(error);
    }
    hideProcessingButton();
};

const BACKEND_API_URL2 = "http://localhost:3000/flagImage";

// Existing image flag function (unchanged)
const handleImageFlag = async (imageElement) => {
    console.log("imageElement: ", imageElement);
    console.log("handle image flag");
    hideFlagButton();
    showProcessingButton();

    try {
        // Step 1: Send image URL to AI for analysis
        console.log("Processing image with AI model...");

        const aiResponse = await fetch(IMAGE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                imageUrl: imageElement.src,
                url: window.location.href,
            }),
        });

        const aiData = await aiResponse.json();
        console.log("AI Model Response for image:", aiData);

        if (!aiData || aiData.error) {
            console.error("Error from AI model:", aiData?.error || "No response");
            return;
        }

        // Step 2: Store image and AI analysis in the database
        console.log("Storing AI analysis in the database...");
        const storeResponse = await fetch(BACKEND_API_URL2, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                imageUrl: imageElement.src,
                url: window.location.href,
                prediction: aiData.prediction, // 0 = fake, 1 = real
                heatmap_image: aiData.heatmap_image, // AI heatmap
                userId: chrome.runtime.id, // Temporary user identifier
            }),
        });

        const storeResult = await storeResponse.json();
        console.log("Stored image data in database:", storeResult);

        if (!storeResult.success) {
            console.error("Error storing image data:", storeResult.message);
        } else {
            console.log("Image data stored successfully:", storeResult);
        }

        // Step 3: Highlight image based on AI prediction
        applyImageHighlight(aiData.prediction, imageElement, imageElement.src, aiData.heatmap_image);

    } catch (error) {
        console.error("Error during image processing:", error);
    }

    hideProcessingButton();
};

// ===== New Video Flagging Functions =====

// Handle video flag (similar to image flag but for videos)
const handleVideoFlag = async (videoElement) => {
    console.log("[HANDLE VIDEO FLAG] Video element:", videoElement);
    console.log("[HANDLE VIDEO FLAG] Video source URL:", videoElement.src);
    hideFlagButton();
    showProcessingButton();

    try {
        console.log("[HANDLE VIDEO FLAG] Sending video URL to AI model:", videoElement.src);
        const aiResponse = await fetch(IMAGE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                imageUrl: videoElement.src, // Notice using imageUrl key for both images and videos
                url: window.location.href,
            }),
        });

        const aiData = await aiResponse.json();
        console.log("[HANDLE VIDEO FLAG] AI Model Response for video:", aiData);

        if (!aiData || aiData.error) {
            console.error("[HANDLE VIDEO FLAG] Error from AI model:", aiData?.error || "No response");
            return;
        }

        console.log("[HANDLE VIDEO FLAG] Storing video analysis in the database for video URL:", videoElement.src);
        const storeResponse = await fetch(BACKEND_API_URL2, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                videoUrl: videoElement.src,
                url: window.location.href,
                prediction: aiData.prediction,
                heatmap_image: aiData.heatmap_image,
                userId: chrome.runtime.id,
            }),
        });

        const storeResult = await storeResponse.json();
        console.log("[HANDLE VIDEO FLAG] Stored video data in database:", storeResult);

        if (!storeResult.success) {
            console.error("[HANDLE VIDEO FLAG] Error storing video data:", storeResult.message);
        } else {
            console.log("[HANDLE VIDEO FLAG] Video data stored successfully.");
        }

        // Highlight video based on AI prediction
        console.log("[HANDLE VIDEO FLAG] Highlighting video based on prediction:", aiData.prediction);
        applyVideoHighlight(aiData.prediction, videoElement, videoElement.src, aiData.heatmap_image);
    } catch (error) {
        console.error("[HANDLE VIDEO FLAG] Error during video processing:", error);
    }
    hideProcessingButton();
};


// Apply highlight for videos
// Apply highlight for videos – updated to mimic image UI
const applyVideoHighlight = (prediction, videoElement, videoUrl, heatmap_image) => {
    console.log("Apply video highlight with:", videoUrl);
    if (!videoElement) return;
  
    // Calculate the highlight color
    const hue = (prediction == 1 ? 100 : 0);
    const highlightColor = `hsl(${hue}, 100%, 75%)`;
  
    // Create a wrapper div
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-block";
    // Move the video element into the wrapper instead of cloning:
    videoElement.parentNode.insertBefore(wrapper, videoElement);
    wrapper.appendChild(videoElement);
  
    // Apply a border to the wrapper
    wrapper.style.border = `4px solid ${highlightColor}`;
    wrapper.style.borderRadius = "5px";
  
    // Create an overlay label
    const overlay = document.createElement("div");
    overlay.innerHTML = prediction == 1 || prediction === "Real" 
                          ? `✔️ This video is Real` 
                          : `❌ This video is Fake`;
    overlay.style.position = "absolute";
    overlay.style.top = "4%";
    overlay.style.right = "4%";
    overlay.style.fontWeight = "bold";
    overlay.style.padding = "2px 2px";
    overlay.style.borderRadius = "8px";
    overlay.style.zIndex = "10";
    overlay.style.boxShadow = "2px 2px 8px rgba(0, 0, 0, 0.3)";
    overlay.style.fontFamily = "Poppins";
    // Use the same color scheme as the image overlay:
    if (prediction == 1 || prediction === "Real") {
      overlay.style.backgroundColor = "#d4edda";
      overlay.style.color = "#155724";
    } else {
      overlay.style.backgroundColor = "#f8d7da";
      overlay.style.color = "#721c24";
    }
  
    wrapper.appendChild(overlay);
    // Attach the context menu as before
    addVideoContextMenu(wrapper, prediction, videoUrl, heatmap_image);
  };
  
  
  // Updated video context menu to use same UI as images
  const addVideoContextMenu = (container, prediction, videoUrl, heatmap_image) => {
    container.addEventListener('contextmenu', (event) => {
      event.stopImmediatePropagation();
      event.preventDefault();
  
      // Remove any existing video context menu
      let existingContextMenu = document.getElementById('credibility-video-context-menu');
      if (existingContextMenu) {
        existingContextMenu.remove();
      }
  
      let contextMenu = document.createElement('div');
      contextMenu.id = 'credibility-video-context-menu';
      // Add both generic and specific class for identification
      contextMenu.classList.add('credibility-context-menu', 'credibility-video-context-menu');
  
      // Create a credibility display element with the same style as images
      const credibilityDisplay = document.createElement('div');
      credibilityDisplay.classList.add('credibility-category');
      // Determine if the video is Real or Fake based on prediction
      const credibilityText = (prediction == "1" || prediction == 1 || prediction === "Real") ? "Real" : "Fake";
      if (credibilityText === "Real") {
        credibilityDisplay.innerHTML = `✔️ This video is ${credibilityText}`;
        credibilityDisplay.style.backgroundColor = "#d4edda"; // Green background
        credibilityDisplay.style.color = "#155724"; // Dark green text
      } else {
        credibilityDisplay.innerHTML = `❌ This video is ${credibilityText}`;
        credibilityDisplay.style.backgroundColor = "#f8d7da"; // Red background
        credibilityDisplay.style.color = "#721c24"; // Dark red text
      }
      credibilityDisplay.classList.add('context-menu-item');
      contextMenu.appendChild(credibilityDisplay);
  
      // Discuss button – when clicked, open the discussion panel (video version uses same panel as image)
      const discussOption = document.createElement('button');
      discussOption.innerHTML = '💬 Discuss';
      discussOption.classList.add('context-menu-button');
      discussOption.addEventListener('click', (e) => {
        e.stopPropagation();
        showVideoDiscussionPanel(videoUrl, heatmap_image);
        contextMenu.remove();
      });
      contextMenu.appendChild(discussOption);
  
      document.body.appendChild(contextMenu);
      contextMenu.style.left = `${event.pageX}px`;
      contextMenu.style.top = `${event.pageY}px`;
      contextMenu.style.display = 'block';
    });
  
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.credibility-video-context-menu')) {
        let contextMenu = document.getElementById('credibility-video-context-menu');
        if (contextMenu) contextMenu.remove();
      }
    });
  };
  


// ===== End of Video Flagging Functions =====

// Function to show error message (no changes)
function showErrorMessage(error) {
    const modal = document.createElement('div');
    modal.id = 'error-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.3s ease';

    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = '#fff';
    modalContent.style.padding = '40px';
    modalContent.style.borderRadius = '15px';
    modalContent.style.maxWidth = '400px';
    modalContent.style.width = '100%';
    modalContent.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
    modalContent.style.textAlign = 'center';
    modalContent.style.fontFamily = "Garamond";

    const modalTitle = document.createElement('h2');
    modalTitle.textContent = `Error: Something went wrong while processing your request.`;
    modalTitle.style.color = '#333';
    modalTitle.style.marginBottom = '20px';

    const modalText = document.createElement('p');
    modalText.textContent = 'Please try again.';
    modalText.style.color = '#777';
    modalText.style.marginBottom = '30px';

    const tryAgainBtn = document.createElement('button');
    tryAgainBtn.textContent = 'Dismiss';
    tryAgainBtn.style.padding = '10px 20px';
    tryAgainBtn.style.fontSize = '16px';
    tryAgainBtn.style.backgroundColor = '#007bff';
    tryAgainBtn.style.color = '#fff';
    tryAgainBtn.style.border = 'none';
    tryAgainBtn.style.borderRadius = '5px';
    tryAgainBtn.style.cursor = 'pointer';
    tryAgainBtn.style.transition = 'background-color 0.3s ease';

    tryAgainBtn.addEventListener('mouseover', () => {
        tryAgainBtn.style.backgroundColor = '#0056b3';
    });

    tryAgainBtn.addEventListener('mouseout', () => {
        tryAgainBtn.style.backgroundColor = '#007bff';
    });

    tryAgainBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modalContent.appendChild(modalTitle);
    modalContent.appendChild(modalText);
    modalContent.appendChild(tryAgainBtn);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    setTimeout(() => {
        modal.style.opacity = '1';
    }, 10);
}

const handleUnflagClick = (event) => {
    const span = event.target.closest('.credibility-highlight');
    if (!span) return;
    removeHighlight(span);
};

document.addEventListener('DOMContentLoaded', () => {
    fetchFlaggedMedia(); // Fetch flagged images and apply highlight
});

// Fetch flagged images from the backend
const fetchFlaggedMedia = async () => {
    const website = window.location.href;
    try {
        const response = await fetch(`http://localhost:3000/flaggedImages?website=${encodeURIComponent(website)}`);
        const flaggedMedia = await response.json();
        console.log("Flagged media for the website:", flaggedMedia);
        flaggedMedia.forEach((mediaData) => {
            if (mediaData.mediaType === 'image') {
                highlightFlaggedImage(mediaData.prediction, mediaData.mediaUrl, mediaData.heatmap_image);
            } else if (mediaData.mediaType === 'video') {
                highlightFlaggedVideo(mediaData.prediction, mediaData.mediaUrl, mediaData.heatmap_image);
            }
        });
    } catch (error) {
        console.error("Error fetching flagged media:", error);
    }
};

const highlightFlaggedVideo = (videoPrediction, videoUrl, heatmap_image) => {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
        try {
            const normalizedVideoSrc = new URL(video.src).href;
            const normalizedFlaggedUrl = new URL(videoUrl).href;
            if (normalizedVideoSrc === normalizedFlaggedUrl) {
                console.log(`Highlighting video: ${normalizedVideoSrc}`);
                applyVideoHighlight(videoPrediction, video, normalizedVideoSrc, heatmap_image);
            }
        } catch (error) {
            console.error("Error normalizing video URLs:", error);
        }
    });
};

// Highlight flagged image based on URL
const highlightFlaggedImage = (imagePrediction, imageUrl, heatmap_image) => {
    const images = document.querySelectorAll("img");

    images.forEach((image) => {
        const normalizedImageSrc = new URL(image.src).href;
        const normalizedFlaggedUrl = new URL(imageUrl).href;

        if (normalizedImageSrc === normalizedFlaggedUrl) {
            console.log(`Highlighting image: ${normalizedImageSrc}`);
            applyImageHighlight(imagePrediction, image, normalizedImageSrc, heatmap_image);
        }
    });
};

// Listen for text selection changes
document.addEventListener('mouseup', (event) => {
    const selection = window.getSelection();
    selectedText = selection.toString().trim();

    if (selectedText) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showFlagButton(rect.right + window.scrollX + 5, rect.top + window.scrollY - 30);
    } else {
        hideFlagButton();
    }
});

// Modified media hover listener to handle both images and videos
document.addEventListener('mouseover', (event) => {
    const target = event.target;
    if (target.tagName === 'IMG' || target.tagName === 'VIDEO') {
        isHoveringMedia = true;
        lastHoveredMedia = target; // Store the last hovered media element
        const rect = target.getBoundingClientRect();
        const buttonX = rect.right + window.scrollX + 5;
        const buttonY = rect.top + window.scrollY - 30;
        showFlagButton(buttonX, buttonY);
        clearTimeout(flagButtonTimeout);
    } else if (!target.closest('#flag-text-button') && isHoveringMedia) {
        flagButtonTimeout = setTimeout(() => {
            lastHoveredMedia = null;
            isHoveringMedia = false;
            hideFlagButton();
        }, 1000);
    }
});

// --- Existing Highlighting & Discussion Functions (unchanged) ---

const applyImageHighlight = (prediction, imageElement, imageUrl, heatmap_image) => {
    console.log("Apply Image highlight with: ", imageUrl);
    if (!imageElement) return;

    const hue = (prediction == 1 ? 100 : 0);
    const saturation = 100;
    const lightness = 75;
    const highlightColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    imageElement.style.border = `4px solid ${highlightColor}`;
    imageElement.style.borderRadius = "5px";
    imageElement.title = prediction;

    const overlay = document.createElement("div");
    overlay.classList.add("image-overlay");
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = highlightColor;
    overlay.style.opacity = "0.3";
    overlay.style.pointerEvents = "none";

    const label = document.createElement("div");
    label.textContent = prediction == 1 ? "REAL" : "FAKE";
    label.style.position = "absolute";
    label.style.top = "4%";
    label.style.right = "4%";
    label.style.backgroundColor = prediction == 1 ? "rgba(34, 139, 34, 0.6)" : "rgba(220, 20, 60, 0.6)";
    label.style.color = "white";
    label.style.fontWeight = "bold";
    label.style.padding = "2px 2px";
    label.style.borderRadius = "8px";
    label.style.zIndex = "10";
    label.style.boxShadow = "2px 2px 8px rgba(0, 0, 0, 0.3)";
    label.style.fontFamily = "Poppins";

    const imageWidth = imageElement.width;
    label.style.fontSize = `${Math.max(imageWidth * 0.04, 6)}px`;

    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-block";
    wrapper.appendChild(imageElement.cloneNode(true));
    wrapper.appendChild(overlay);
    wrapper.appendChild(label);

    addImageContextMenu(wrapper, prediction, imageUrl, heatmap_image);
    imageElement.replaceWith(wrapper);
};

const addContextMenu = (span, justification, sources, text, category) => {
    span.addEventListener('contextmenu', (event) => {
        console.log("add context menu justification: ", justification);
        event.stopImmediatePropagation();
        event.preventDefault();

        let existingContextMenu = document.getElementById('credibility-context-menu');
        if (existingContextMenu) {
            existingContextMenu.remove();
        }

        let contextMenu = document.createElement('div');
        contextMenu.id = 'credibility-context-menu';
        contextMenu.classList.add('credibility-context-menu');
        console.log("add context menu category: ", category);
        if (category === "Cannot Verify")
            category = "unverifiable";
        const categoryValue = document.createElement('div');
        categoryValue.classList.add('credibility-category');
        categoryValue.textContent = `This text is ${category}`;
        categoryValue.classList.add('context-menu-item');
        contextMenu.appendChild(categoryValue);

        const reasonDisplay = document.createElement('div');
        reasonDisplay.textContent = justification || 'No justification provided';
        reasonDisplay.classList.add('context-menu-item');
        contextMenu.appendChild(reasonDisplay);
        if (category === "Fake") {
            const discussOption = document.createElement('button');
            discussOption.textContent = 'Discuss';
            discussOption.classList.add('context-menu-button');
            discussOption.addEventListener('click', () => {
                showDiscussionPanel(text, justification, sources);
                hideContextMenu();
            });
            contextMenu.appendChild(discussOption);
        }

        document.body.appendChild(contextMenu);
        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;
        contextMenu.style.display = 'block';
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.credibility-context-menu')) {
            hideContextMenu();
        }
    });
};

const addImageContextMenu = (span, prediction, imageUrl, heatmap_image) => {
    span.addEventListener('contextmenu', (event) => {
        console.log("add image context menu: ", heatmap_image);
        event.stopImmediatePropagation();
        event.preventDefault();

        // Remove any existing context menu
        document.getElementById('credibility-image-context-menu')?.remove();

        // Create the context menu
        const contextMenu = document.createElement('div');
        contextMenu.id = 'credibility-image-context-menu';
        contextMenu.classList.add('credibility-context-menu');

        // Determine credibility and display corresponding icon
        const credibilityText = prediction == "1" || prediction == 1 || prediction == "Real" ? "Real" : "Fake";
        const credibilityDisplay = document.createElement('div');
        credibilityDisplay.classList.add('credibility-category');

        // Add icons for "Real" or "Fake"
        if (credibilityText === "Real") {
            credibilityDisplay.innerHTML = `✔️ This image is ${credibilityText}`;
            credibilityDisplay.style.backgroundColor = "#d4edda"; // Green background
            credibilityDisplay.style.color = "#155724"; // Dark green text
        } else {
            credibilityDisplay.innerHTML = `❌ This image is ${credibilityText}`;
            credibilityDisplay.style.backgroundColor = "#f8d7da"; // Red background
            credibilityDisplay.style.color = "#721c24"; // Dark red text
        }

        contextMenu.appendChild(credibilityDisplay);

        // Discussion button
        const discussOption = document.createElement('button');
        discussOption.textContent = '💬 Discuss';
        discussOption.classList.add('context-menu-button');
        discussOption.addEventListener('click', () => {
            showImageDiscussionPanel(imageUrl, heatmap_image);
            hideImageContextMenu();
        });
        contextMenu.appendChild(discussOption);

        // Positioning & adding to DOM
        document.body.appendChild(contextMenu);
        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;
        contextMenu.style.display = 'block';

        // Fade-in animation
        setTimeout(() => {
            contextMenu.style.opacity = "1";
            contextMenu.style.transform = "scale(1)";
        }, 10);
    });

    // Hide menu on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.credibility-context-menu')) {
            hideImageContextMenu();
        }
    });
};

// function hideImageContextMenu() {
//     let contextMenu = document.getElementById('credibility-image-context-menu');
//     if (contextMenu) {
//         contextMenu.remove();
//     }
// }

function hideImageContextMenu() {
    const menu = document.getElementById('credibility-image-context-menu');
    if (menu) {
        menu.style.opacity = "0";
        menu.style.transform = "scale(0.95)";
        setTimeout(() => menu.remove(), 300);
    }
}


const removeHighlight = (span) => {
    const parent = span.parentNode;
    while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
};

const addComment = () => {
    const commentInput = document.getElementById('comment-input');
    const commentText = commentInput.value.trim();

    if (commentText) {
        const commentsSection = document.getElementById('comments-section');
        const newComment = document.createElement('div');
        newComment.className = 'comment';
        newComment.textContent = `You: ${commentText}`;
        commentsSection.appendChild(newComment);
        commentInput.value = '';
    }
};

// --- FETCHING and APPLYING EXISTING HIGHLIGHTS ---

const fetchAnnotations = async (url) => {
    try {
        const encodedUrl = encodeURIComponent(url);
        console.log("Fetching annotations for URL:", encodedUrl);

        const response = await fetch(`${API_BASE_URL}/getAnnotations?url=${encodedUrl}`);
        if (!response.ok) {
            if (response.status === 400) {
                return [];
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Fetched annotations:", data);
        return data;

    } catch (error) {
        console.error("Error fetching annotations:", error);
        return [];
    }
};

const applyExistingHighlights = (annotations) => {
    annotations.forEach(annotation => {
        const textNodes = findTextNodes(document.body, annotation.text);
        console.log("TextNodes found:", textNodes);

        textNodes.forEach(node => {
            console.log("Before Highlight:", node.textContent);
            console.log("*******************************", annotation.AI_verification);
            highlightTextNode(node, annotation.text, annotation.AI_verification.score, annotation.justification, annotation.sources, annotation.text, annotation.AI_verification.category);
            console.log("After Highlight:", node.parentNode.innerHTML);
        });
    });
};

function findTextNodes(root, searchText) {
    const textNodes = [];
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                if (
                    node.parentNode &&
                    /^(SCRIPT|STYLE|NOSCRIPT)$/.test(node.parentNode.nodeName) ||
                    node.parentElement.offsetParent === null
                ) {
                    return NodeFilter.FILTER_REJECT;
                }

                const nodeText = node.nodeValue.trim().replace(/\s+/g, ' ').toLowerCase();
                const cleanSearchText = searchText.trim().replace(/\s+/g, ' ').toLowerCase();

                return nodeText.includes(cleanSearchText) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
        },
        false
    );

    let node;
    while ((node = walker.nextNode())) {
        textNodes.push(node);
    }
    return textNodes;
}

function highlightTextNode(textNode, searchText, credibilityScore, justification, sources, text, category) {
    const parent = textNode.parentNode;
    let nodeText = textNode.nodeValue;

    console.log("TextNode Content (Original):", nodeText);
    console.log("Search Text (Original):", searchText);

    if (typeof searchText !== 'string') {
        console.error("searchText is not a string");
        return;
    }

    const index = nodeText.toLowerCase().indexOf(searchText.toLowerCase());

    if (index === -1) {
        console.log("Text not found in node.");
        return;
    }

    const beforeText = nodeText.substring(0, index);
    const matchText = nodeText.substring(index, index + searchText.length);
    const afterText = nodeText.substring(index + searchText.length);

    const span = document.createElement('span');

    if (isNaN(credibilityScore)) {
        credibilityScore = Math.random();
        console.warn("Credibility score was NaN, setting it to a random value:", credibilityScore);
    }
    console.log("Category: ", category);
    let hue_color;
    if (category === "Fake") {
        hue_color = 0;
    } else if (category === "Real") {
        hue_color = 100;
    } else {
        hue_color = 60;
    }

    const hue = hue_color;
    const saturation = 100;
    const lightness = 75;
    span.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    span.title = `Category: ${category}`;
    span.classList.add('credibility-highlight');
    span.dataset.originalText = matchText;
    addContextMenu(span, justification, sources, searchText, category);

    span.textContent = matchText;
    const fragment = document.createDocumentFragment();
    if (beforeText) fragment.appendChild(document.createTextNode(beforeText));
    fragment.appendChild(span);
    if (afterText) fragment.appendChild(document.createTextNode(afterText));

    parent.replaceChild(fragment, textNode);
}

const newVideoLoaded = async () => {
    const annotations = await fetchAnnotations(window.location.href);
    applyExistingHighlights(annotations);
    if (!document.getElementsByClassName("flag-text-button")[0]) {
        const flagButton = document.createElement("img");
        flagButton.src = chrome.runtime.getURL("assets/flag.png");
        flagButton.className = "ytp-button flag-text-button";
        flagButton.title = "Click to flag text";
    }
};

newVideoLoaded();

// const showImageDiscussionPanel = async (imageUrl, heatmap_image) => {
//     discussionPanel = document.getElementById('discussion-panel');
//     if (discussionPanel) {
//         discussionPanel.remove();
//     }

//     discussionPanel = document.createElement('div');
//     discussionPanel.id = 'discussion-panel';
//     discussionPanel.classList.add('discussion-panel');

//     const header = document.createElement('div');
//     header.id = 'discussion-header';
//     header.classList.add('discussion-header');
//     discussionPanel.appendChild(header);

//     const closeButton = document.createElement('button');
//     closeButton.id = 'close-button';
//     closeButton.textContent = 'Close';
//     closeButton.addEventListener('click', () => {
//         discussionPanel.style.display = 'none';
//     });
//     header.appendChild(closeButton);

//     const discussion_title = document.createElement('h1');
//     discussion_title.id = 'discussion-title';
//     discussion_title.textContent = `Summary`;
//     discussionPanel.appendChild(discussion_title);

//     const imageElement = document.createElement('img');
//     imageElement.id = 'original-image';
//     imageElement.src = imageUrl;
//     discussionPanel.appendChild(imageElement);

//     const infoContainer = document.createElement('div');
//     infoContainer.classList.add('discussion-info-container');
//     discussionPanel.appendChild(infoContainer);

//     const heatmap_title = document.createElement('h3');
//     heatmap_title.id = 'heatmap-title';
//     heatmap_title.textContent = `Heatmap`;
//     infoContainer.appendChild(heatmap_title);

//     const heatmap_explanation = document.createElement('p');
//     heatmap_explanation.id = 'heatmap-explanation';
//     heatmap_explanation.textContent = "The following heatmap has been generated by our deepfake detection model, explaining the salient features/characteristics present within the image that the model considered important whilst arriving at its decision.";
//     infoContainer.appendChild(heatmap_explanation);

//     const imageElementJ = document.createElement('img');
//     imageElement.id = 'heatmap-image';
//     imageElementJ.src = "data:image/jpeg;base64, " + heatmap_image;
//     infoContainer.appendChild(imageElementJ);

//     const chat_title = document.createElement('h2');
//     chat_title.id = 'chat-title';
//     chat_title.textContent = `Discussion`;
//     discussionPanel.appendChild(chat_title);

//     const discussionContainer = document.createElement('div');
//     discussionContainer.id = 'discussion-container';
//     discussionPanel.appendChild(discussionContainer);

//     const inputMessage = document.createElement('textarea');
//     inputMessage.id = 'discussion-input';
//     inputMessage.placeholder = 'Add your message...';
//     discussionPanel.appendChild(inputMessage);

//     const bottom_header = document.createElement('div');
//     bottom_header.id = 'bottom-header';
//     bottom_header.classList.add('bottom-header');
//     discussionPanel.appendChild(bottom_header);

//     const sendButton = document.createElement('button');
//     sendButton.id = 'send-button';
//     sendButton.textContent = 'Send Message';
//     sendButton.addEventListener('click', async () => {
//         const url = window.location.href;
//         await sendMessage(imageUrl, inputMessage.value, discussionContainer, url);
//     });
//     bottom_header.appendChild(sendButton);

//     const refreshButton = document.createElement('button');
//     refreshButton.id = 'refresh-button';
//     refreshButton.textContent = 'Refresh';
//     refreshButton.addEventListener('click', async () => {
//         const discussionContainer = document.getElementById('discussion-container');
//         if (discussionContainer) {
//             discussionContainer.innerHTML = '';
//         }
//         await fetchAndDisplayDiscussion(imageUrl, discussionContainer);
//     });
//     bottom_header.appendChild(refreshButton);

//     const resizer = document.createElement('div');
//     resizer.id = 'panel-resizer';
//     discussionPanel.appendChild(resizer);

//     resizer.addEventListener('mousedown', initResize, false);

//     document.body.appendChild(discussionPanel);
//     fetchAndDisplayDiscussion(imageUrl, discussionContainer);
//     discussionPanel.style.display = 'block';
// };
const showImageDiscussionPanel = async (imageUrl, heatmap_image) => {
    let discussionPanel = document.getElementById('discussion-panel');
    if (discussionPanel) {
        discussionPanel.remove();
    }

    discussionPanel = document.createElement('div');
    discussionPanel.id = 'discussion-panel';
    discussionPanel.classList.add('discussion-panel');

    const header = document.createElement('div');
    header.id = 'discussion-header';
    header.classList.add('discussion-header');
    discussionPanel.appendChild(header);

    const closeButton = document.createElement('button');
    closeButton.id = 'close-button';
    closeButton.textContent = '×';
    closeButton.classList.add('close-button');
    closeButton.addEventListener('click', () => {
        discussionPanel.style.display = 'none';
    });
    header.appendChild(closeButton);

    const discussion_title = document.createElement('h1');
    discussion_title.id = 'discussion-title';
    discussion_title.textContent = `Image Analysis Summary`;
    discussionPanel.appendChild(discussion_title);

    const imageElement = document.createElement('img');
    imageElement.id = 'original-image';
    imageElement.src = imageUrl;
    imageElement.classList.add('original-image');
    discussionPanel.appendChild(imageElement);

    const infoContainer = document.createElement('div');
    infoContainer.classList.add('discussion-info-container');
    discussionPanel.appendChild(infoContainer);

    const heatmap_title = document.createElement('h3');
    heatmap_title.id = 'heatmap-title';
    heatmap_title.textContent = `Model's Heatmap`;
    infoContainer.appendChild(heatmap_title);

    const heatmap_explanation = document.createElement('p');
    heatmap_explanation.id = 'heatmap-explanation';
    heatmap_explanation.textContent = "The following heatmap shows areas the model considered important when determining the authenticity of the video. It highlights key features the model focused on.";
    infoContainer.appendChild(heatmap_explanation);

    const heatmapImage = document.createElement('img');
    heatmapImage.id = 'heatmap-image';
    heatmapImage.src = "data:image/jpeg;base64, " + heatmap_image;
    heatmapImage.classList.add('heatmap-image');
    infoContainer.appendChild(heatmapImage);

    const chat_title = document.createElement('h2');
    chat_title.id = 'chat-title';
    chat_title.textContent = `Discussion`;
    discussionPanel.appendChild(chat_title);

    const discussionContainer = document.createElement('div');
    discussionContainer.id = 'discussion-container';
    discussionPanel.appendChild(discussionContainer);

    const inputMessage = document.createElement('textarea');
    inputMessage.id = 'discussion-input';
    inputMessage.placeholder = 'Share your thoughts...';
    inputMessage.classList.add('discussion-input');
    discussionPanel.appendChild(inputMessage);

    const bottom_header = document.createElement('div');
    bottom_header.id = 'bottom-header';
    bottom_header.classList.add('bottom-header');
    discussionPanel.appendChild(bottom_header);

    const sendButton = document.createElement('button');
    sendButton.id = 'send-button';
    sendButton.textContent = 'Send';
    sendButton.classList.add('send-button');
    sendButton.addEventListener('click', async () => {
        const url = window.location.href;
        await sendMessage(imageUrl, inputMessage.value, discussionContainer, url);
    });
    bottom_header.appendChild(sendButton);

    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-button';
    refreshButton.textContent = 'Refresh';
    refreshButton.classList.add('refresh-button');
    refreshButton.addEventListener('click', async () => {
        const discussionContainer = document.getElementById('discussion-container');
        if (discussionContainer) {
            discussionContainer.innerHTML = '';
        }
        await fetchAndDisplayDiscussion(imageUrl, discussionContainer);
    });
    bottom_header.appendChild(refreshButton);

    const resizer = document.createElement('div');
    resizer.id = 'panel-resizer';
    discussionPanel.appendChild(resizer);

    resizer.addEventListener('mousedown', initResize, false);

    document.body.appendChild(discussionPanel);
    fetchAndDisplayDiscussion(imageUrl, discussionContainer);
    discussionPanel.style.display = 'block';
};

// New Video Discussion Panel function with separate ID
// New Video Discussion Panel function with a unique container ID
const showVideoDiscussionPanel = async (videoUrl, heatmapVideo) => {
    // Remove any existing discussion panel (if you want one global panel for both types)
    let discussionPanel = document.getElementById('discussion-panel');
    if (discussionPanel) {
      discussionPanel.remove();
    }
  
    // Create a new discussion panel (with the same UI as for images)
    discussionPanel = document.createElement('div');
    discussionPanel.id = 'discussion-panel';
    discussionPanel.classList.add('discussion-panel');
  
    // Header section with close button
    const header = document.createElement('div');
    header.id = 'discussion-header';
    header.classList.add('discussion-header');
    discussionPanel.appendChild(header);
  
    const closeButton = document.createElement('button');
    closeButton.id = 'close-button';
    closeButton.textContent = '×';
    closeButton.classList.add('close-button');
    closeButton.addEventListener('click', () => {
      discussionPanel.style.display = 'none';
    });
    header.appendChild(closeButton);
  
    // Title for the panel
    const discussionTitle = document.createElement('h1');
    discussionTitle.id = 'discussion-title';
    discussionTitle.textContent = `Video Analysis Summary`;
    discussionPanel.appendChild(discussionTitle);
  
    // Original video element
    const originalVideo = document.createElement('video');
    originalVideo.id = 'original-video';
    originalVideo.src = videoUrl;
    originalVideo.controls = true;
    originalVideo.classList.add('original-video');
    discussionPanel.appendChild(originalVideo);
  
    // Info container for the processed (heatmap) video
    const infoContainer = document.createElement('div');
    infoContainer.classList.add('discussion-info-container');
    discussionPanel.appendChild(infoContainer);
  
    const heatmapTitle = document.createElement('h3');
    heatmapTitle.id = 'heatmap-title';
    heatmapTitle.textContent = `Model's Heatmap`;
    infoContainer.appendChild(heatmapTitle);
  
    const heatmapExplanation = document.createElement('p');
    heatmapExplanation.id = 'heatmap-explanation';
    heatmapExplanation.textContent =
      "The following video shows the processed output with heatmap overlays highlighting key regions.";
    infoContainer.appendChild(heatmapExplanation);
  
    // Processed video (heatmap) element
    const heatmapVideoElem = document.createElement('video');
    heatmapVideoElem.id = 'heatmap-video';
    heatmapVideoElem.src = "data:video/mp4;base64," + heatmapVideo;
    heatmapVideoElem.controls = true;
    heatmapVideoElem.classList.add('heatmap-video');
    infoContainer.appendChild(heatmapVideoElem);
  
    // Chat section (same as for images)
    const chatTitle = document.createElement('h2');
    chatTitle.id = 'chat-title';
    chatTitle.textContent = `Discussion`;
    discussionPanel.appendChild(chatTitle);
  
    const discussionContainer = document.createElement('div');
    discussionContainer.id = 'discussion-container';
    discussionPanel.appendChild(discussionContainer);
  
    const inputMessage = document.createElement('textarea');
    inputMessage.id = 'discussion-input';
    inputMessage.placeholder = 'Share your thoughts...';
    inputMessage.classList.add('discussion-input');
    discussionPanel.appendChild(inputMessage);
  
    const bottomHeader = document.createElement('div');
    bottomHeader.id = 'bottom-header';
    bottomHeader.classList.add('bottom-header');
    discussionPanel.appendChild(bottomHeader);
  
    const sendButton = document.createElement('button');
    sendButton.id = 'send-button';
    sendButton.textContent = 'Send';
    sendButton.classList.add('send-button');
    sendButton.addEventListener('click', async () => {
      const url = window.location.href;
      await sendMessage(videoUrl, inputMessage.value, discussionContainer, url);
    });
    bottomHeader.appendChild(sendButton);
  
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-button';
    refreshButton.textContent = 'Refresh';
    refreshButton.classList.add('refresh-button');
    refreshButton.addEventListener('click', async () => {
      if (discussionContainer) {
        discussionContainer.innerHTML = '';
      }
      await fetchAndDisplayDiscussion(videoUrl, discussionContainer);
    });
    bottomHeader.appendChild(refreshButton);
  
    // Optionally add a resizer for the panel
    const resizer = document.createElement('div');
    resizer.id = 'panel-resizer';
    discussionPanel.appendChild(resizer);
    resizer.addEventListener('mousedown', initResize, false);
  
    // Append the panel to the document and display it
    document.body.appendChild(discussionPanel);
    await fetchAndDisplayDiscussion(videoUrl, discussionContainer);
    discussionPanel.style.display = 'block';
  };
  


const showDiscussionPanel = async (text, justification, sources) => {
    discussionPanel = document.getElementById('discussion-panel');
    if (discussionPanel) {
        discussionPanel.remove();
    }

    discussionPanel = document.createElement('div');
    discussionPanel.id = 'discussion-panel';
    discussionPanel.classList.add('discussion-panel');

    const header = document.createElement('div');
    header.id = 'discussion-header';
    header.classList.add('discussion-header');
    discussionPanel.appendChild(header);

    const closeButton = document.createElement('button');
    closeButton.id = 'close-button';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => {
        discussionPanel.style.display = 'none';
    });
    header.appendChild(closeButton);

    const discussion_title = document.createElement('h1');
    discussion_title.id = 'discussion-title';
    discussion_title.textContent = `Summary`;
    discussionPanel.appendChild(discussion_title);

    const title = document.createElement('h3');
    title.id = 'discussion-description';
    title.textContent = `${text}`;
    discussionPanel.appendChild(title);

    const infoContainer = document.createElement('div');
    infoContainer.classList.add('discussion-info-container');
    discussionPanel.appendChild(infoContainer);

    const justificationContainer = document.createElement('div');
    justificationContainer.classList.add('info-item', 'justification');
    const justificationTitle = document.createElement('strong');
    justificationTitle.textContent = 'Justification: ';
    justificationContainer.appendChild(justificationTitle);
    const justificationText = document.createElement('span');
    justificationText.textContent = justification || 'No justification provided.';
    justificationContainer.appendChild(justificationText);
    infoContainer.appendChild(justificationContainer);

    const sourcesContainer = document.createElement('div');
    sourcesContainer.classList.add('info-item', 'sources');
    const sourcesTitle = document.createElement('strong');
    sourcesTitle.textContent = 'Sources: ';
    sourcesContainer.appendChild(sourcesTitle);

    const sourcesList = document.createElement('ol');
    sourcesContainer.style.overflow = "hidden";
    sourcesContainer.style.wordWrap = "break-word";
    sourcesContainer.style.whiteSpace = "normal";
    sourcesContainer.style.maxWidth = "100%";

    if (sources && Array.isArray(sources)) {
        sources.forEach(source => {
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            link.href = source;
            link.textContent = source;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.style.textDecoration = "none";
            link.style.color = "#007bff";
            listItem.appendChild(link);
            sourcesList.appendChild(listItem);
        });
    } else {
        const noSources = document.createElement('div');
        noSources.textContent = 'No sources provided.';
        sourcesList.appendChild(noSources);
    }
    sourcesContainer.appendChild(sourcesList);
    infoContainer.appendChild(sourcesContainer);

    const chat_title = document.createElement('h2');
    chat_title.id = 'chat-title';
    chat_title.textContent = `Discussion`;
    discussionPanel.appendChild(chat_title);

    const discussionContainer = document.createElement('div');
    discussionContainer.id = 'discussion-container';
    discussionPanel.appendChild(discussionContainer);

    const inputMessage = document.createElement('textarea');
    inputMessage.id = 'discussion-input';
    inputMessage.placeholder = 'Add your message...';
    discussionPanel.appendChild(inputMessage);

    const bottom_header = document.createElement('div');
    bottom_header.id = 'bottom-header';
    bottom_header.classList.add('bottom-header');
    discussionPanel.appendChild(bottom_header);

    const sendButton = document.createElement('button');
    sendButton.id = 'send-button';
    sendButton.textContent = 'Send Message';
    sendButton.addEventListener('click', async () => {
        const url = window.location.href;
        await sendMessage(text, inputMessage.value, discussionContainer, url);
    });
    bottom_header.appendChild(sendButton);

    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-button';
    refreshButton.textContent = 'Refresh';
    refreshButton.addEventListener('click', async () => {
        const discussionContainer = document.getElementById('discussion-container');
        if (discussionContainer) {
            discussionContainer.innerHTML = '';
        }
        await fetchAndDisplayDiscussion(text, discussionContainer);
    });
    bottom_header.appendChild(refreshButton);

    const resizer = document.createElement('div');
    resizer.id = 'panel-resizer';
    discussionPanel.appendChild(resizer);

    resizer.addEventListener('mousedown', initResize, false);

    document.body.appendChild(discussionPanel);
    fetchAndDisplayDiscussion(text, discussionContainer);
    discussionPanel.style.display = 'block';
};

const fetchAndDisplayDiscussion = async (text_or_image, discussionContainer) => {
    let discussionPanel = document.getElementById('discussion-panel');
    if (!discussionPanel) {
        return;
    }

    let path;
    if (text_or_image.startsWith("https:"))
        path = "getDiscussionThreadsImage";
    else
        path = "getDiscussionThreads";
    console.log(path, text_or_image);

    discussionContainer = document.getElementById('discussion-container');
    discussionContainer.innerHTML = '';

    try {
        const response = await fetch(`${API_BASE_URL}/${path}?text=${encodeURIComponent(text_or_image)}&url=${encodeURIComponent(window.location.href)}`);
        if (!response.ok) {
            if (response.status === 400) {
                const noMessages = document.createElement('div');
                noMessages.textContent = 'No messages yet.';
                discussionContainer.appendChild(noMessages);
                return;
            }
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const discussionThreads = await response.json();
        console.log("discussionThreads from fetch:", discussionThreads);

        if (Array.isArray(discussionThreads) && discussionThreads.length > 0) {
            displayDiscussionThread(discussionThreads[0].discussionThread, discussionContainer);
        } else {
            discussionContainer.innerHTML = '<div>No discussions yet.</div>';
        }
    } catch (error) {
        console.error("Error fetching discussion threads:", error);
        discussionContainer.innerHTML = '<div>Error loading discussions.</div>';
    }
};

let isResizing = false;

function initResize(e) {
    e.preventDefault();
    isResizing = true;
    document.addEventListener('mousemove', resizePanel);
    document.addEventListener('mouseup', stopResize);
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
}

function resizePanel(e) {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    discussionPanel.style.width = `${newWidth}px`;
}

function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', resizePanel);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    document.body.style.msUserSelect = '';
}

const displayDiscussionThread = (discussionThread, discussionContainer) => {
    console.log("Received discussion thread:", discussionThread);
    if (!discussionContainer) {
        console.error("Error: discussionContainer is null or undefined.");
        return;
    }
    discussionContainer.innerHTML = '';

    if (!discussionThread || discussionThread.length === 0) {
        const noMessages = document.createElement('div');
        noMessages.textContent = 'No messages yet.';
        discussionContainer.appendChild(noMessages);
        return;
    }

    discussionThread.forEach(messageObj => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');

        let userId = messageObj.userId || 'Unknown User';
        const message = messageObj.message || 'No message content';

        userId = userId === chrome.runtime.id ? 'You' : userId;

        if (userId === 'ejjjimhfldejgofhjjgfpkhphlfjjokg') {
            userId = 'unknown_rudra'
        } else if (userId === 'oekefgamihofmlabmopoamhdjbekhejk') {
            userId = 'esvar2004'
        } else if (userId === 'amapagdohinlpjibdfbpfgigkogeklcd') {
            userId = 'teja02'
        }

        const userElement = document.createElement('div');
        userElement.classList.add('user');
        if (userId === 'You') {
            userElement.textContent = `You:`;
        } else {
            userElement.textContent = `User: ${userId}`;
        }

        const messageText = document.createElement('div');
        messageText.classList.add('message-text');
        messageText.textContent = message;

        const timestampElement = document.createElement('div');
        timestampElement.classList.add('timestamp');
        const timestamp = messageObj.timestamp ? new Date(messageObj.timestamp._seconds * 1000).toLocaleString() : 'No timestamp';
        timestampElement.textContent = timestamp;

        messageElement.appendChild(userElement);
        messageElement.appendChild(messageText);
        messageElement.appendChild(timestampElement);

        discussionContainer.appendChild(messageElement);
    });
    console.log("Discussion thread displayed successfully.");
};

const sendMessage = async (text_or_image, message, discussionContainer, url) => {
    if (!message.trim()) return;
    let path;
    if (text_or_image.startsWith("https:"))
        path = "addDiscussionMessageToImage";
    else
        path = "addDiscussionMessage";

    try {
        const userId = chrome.runtime.id;
        const response = await fetch(`${API_BASE_URL}/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text_or_image, userId, message, url }),
        });

        if (!response.ok) {
            throw new Error(`Failed to send message: ${response.status}`);
        }

        const data = await response.json();
        const newMessage = {
            userId: userId,
            message: message,
            timestamp: data.timestamp,
        };

        appendMessage(newMessage, discussionContainer);
        document.getElementById('discussion-input').value = '';
    } catch (error) {
        console.error("Error sending message:", error);
    }
};

function appendMessage(messageObj, container) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    let userId = messageObj.userId || 'Unknown User';
    const message = messageObj.message || 'No message content';

    userId = userId === chrome.runtime.id ? 'You' : userId;

    if (userId === 'ejjjimhfldejgofhjjgfpkhphlfjjokg') {
        userId = 'unknown_rudra'
    } else if (userId === 'oekefgamihofmlabmopoamhdjbekhejk') {
        userId = 'esvar2004'
    } else if (userId === 'amapagdohinlpjibdfbpfgigkogeklcd') {
        userId = 'teja02'
    }

    const userElement = document.createElement('div');
    userElement.classList.add('user');
    if (userId === 'You') {
        userElement.textContent = `You:`;
    } else {
        userElement.textContent = `User: ${userId}`;
    }

    const messageText = document.createElement('div');
    messageText.classList.add('message-text');
    messageText.textContent = message;

    const timestampElement = document.createElement('div');
    timestampElement.classList.add('timestamp');
    const timestamp = messageObj.timestamp ? new Date(messageObj.timestamp).toLocaleString() : 'No timestamp';
    timestampElement.textContent = timestamp;

    messageElement.appendChild(userElement);
    messageElement.appendChild(messageText);
    messageElement.appendChild(timestampElement);

    container.appendChild(messageElement);
    container.scrollTop = container.scrollHeight;
}

//Remove this later if not work
// function showVideoDiscussionPanel(videoUrl, base64Video) {
//     // Remove any existing panel
//     let discussionPanel = document.getElementById('discussion-panel');
//     if (discussionPanel) {
//         discussionPanel.remove();
//     }

//     // Create a new panel
//     discussionPanel = document.createElement('div');
//     discussionPanel.id = 'discussion-panel';
//     discussionPanel.classList.add('discussion-panel');

//     // Header
//     const header = document.createElement('div');
//     header.id = 'discussion-header';
//     header.classList.add('discussion-header');
//     discussionPanel.appendChild(header);

//     // Close button
//     const closeButton = document.createElement('button');
//     closeButton.id = 'close-button';
//     closeButton.textContent = 'Close';
//     closeButton.addEventListener('click', () => {
//         discussionPanel.style.display = 'none';
//     });
//     header.appendChild(closeButton);

//     // Title
//     const discussion_title = document.createElement('h1');
//     discussion_title.id = 'discussion-title';
//     discussion_title.textContent = `Summary`;
//     discussionPanel.appendChild(discussion_title);

//     // Original video URL (optional)
//     const infoContainer = document.createElement('div');
//     infoContainer.classList.add('discussion-info-container');
//     discussionPanel.appendChild(infoContainer);

//     const originalTitle = document.createElement('h3');
//     originalTitle.textContent = "Original Video";
//     infoContainer.appendChild(originalTitle);

//     // Show a link to the original video
//     const link = document.createElement('a');
//     link.href = videoUrl;
//     link.textContent = videoUrl;
//     link.target = "_blank";
//     link.rel = "noopener noreferrer";
//     infoContainer.appendChild(link);

//     // Heatmap title
//     const heatmapTitle = document.createElement('h3');
//     heatmapTitle.textContent = "Heatmap (Processed Video)";
//     infoContainer.appendChild(heatmapTitle);

//     // Explanation
//     const heatmapExplanation = document.createElement('p');
//     heatmapExplanation.textContent = "Below is the processed video with Grad-CAM overlays showing the salient regions.";
//     infoContainer.appendChild(heatmapExplanation);

//     // Create a <video> element for the processed video
//     const videoElement = document.createElement('video');
//     videoElement.id = 'heatmap-video';
//     videoElement.controls = true;
//     videoElement.style.maxWidth = '400px';
//     videoElement.style.maxHeight = '300px';

//     videoElement.src = "data:video/mp4;base64," + base64Video;

//     infoContainer.appendChild(videoElement);

//     document.body.appendChild(discussionPanel);
//     discussionPanel.style.display = 'block';
// }


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "newURL") {
        newVideoLoaded();
    }
    return true;
});
