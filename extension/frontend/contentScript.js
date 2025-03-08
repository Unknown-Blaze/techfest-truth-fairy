// contentScript.js
let selectedText = "";
const API_BASE_URL = "http://localhost:3000"; //  YOUR ACTUAL BACKEND URL

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

// Handle clicks on the "flag" button
// const handleFlagClick = async () => {
//     if (!selectedText) return;
//     console.log("Flagging text:", selectedText);

//     try {
//         const response = await new Promise((resolve, reject) => {
//             chrome.runtime.sendMessage(
//                 {
//                     action: "flagText",
//                     selectedText,
//                     pageURL: window.location.href,
//                     userId: chrome.runtime.id //  extension ID as a temporary user ID
//                 },
//                 (response) => {
//                     if (chrome.runtime.lastError) {
//                         console.error("Runtime error:", chrome.runtime.lastError.message);
//                         reject("Runtime error: " + chrome.runtime.lastError.message);
//                     } else if (response?.credibilityScore !== undefined) {
//                         //apply highlight as soon as flag button is clicked
//                         applyHighlight(response.credibilityScore, selectedText);
//                         console.log("Flagged text successfully:");
//                         resolve(response);
//                     } else if (response?.error) {
//                         console.error("Backend error:", response.error);
//                         reject("Backend error: " + response.error);
//                     } else {
//                         console.error("Unexpected response:", response);
//                         reject("No valid response received");
//                     }
//                 }
//             );
//         });

//         console.log("Response received:", response);
//         // After successfully flagging, re-fetch and apply highlights. No need to do it, as we are applying it instantly
//         // const annotations = await fetchAnnotations(window.location.href);
//         // applyExistingHighlights(annotations);
//     } catch (error) {
//         console.error("Error during flagText:", error);
//     }

//     hideFlagButton();
// };
const AI_API_URL = "http://127.0.0.1:5000/fact-check"; // AI Model API
const BACKEND_API_URL = "http://localhost:3000/store_analysis"; // Your backend API

const handleFlagClick = async () => {
    if (!selectedText) return;
    console.log("Flagging text:", selectedText);

    try {
        // ✅ Step 1: Flag the text
        const flagResponse = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                {
                    action: "flagText",
                    selectedText,
                    pageURL: window.location.href,
                    userId: chrome.runtime.id // Temporary user ID
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Runtime error:", chrome.runtime.lastError.message);
                        reject("Runtime error: " + chrome.runtime.lastError.message);
                    } else if (response?.credibilityScore !== undefined) {
                        applyHighlight(response.credibilityScore, selectedText);
                        console.log("Flagged text successfully:", response);
                        resolve(response);
                    } else if (response?.error) {
                        console.error("Backend error:", response.error);
                        reject("Backend error: " + response.error);
                    } else {
                        console.error("Unexpected response:", response);
                        reject("No valid response received");
                    }
                }
            );
        });

        console.log("Flag Response received:", flagResponse);

        // ✅ Step 2: Process text using the AI model
        console.log("Processing text with AI model...");
        console.log("Selected Text:", selectedText);
        console.log("URL:", window.location.href);
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

        // ✅ Step 3: Store AI analysis in the backend database
        console.log("Storing AI analysis in the database...");
        if (aiData.category === "Fake") {
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
                showDiscussionPopup(span.dataset.originalText); // Show discussion popup
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
            highlightTextNode(node, annotation.text, annotation.AI_verification.score);
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
    const nodeText = textNode.nodeValue;
    const index = nodeText.toLowerCase().indexOf(searchText.toLowerCase());

    if (index === -1) return; // Avoid processing if text not found

    // Split the text node into before, match, and after parts
    const beforeText = nodeText.substring(0, index);
    const matchText = nodeText.substring(index, index + searchText.length);
    const afterText = nodeText.substring(index + searchText.length);

    // Create a new span element for highlighting
    const span = document.createElement('span');
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


const showDiscussionPopup = async (text) => {
    let popup = document.getElementById('discussion-popup');

    if (!popup) {
        // Create the popup if it doesn't exist
        popup = document.createElement('div');
        popup.id = 'discussion-popup';
        popup.classList.add('discussion-popup');

        // Add a close button to hide the popup
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', () => {
            popup.style.display = 'none';
        });
        popup.appendChild(closeButton);

        // Container to hold discussion messages
        const discussionContainer = document.createElement('div');
        discussionContainer.id = 'discussion-container';
        popup.appendChild(discussionContainer);

        const inputMessage = document.createElement('textarea');
        inputMessage.id = 'discussion-input';
        inputMessage.placeholder = 'Add your message...';
        popup.appendChild(inputMessage);

        const sendButton = document.createElement('button');
        sendButton.textContent = 'Send Message';
        sendButton.addEventListener('click', async () => {
            const url = window.location.href;
            await sendMessage(text, inputMessage.value, discussionContainer, url);
        });
        popup.appendChild(sendButton);

        document.body.appendChild(popup);
    }

    // Fetch existing discussion threads
    try {
        const response = await fetch(`http://localhost:3000/getDiscussionThreads?text=${text}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const discussionThreads = await response.json();
        console.log("discussionThreads from fetch:", discussionThreads); //debugging

        // Flatten all discussion messages
        const allMessages = discussionThreads.flatMap(thread => thread.discussionThread);
        console.log("Flattened messages:", allMessages);

        const discussionContainer = document.getElementById('discussion-container'); //verify existance of container
        console.log("discussionContainer:", discussionContainer); //debugging

        // Display all messages
        displayDiscussionThread(allMessages, discussionContainer);

    } catch (error) {
        console.error("Error fetching discussion threads:", error);
    }

    popup.style.display = 'block';
};


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

        discussionContainer.appendChild(messageElement);
    });

    console.log("Discussion thread displayed successfully.");
};

const sendMessage = async (text, message, discussionContainer) => {
    if (!message.trim()) return;

    const url = window.location.href; // Get the current page URL

    try {
        const userId = chrome.runtime.id; // Using extension ID as user ID
        const response = await fetch(`http://localhost:3000/addDiscussionMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, userId, message, url }) // Include the URL in the request
        });

        if (response.ok) {
            const data = await response.json();
            const newMessage = { userId, message, timestamp: new Date().toISOString() };
            displayDiscussionThread([...discussionContainer.children, newMessage], discussionContainer);
        }
    } catch (error) {
        console.error("Error sending message:", error);
    }
};

// Listen for URL changes (important for single-page applications)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "newURL") {
        newVideoLoaded(); // Reload everything when the URL changes.
    }
    return true; // Indicate asynchronous response
});



// const showDiscussionPopup = async (text, flaggedTextId) => {
//     let popup = document.getElementById('discussion-popup');

//     if (!popup) {
//         popup = document.createElement('div');
//         popup.id = 'discussion-popup';
//         popup.classList.add('discussion-popup');

//         const closeButton = document.createElement('button');
//         closeButton.textContent = 'Close';
//         closeButton.addEventListener('click', () => {
//             popup.style.display = 'none';
//         });
//         popup.appendChild(closeButton);

//         const discussionContainer = document.createElement('div');
//         discussionContainer.id = 'discussion-container';
//         popup.appendChild(discussionContainer);

//         const inputMessage = document.createElement('textarea');
//         inputMessage.id = 'discussion-input';
//         inputMessage.placeholder = 'Add your message...';
//         popup.appendChild(inputMessage);

//         const sendButton = document.createElement('button');
//         sendButton.textContent = 'Send Message';
//         sendButton.addEventListener('click', async () => {
//             // Get the current URL of the page
//             const url = window.location.href;

//             // Send the message with the text, URL, and flaggedTextId
//             await sendMessage(text, inputMessage.value, discussionContainer, url);
//         });
//         popup.appendChild(sendButton);

//         document.body.appendChild(popup);
//     }

//     // Fetch existing discussion thread
//     const response = await fetch(`http://localhost:3000/getAnnotations?url=${window.location.href}`);
//     const flaggedTexts = await response.json();

//     const flaggedText = flaggedTexts.find(ft => ft.id === flaggedTextId);
//     if (flaggedText) {
//         displayDiscussionThread(flaggedText.discussionThread);
//     }
// };

// const displayDiscussionThread = (discussionThread) => {
//     const discussionContainer = document.getElementById('discussion-container');
//     discussionContainer.innerHTML = '';

//     discussionThread.forEach(msg => {
//         const messageDiv = document.createElement('div');
//         messageDiv.classList.add('discussion-message');
//         messageDiv.textContent = `${msg.userId}: ${msg.message}`;
//         discussionContainer.appendChild(messageDiv);
//     });
// };


// // Send new message to backend
// const sendMessage = async (text, message, discussionContainer) => {
//     if (!message.trim()) return;
//     console.log("Sending message:", message), console.log("Text:", text), console.log("URL:", window.location.href);

//     const url = window.location.href; // Get the current page URL

//     try {
//         const userId = chrome.runtime.id; // Using extension ID as user ID
//         const response = await fetch(`http://localhost:3000/addDiscussionMessage`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ text, userId, message, url }) // Include the URL in the request
//         });

/*************  ✨ Codeium Command 🌟  *************/
/**
 * Show the discussion popup for a given text.
 * Fetches existing discussion threads and displays them in the popup.
 * @param {string} text - The text for which to show the discussion popup.
 */
//         if (response.ok) {
//             const data = await response.json();
//             const newMessage = { userId, message, timestamp: new Date().toISOString() };
//             displayDiscussionThread([...discussionContainer.children, newMessage]);
//         }
//     } catch (error) {
//         console.error("Error sending message:", error);
//     }
// };

// const showDiscussionPopup = (text) => {
//     let popup = document.getElementById('discussion-popup');

//     if (!popup) {
//         popup = document.createElement('div');
//         popup.id = 'discussion-popup';
//         popup.classList.add('discussion-popup');

//         const closeButton = document.createElement('button');
//         closeButton.textContent = 'Close';
//         closeButton.addEventListener('click', () => {
//             popup.style.display = 'none';
//         });
//         popup.appendChild(closeButton);
//         document.body.appendChild(popup);
//     }
//     popup.innerHTML = `
//         <button id="close-popup">Close</button>
//         <h3>Discussion</h3>
//         <p>Text: ${text}</p>
//         <div id="comments-section">

//         </div>
//         <textarea id="comment-input" placeholder="Add a comment..."></textarea>
//         <button id="add-comment">Add Comment</button>
//     `;
//     document.getElementById('close-popup').addEventListener('click', () => {
//         popup.style.display = 'none';
//     });
//     document.getElementById('add-comment').addEventListener('click', addComment);
//     popup.style.display = 'block';

//     const commentsSection = document.getElementById("comments-section");

//     const comments = [
//         { user: "User1", text: "I think this is misleading." },
//         { user: "User2", text: "I agree, the source is questionable." },
//     ];

//     comments.forEach(comment => {
//         const commentElement = document.createElement("div");
//         commentElement.className = "comment";
//         commentElement.textContent = `${comment.user}: ${comment.text}`;
//         commentsSection.appendChild(commentElement);
//     });

// };