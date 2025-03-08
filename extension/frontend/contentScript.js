// contentScript.js
let selectedText = "";
let lastHoveredImage = null;
const API_BASE_URL = "http://localhost:3000"; //  YOUR ACTUAL BACKEND URL
let discussionPanel = null;

window.addEventListener('load', () => {
    fetchFlaggedImages(); // Fetch flagged images and apply highlight
});

// Function to create and show the "flag" button (No changes here)
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
            if (lastHoveredImage) {
                handleImageFlag(lastHoveredImage);
                lastHoveredImage = null;
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
const IMAGE_API_URL = "http://127.0.0.1:5000/predict" // Image Model API
const BACKEND_API_URL = "http://localhost:3000/store_analysis"; // Your backend API

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
                                applyHighlight(response.credibilityScore, aiData.justification, selectedText);
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
                            applyHighlight(response.credibilityScore, aiData.justification, selectedText);
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
    }
    hideProcessingButton();
};

const BACKEND_API_URL2 = "http://localhost:3000/flagImage";
const handleImageFlag = async (imageElement) => {
    console.log("Processing image:", imageElement.src);

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
        console.log("input:", imageElement.src, window.location.href, aiData.prediction, aiData.heatmap_image, chrome.runtime.id);
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
        applyImageHighlight(aiData.prediction, imageElement);

    } catch (error) {
        console.error("Error during image processing:", error);
    }

    hideProcessingButton();
};


const handleUnflagClick = (event) => {
    const span = event.target.closest('.credibility-highlight');
    if (!span) return;
    removeHighlight(span);

};

document.addEventListener('DOMContentLoaded', () => {
    fetchFlaggedImages(); // Fetch flagged images and apply highlight
});

// Fetch flagged images from the backend
const fetchFlaggedImages = async () => {
    try {
        const response = await fetch("http://localhost:3000/flaggedImages");
        const flaggedImages = await response.json();
        console.log("Flagged images:", flaggedImages);

        // Highlight the flagged images
        flaggedImages.forEach((imageData) => {
            highlightFlaggedImage(imageData.imageUrl);
        });
    } catch (error) {
        console.error("Error fetching flagged images:", error);
    }
};

// Highlight flagged image based on URL
const highlightFlaggedImage = (imageUrl) => {
    const images = document.querySelectorAll("img");

    images.forEach((image) => {
        // Check if the image URL contains the source URL in a normalized way
        const normalizedImageSrc = new URL(image.src).href;
        const normalizedFlaggedUrl = new URL(imageUrl).href;

        if (normalizedImageSrc === normalizedFlaggedUrl) {
            const prediction = 0; // Replace with actual prediction if you fetch it
            applyImageHighlight(prediction, image);
        }
    });
};
// Listen for selection changes (No changes here)
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

document.addEventListener('mouseover', (event) => {
    const target = event.target;

    // Ensure the target is an image
    if (target.tagName === 'IMG') {
        lastHoveredImage = target; // Store the last hovered image
        const rect = target.getBoundingClientRect();
        const buttonX = rect.right + window.scrollX + 5;
        const buttonY = rect.top + window.scrollY - 30;
        showFlagButton(buttonX, buttonY);
    } else if (!target.closest('#flag-button')) {
        // Hide the button if the mouse moves away from both image and flag button
        // hideFlagButton();
        // lastHoveredImage = null;
    }
});

// let hoverTimeout;

// document.addEventListener('mouseover', (event) => {
//     const target = event.target;
//     if (target.tagName !== 'IMG') return;

//     clearTimeout(hoverTimeout);

//     const rect = target.getBoundingClientRect();
//     const buttonX = rect.right + window.scrollX + 5;
//     const buttonY = rect.top + window.scrollY - 30;

//     showFlagButton(buttonX, buttonY);

//     const button = document.getElementById('flag-button');
//     button.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
//     button.addEventListener('mouseleave', () => hideFlagButtonWithDelay());
// });

// document.addEventListener('mouseout', (event) => {
//     if (event.target.tagName === 'IMG') {
//         hideFlagButtonWithDelay();
//     }
// });

// function hideFlagButtonWithDelay() {
//     hoverTimeout = setTimeout(() => {
//         hideFlagButton();
//     }, 1000);
// }


// Apply highlight with correct credibility score and add context menu (No changes)
const applyHighlight = (credibilityScore, justification, text) => {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');

    const hue = (1 - credibilityScore) * 120;
    const saturation = 100;
    const lightness = 75;

    span.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    span.title = `Credibility Score: ${Math.round((1 - credibilityScore) * 100)}%`;
    span.classList.add('credibility-highlight');
    span.dataset.originalText = text; // Store the original text
    console.log("applyHighlight justify: ", justification);
    addContextMenu(span, justification);

    try {
        range.surroundContents(span);
        selection.removeAllRanges();
    } catch (e) {
        console.error("Error surrounding contents", e)
    }

};

// Apply highlight for images
const applyImageHighlight = (prediction, imageElement) => {
    if (!imageElement) return;

    // Calculate HSL color based on credibility score
    const hue = 100;
    const saturation = 100;
    const lightness = 75;
    const highlightColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    // Apply a colored border to the image
    imageElement.style.border = `4px solid ${highlightColor}`;
    imageElement.style.borderRadius = "5px";

    // Set tooltip for credibility score
    imageElement.title = prediction

    // Add a semi-transparent overlay (optional)
    const overlay = document.createElement("div");
    overlay.classList.add("image-overlay");
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = highlightColor;
    overlay.style.opacity = "0.3"; // Adjust transparency
    overlay.style.pointerEvents = "none"; // Prevent interference with clicks

    // Wrap image in a container to properly position overlay
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-block";
    wrapper.appendChild(imageElement.cloneNode(true)); // Clone the image
    wrapper.appendChild(overlay);

    // Replace the original image with the wrapped version
    imageElement.replaceWith(wrapper);
};
// const applyImageHighlight = (prediction, imageElement) => {
//     if (!imageElement) return;

//     // Calculate HSL color based on credibility score
//     const hue = 100;
//     const saturation = 100;
//     const lightness = 75;
//     const highlightColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

//     // Apply a colored border to the image
//     imageElement.style.border = `4px solid ${highlightColor}`;
//     imageElement.style.borderRadius = "5px";

//     // Set tooltip for credibility score
//     imageElement.title = prediction;

//     // Add a semi-transparent overlay (optional)
//     const overlay = document.createElement("div");
//     overlay.classList.add("image-overlay");
//     overlay.style.position = "absolute";
//     overlay.style.top = "0";
//     overlay.style.left = "0";
//     overlay.style.width = "100%";
//     overlay.style.height = "100%";
//     overlay.style.backgroundColor = highlightColor;
//     overlay.style.opacity = "0.3"; // Adjust transparency
//     overlay.style.pointerEvents = "none"; // Prevent interference with clicks

//     // Add overlay directly to the image wrapper, not the entire page
//     const imageWrapper = imageElement.parentElement;
//     if (!imageWrapper) {
//         // If there's no wrapper, create one
//         const wrapper = document.createElement("div");
//         wrapper.style.position = "relative";
//         wrapper.style.display = "inline-block";
//         wrapper.appendChild(imageElement);
//         imageElement.parentNode.replaceChild(wrapper, imageElement);
//     }

//     // Append overlay to the image wrapper (not the entire page)
//     imageWrapper.style.position = "relative"; // Make sure wrapper is positioned correctly
//     imageWrapper.appendChild(overlay);
// };

//helper function to add context menu
const addContextMenu = (span, justification) => {
    console.log("add context menu justification: ", justification);
    span.addEventListener('contextmenu', (event) => {
        event.preventDefault();

        let contextMenu = document.getElementById('credibility-context-menu');
        if (!contextMenu) {
            contextMenu = document.createElement('div');
            contextMenu.id = 'credibility-context-menu';
            contextMenu.classList.add('credibility-context-menu');

            // Create credibility score display
            const credibilityScore = Math.random(); // Random number between 0 and 1
            const credibilityDisplay = document.createElement('div');
            credibilityDisplay.textContent = `Credibility Score: ${Math.round((1 - credibilityScore) * 100)}%`;
            credibilityDisplay.classList.add('context-menu-item');
            contextMenu.appendChild(credibilityDisplay);

            // Create reason display
            const reasonDisplay = document.createElement('div');
            reasonDisplay.textContent = justification || 'No justification provided';
            reasonDisplay.classList.add('context-menu-item');
            contextMenu.appendChild(reasonDisplay);

            // Create discuss button
            const discussOption = document.createElement('button'); // Use a button for better styling
            discussOption.textContent = 'Discuss';
            discussOption.classList.add('context-menu-button'); // Different class for button
            discussOption.addEventListener('click', () => {
                showDiscussionPanel(span.dataset.originalText); // Show discussion panel
                hideContextMenu();
            });
            contextMenu.appendChild(discussOption);

            document.body.appendChild(contextMenu);
        }

        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;
        contextMenu.style.display = 'block';
    });
    //Hiding the context menu
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.credibility-context-menu')) {
            hideContextMenu();
        }
    });
}

// Remove the highlight completely, regardless of the score
const removeHighlight = (span) => {
    const parent = span.parentNode;
    while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
};

const hideContextMenu = () => {
    let contextMenu = document.getElementById('credibility-context-menu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

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

const checkPageTitle = async () => {
    const pageTitle = document.title;

    chrome.runtime.sendMessage({
        action: "flagText",
        selectedText: pageTitle,
        pageURL: window.location.href,
        pageTitle: pageTitle
    }, (response) => {

        if (response && response.credibilityScore !== undefined) {
            console.log("Title credibility score:", response.credibilityScore);
            const titleElement = document.querySelector('title');
            if (titleElement) {
                const span = document.createElement('span');
                const hue = (1 - response.credibilityScore) * 120;
                const saturation = 100;
                const lightness = 75;

                span.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                span.style.color = 'black'
                span.title = `Credibility Score: ${Math.round((1 - response.credibilityScore) * 100)}%`;
                span.appendChild(document.createTextNode(titleElement.textContent));
                titleElement.textContent = '';
                titleElement.appendChild(span);
            }
        } else {
            console.error("Error checking title:", response);
        }
    });
};

//checkPageTitle();

// --- FETCHING and APPLYING EXISTING HIGHLIGHTS ---

// Function to fetch annotations from the backend
const fetchAnnotations = async (url) => {
    try {
        // Encode the URL
        const encodedUrl = encodeURIComponent(url);
        console.log("Fetching annotations for URL:", encodedUrl);

        const response = await fetch(`${API_BASE_URL}/getAnnotations?url=${encodedUrl}`);
        if (!response.ok) {
            if (response.status === 400) {
                return []; // No URL parameter, it's fine
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        console.log("Fetched annotations:", data);
        return data;

    } catch (error) {
        console.error("Error fetching annotations:", error);
        return []; // Return empty array on error
    }
};

// Function to apply existing highlights based on fetched annotations
const applyExistingHighlights = (annotations) => {
    annotations.forEach(annotation => {
        // 1. Find all text nodes that contain the flagged text
        const textNodes = findTextNodes(document.body, annotation.text);
        console.log("TextNodes found:", textNodes) //log

        textNodes.forEach(node => {
            // 2. Split the text node and apply the highlight
            console.log("Before Highlight:", node.textContent);
            highlightTextNode(node, annotation.text, annotation.AI_verification.score, annotation.justification);
            console.log("After Highlight:", parent.innerHTML);
        });
    });
};

// Helper function: Find all text nodes containing the searchText
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

                // Normalize spaces and case for comparison
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


// Helper function: Split text node and apply highlight
function highlightTextNode(textNode, searchText, credibilityScore, justification) {
    console.log("highlight text node justify: ", justification);
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

    // Split the text node into before, match, and after parts
    const beforeText = nodeText.substring(0, index);
    const matchText = nodeText.substring(index, index + searchText.length);
    const afterText = nodeText.substring(index + searchText.length);

    // Create a new span element for highlighting
    const span = document.createElement('span');

    // Set a random credibility score if the original value is NaN
    if (isNaN(credibilityScore)) {
        credibilityScore = Math.random(); // Generate a random number between 0 and 1
        console.warn("Credibility score was NaN, setting it to a random value:", credibilityScore);
    }

    const hue = (1 - credibilityScore) * 120;
    const saturation = 100;
    const lightness = 75;
    span.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    span.title = `Credibility Score: ${Math.round((1 - credibilityScore) * 100)}%`;
    span.classList.add('credibility-highlight');
    span.dataset.originalText = matchText; // Store original text
    span.textContent = matchText;

    addContextMenu(span, justification); // Keep the context menu functionality

    // Replace the text node with the split parts
    const fragment = document.createDocumentFragment();
    if (beforeText) fragment.appendChild(document.createTextNode(beforeText));
    fragment.appendChild(span);
    if (afterText) fragment.appendChild(document.createTextNode(afterText));

    parent.replaceChild(fragment, textNode);
    console.log("Node was replaced", parent.innerHTML); //See node text after replacement.
}

const newVideoLoaded = async () => {
    // Fetch annotations and apply highlights
    const annotations = await fetchAnnotations(window.location.href);
    applyExistingHighlights(annotations);
    if (!document.getElementsByClassName("flag-text-button")[0]) { //adds flag button
        const flagButton = document.createElement("img");
        flagButton.src = chrome.runtime.getURL("assets/flag.png");
        flagButton.className = "ytp-button flag-text-button";
        flagButton.title = "Click to flag text";
    }
};

// Run newVideoLoaded when the page loads
newVideoLoaded();
const showDiscussionPanel = async (text) => {
    if (!discussionPanel) {
        // Create the panel if it doesn't exist
        discussionPanel = document.createElement('div');
        discussionPanel.id = 'discussion-panel';
        discussionPanel.classList.add('discussion-panel');

        // Container for header (close button and refresh button)
        const header = document.createElement('div');
        header.classList.add('discussion-header');
        discussionPanel.appendChild(header);

        // Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', () => {
            discussionPanel.style.display = 'none'; // Hide the panel
        });
        header.appendChild(closeButton);

        // Refresh button
        const refreshButton = document.createElement('button');
        refreshButton.textContent = 'Refresh';
        refreshButton.addEventListener('click', async () => {
            // Clear existing discussion container before re-fetching
            const discussionContainer = document.getElementById('discussion-container');
            if (discussionContainer) {
                discussionContainer.innerHTML = ''; // Clear current content
            }
            // Re-fetch and display the discussion
            await fetchAndDisplayDiscussion(text, discussionContainer);
        });
        header.appendChild(refreshButton);

        // Title (Flagged Text)
        const title = document.createElement('h3');
        title.textContent = `Discussion: ${text}`;
        discussionPanel.appendChild(title);

        // Create a container for category, justification, and sources
        const infoContainer = document.createElement('div');
        infoContainer.classList.add('discussion-info-container');
        discussionPanel.appendChild(infoContainer);

        const discussionContainer = document.createElement('div');
        discussionContainer.id = 'discussion-container';
        discussionPanel.appendChild(discussionContainer);  // Append discussion container to panel

        // Fetch and display the discussion information (category, justification, sources)
        try {
            const response = await fetch(`${API_BASE_URL}/getDiscussionThreads?text=${encodeURIComponent(text)}`);
            if (!response.ok) {
                if (response.status === 400) {
                    const noMessages = document.createElement('div');
                    noMessages.textContent = 'No messages yet.';
                    discussionPanel.appendChild(noMessages);
                    discussionPanel.style.display = 'block';
                    return;
                }
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const discussionThreads = await response.json();
            console.log("discussionThreads from fetch:", discussionThreads);

            // Check if discussionThreads is an array and has at least one element
            if (Array.isArray(discussionThreads) && discussionThreads.length > 0) {
                const thread = discussionThreads[0];

                // Category
                const categoryContainer = document.createElement('div');
                categoryContainer.classList.add('info-item', 'category');
                const categoryTitle = document.createElement('strong');
                categoryTitle.textContent = 'Category: ';
                categoryContainer.appendChild(categoryTitle);
                const categoryText = document.createElement('span');
                categoryText.textContent = thread.category;
                categoryContainer.appendChild(categoryText);
                infoContainer.appendChild(categoryContainer);

                // Justification
                const justificationContainer = document.createElement('div');
                justificationContainer.classList.add('info-item', 'justification');
                const justificationTitle = document.createElement('strong');
                justificationTitle.textContent = 'Justification: ';
                justificationContainer.appendChild(justificationTitle);
                const justificationText = document.createElement('span');
                justificationText.textContent = thread.justification;
                justificationContainer.appendChild(justificationText);
                infoContainer.appendChild(justificationContainer);

                // Sources (Numbered List)
                const sourcesContainer = document.createElement('div');
                sourcesContainer.classList.add('info-item', 'sources');
                const sourcesTitle = document.createElement('strong');
                sourcesTitle.textContent = 'Sources: ';
                sourcesContainer.appendChild(sourcesTitle);

                // Create an ordered list for sources (numbered)
                const sourcesList = document.createElement('ol');
                thread.sources.forEach(source => {
                    const listItem = document.createElement('li');
                    listItem.textContent = source;
                    sourcesList.appendChild(listItem);
                });
                sourcesContainer.appendChild(sourcesList);
                infoContainer.appendChild(sourcesContainer);

                // Now display the discussion thread below the info section
                displayDiscussionThread(thread.discussionThread, discussionContainer);

                // Pass the discussionContainer to fetchAndDisplayDiscussion
                fetchAndDisplayDiscussion(text, discussionContainer);
            } else {
                const noDiscussions = document.createElement('div');
                noDiscussions.textContent = 'No discussions yet.';
                discussionPanel.appendChild(noDiscussions);
            }
        } catch (error) {
            console.error("Error fetching discussion threads:", error);
            const errorMessage = document.createElement('div');
            errorMessage.textContent = 'Error loading discussions.';
            discussionPanel.appendChild(errorMessage);
        }

        // Input for new messages
        const inputMessage = document.createElement('textarea');
        inputMessage.id = 'discussion-input';
        inputMessage.placeholder = 'Add your message...';
        discussionPanel.appendChild(inputMessage);

        // Send button
        const sendButton = document.createElement('button');
        sendButton.id = 'send-button'; // Add an ID
        sendButton.textContent = 'Send Message';
        sendButton.addEventListener('click', async () => {
            const url = window.location.href;
            await sendMessage(text, inputMessage.value, discussionContainer, url);
        });
        discussionPanel.appendChild(sendButton);

        // Resizable handle (div)
        const resizer = document.createElement('div');
        resizer.id = 'panel-resizer';
        discussionPanel.appendChild(resizer);

        // Add event listeners for resizing
        resizer.addEventListener('mousedown', initResize, false);

        document.body.appendChild(discussionPanel); // Add to the DOM *once*

        discussionPanel.style.display = 'block'; // Show the panel
    }
};


// Function to fetch and display discussion threads
const fetchAndDisplayDiscussion = async (text, discussionContainer) => {
    discussionContainer.innerHTML = ''; // Clear previous content

    try {
        const response = await fetch(`${API_BASE_URL}/getDiscussionThreads?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`);
        if (!response.ok) {
            if (response.status === 400) { // Bad request, no messages
                const noMessages = document.createElement('div');
                noMessages.textContent = 'No messages yet.';
                discussionContainer.appendChild(noMessages);
                return;
            }
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const discussionThreads = await response.json();
        console.log("discussionThreads from fetch:", discussionThreads);

        // Check if discussionThreads is an array and has at least one element
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


// --- Resizing Logic ---

let isResizing = false;

function initResize(e) {
    e.preventDefault(); // Prevent text selection during drag
    isResizing = true;
    document.addEventListener('mousemove', resizePanel);
    document.addEventListener('mouseup', stopResize);

    // Prevent text selection during drag (cross-browser)
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none'; // Safari
    document.body.style.msUserSelect = 'none'; // IE 10+
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

    // Re-enable text selection
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    document.body.style.msUserSelect = '';
}

const displayDiscussionThread = (discussionThread, discussionContainer) => {
    console.log("Received discussion thread:", discussionThread);

    // Ensure discussionContainer exists
    if (!discussionContainer) {
        console.error("Error: discussionContainer is null or undefined.");
        return;
    }

    // Clear previous messages
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

        const userId = messageObj.userId || 'Unknown User';  // Handle missing userId
        const message = messageObj.message || 'No message content'; // handle missing message

        const userElement = document.createElement('div');
        userElement.classList.add('user');
        userElement.textContent = `User: ${userId}`;

        const messageText = document.createElement('div');
        messageText.classList.add('message-text');
        messageText.textContent = message;

        const timestampElement = document.createElement('div');
        timestampElement.classList.add('timestamp');
        // Handle possible missing timestamps more gracefully
        const timestamp = messageObj.timestamp ? new Date(messageObj.timestamp).toLocaleString() : 'No timestamp';
        timestampElement.textContent = timestamp;

        messageElement.appendChild(userElement);
        messageElement.appendChild(messageText);
        messageElement.appendChild(timestampElement);

        discussionContainer.appendChild(messageElement);
    });
    console.log("Discussion thread displayed successfully.");
};
const sendMessage = async (text, message, discussionContainer, url) => {
    if (!message.trim()) return;  // Don't send empty messages

    try {
        const userId = chrome.runtime.id; //  extension ID as user ID
        const response = await fetch(`${API_BASE_URL}/addDiscussionMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, userId, message, url }),
        });

        if (!response.ok) {
            throw new Error(`Failed to send message: ${response.status}`);
        }

        const data = await response.json();
        // Create a new message object with the *returned* data (including timestamp)
        const newMessage = {
            userId: userId,
            message: message,
            timestamp: data.timestamp, // Use the timestamp from the server
        };

        // Append the new message directly, without re-fetching everything
        appendMessage(newMessage, discussionContainer);


        // Clear the input field
        document.getElementById('discussion-input').value = '';

    } catch (error) {
        console.error("Error sending message:", error);
    }
};
// --- Helper Function to Append a Single Message ---
function appendMessage(messageObj, container) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    const userId = messageObj.userId || 'Unknown User';
    const message = messageObj.message || 'No message content';

    const userElement = document.createElement('div');
    userElement.classList.add('user');
    userElement.textContent = `User: ${userId}`;

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
    container.scrollTop = container.scrollHeight; // Auto-scroll to the bottom
}

// Listen for URL changes (important for single-page applications)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "newURL") {
        newVideoLoaded(); // Reload everything when the URL changes.
    }
    return true; // Indicate asynchronous response
});