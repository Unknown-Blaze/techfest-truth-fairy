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
const handleFlagClick = async () => {
    if (!selectedText) return;
    console.log("Flagging text:", selectedText);

    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                {
                    action: "flagText",
                    selectedText,
                    pageURL: window.location.href,
                    userId: chrome.runtime.id //  extension ID as a temporary user ID
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Runtime error:", chrome.runtime.lastError.message);
                        reject("Runtime error: " + chrome.runtime.lastError.message);
                    } else if (response?.credibilityScore !== undefined) {
                        //apply highlight as soon as flag button is clicked
                        applyHighlight(response.credibilityScore, selectedText);
                        console.log("Flagged text successfully:");
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

        console.log("Response received:", response);
        // After successfully flagging, re-fetch and apply highlights. No need to do it, as we are applying it instantly
        // const annotations = await fetchAnnotations(window.location.href);
        // applyExistingHighlights(annotations);
    } catch (error) {
        console.error("Error during flagText:", error);
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

const showDiscussionPopup = (text) => {
    let popup = document.getElementById('discussion-popup');

    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'discussion-popup';
        popup.classList.add('discussion-popup');

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', () => {
            popup.style.display = 'none';
        });
        popup.appendChild(closeButton);
        document.body.appendChild(popup);
    }
    popup.innerHTML = `
        <button id="close-popup">Close</button>
        <h3>Discussion</h3>
        <p>Text: ${text}</p>
        <div id="comments-section">

        </div>
        <textarea id="comment-input" placeholder="Add a comment..."></textarea>
        <button id="add-comment">Add Comment</button>
    `;
    document.getElementById('close-popup').addEventListener('click', () => {
        popup.style.display = 'none';
    });
    document.getElementById('add-comment').addEventListener('click', addComment);
    popup.style.display = 'block';

    const commentsSection = document.getElementById("comments-section");

    const comments = [
        { user: "User1", text: "I think this is misleading." },
        { user: "User2", text: "I agree, the source is questionable." },
    ];

    comments.forEach(comment => {
        const commentElement = document.createElement("div");
        commentElement.className = "comment";
        commentElement.textContent = `${comment.user}: ${comment.text}`;
        commentsSection.appendChild(commentElement);
    });

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
        console.log("Fetching annotations for URL:", url);

        const response = await fetch(`http://localhost:3000/getAnnotations?url=${url}`);
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
        console.log (textNodes);

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
        { acceptNode: function(node) {
            // Ignore text inside script/style/noscript tags, and hidden elements
            if (node.parentNode && /^(SCRIPT|STYLE|NOSCRIPT)$/.test(node.parentNode.nodeName) || node.parentElement.offsetParent === null ) {
                return NodeFilter.FILTER_REJECT;
            }
            // Accept the node if it includes the search text
            return node.nodeValue.includes(searchText) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }},
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
    const span = document.createElement('span');
    const hue = (1 - credibilityScore) * 120;
    const saturation = 100;
    const lightness = 75;

    span.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    span.title = `Credibility Score: ${Math.round((1 - credibilityScore) * 100)}%`;
    span.classList.add('credibility-highlight');
    span.dataset.originalText = searchText; // Store original text

    // --- KEY PART: Replace the ENTIRE text node content ---
    textNode.parentNode.replaceChild(span, textNode);
    span.textContent = searchText; // Set span content

    addContextMenu(span); // Add context menu
    return span;
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

// Listen for URL changes (important for single-page applications)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.message === "newURL") {
            newVideoLoaded(); // Reload everything when the URL changes.
        }
         return true; // Indicate asynchronous response
    });