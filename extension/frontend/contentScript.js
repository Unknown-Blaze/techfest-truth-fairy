// contentScript.js
let selectedText = "";
const API_BASE_URL = "http://localhost:3000"; //  YOUR ACTUAL BACKEND URL
let discussionPanel = null;

// Function to create and show the "flag" button (No changes here)
const showFlagButton = (x, y) => {
    let flagButton = document.getElementById('flag-text-button');
    if (!flagButton) {
        flagButton = document.createElement('button');
        flagButton.id = 'flag-text-button';
        flagButton.innerHTML = `<img src="${chrome.runtime.getURL('assets/flag.png')}" style="width: 20px; height: 20px;"> Flag`;
        flagButton.style.position = 'absolute';
        flagButton.style.zIndex = '10000';
        flagButton.addEventListener('click', handleFlagClick);
        document.body.appendChild(flagButton);
    }

    flagButton.style.left = `${x}px`;
    flagButton.style.top = `${y}px`;
    flagButton.style.display = 'block';
};

// Function to hide the "flag" button (No changes here)
const hideFlagButton = () => {
    const flagButton = document.getElementById('flag-text-button');
    if (flagButton) {
        flagButton.style.display = 'none';
    }
};

const AI_API_URL = "http://127.0.0.1:5000/fact-check"; // AI Model API
const BACKEND_API_URL = "http://localhost:3000/store_analysis"; // Your backend API

const handleFlagClick = async () => {
    if (!selectedText) return;
    console.log("Flagging text:", selectedText);

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
                            if (response?.credibilityScore !== undefined) {
                                console.log("Flagged text successfully:", response);
                                applyHighlight(response.credibilityScore, selectedText);
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
                            applyHighlight(response.credibilityScore, selectedText);
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

    hideFlagButton();
};



const handleUnflagClick = (event) => {
    const span = event.target.closest('.credibility-highlight');
    if (!span) return;
    removeHighlight(span);

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

// Apply highlight with correct credibility score and add context menu (No changes)
const applyHighlight = (credibilityScore, text) => {
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
    addContextMenu(span);

    try {
        range.surroundContents(span);
        selection.removeAllRanges();
    } catch (e) {
        console.error("Error surrounding contents", e)
    }

};
//helper function to add context menu
//helper function to add context menu
const addContextMenu = (span) => {
    span.addEventListener('contextmenu', (event) => {
        event.preventDefault();

        let contextMenu = document.getElementById('credibility-context-menu');
        if (!contextMenu) {
            contextMenu = document.createElement('div');
            contextMenu.id = 'credibility-context-menu';
            contextMenu.classList.add('credibility-context-menu');

            const unflagOption = document.createElement('div');
            unflagOption.textContent = 'Unflag';
            unflagOption.classList.add('context-menu-option');
            unflagOption.addEventListener('click', (event) => {
                handleUnflagClick(event);
                hideContextMenu();
            });
            contextMenu.appendChild(unflagOption);

            const discussOption = document.createElement('div');
            discussOption.textContent = 'Discuss';
            discussOption.classList.add('context-menu-option');
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
            highlightTextNode(node, annotation.text, annotation.AI_verification.score);
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
function highlightTextNode(textNode, searchText, credibilityScore) {
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

    addContextMenu(span); // Keep the context menu functionality

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

        // Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', () => {
            discussionPanel.style.display = 'none'; // Hide the panel
        });
        discussionPanel.appendChild(closeButton);

        // Title (Flagged Text)
        const title = document.createElement('h3');
        title.textContent = `Discussion: ${text}`;
        discussionPanel.appendChild(title);

        // Container for messages
        const discussionContainer = document.createElement('div');
        discussionContainer.id = 'discussion-container';
        discussionPanel.appendChild(discussionContainer);

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

    }
    // Fetch and display existing discussion threads
    const discussionContainer = document.getElementById('discussion-container');
    discussionContainer.innerHTML = ''; // Clear previous content

    try {
        const response = await fetch(`${API_BASE_URL}/getDiscussionThreads?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`); // Added url
        if (!response.ok) {
            if (response.status === 400) { //bad request
                //It can be that there is no discussion for the text.
                const noMessages = document.createElement('div');
                noMessages.textContent = 'No messages yet.';
                discussionContainer.appendChild(noMessages);
                discussionPanel.style.display = 'block';
                return;
            }
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const discussionThreads = await response.json();
        console.log("discussionThreads from fetch:", discussionThreads);

        // Check if discussionThreads is an array and has at least one element
        if (Array.isArray(discussionThreads) && discussionThreads.length > 0) {
            // Access the first element and its discussionThread property
            displayDiscussionThread(discussionThreads[0].discussionThread, discussionContainer);
        } else {
            // Handle the case where there are no threads
            discussionContainer.innerHTML = '<div>No discussions yet.</div>';
        }
    } catch (error) {
        console.error("Error fetching discussion threads:", error);
        discussionContainer.innerHTML = '<div>Error loading discussions.</div>'; // User-friendly message
    }

    discussionPanel.style.display = 'block'; // Show the panel
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