// contentScript.js
let selectedText = "";

// Function to create and show the "flag" button
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

// Function to hide the "flag" button
const hideFlagButton = () => {
    const flagButton = document.getElementById('flag-text-button');
    if (flagButton) {
        flagButton.style.display = 'none';
    }
};

// Handle clicks on the "flag" button
// const handleFlagClick = () => {
//     if (selectedText) {
//         console.log("Flagging text:", selectedText);

//         chrome.runtime.sendMessage(
//             {
//                 action: "flagText",
//                 selectedText,
//                 pageURL: window.location.href,
//                 pageTitle: document.title,
//                 userId: chrome.runtime.id
//             },
//             (response) => {
//                 if (response && response.credibilityScore !== undefined) {
//                     applyHighlight(response.credibilityScore, selectedText); // Pass selectedText
//                 } else {
//                     console.error("Error flagging text:", response);
//                 }
//             }
//         );
//     }
//     hideFlagButton();
// };
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
                    pageTitle: document.title,
                    userId: chrome.runtime.id
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Runtime error:", chrome.runtime.lastError.message);
                        reject("Runtime error: " + chrome.runtime.lastError.message);
                    } else if (response?.docId) {
                        applyHighlight(response.credibilityScore, selectedText);
                        console.log("Flagged text successfully:", response.docId);
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
    } catch (error) {
        console.error("Error during flagText:", error);
    }

    hideFlagButton();
};



const handleUnflagClick = (event) => {
    // Get the highlighted span (the parent of the context menu)
    const span = event.target.closest('.credibility-highlight');
    if (!span) return; // Safety check

    const textToUnflag = span.textContent; // Get the text content of the span

    chrome.runtime.sendMessage(
        {
            action: "unflagText",
            selectedText: textToUnflag, // Use the text from the span
            pageURL: window.location.href,
            pageTitle: document.title,
        },
        (response) => {
            if (response && response.credibilityScore !== undefined) {
                removeHighlight(span); // Remove the highlight completely
            } else {
                console.error("Error unflagging text:", response);
            }
        }
    );
};

// Listen for selection changes
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

// Function to apply the highlight color based on the AI score
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
                showDiscussionPopup(selectedText);
                hideContextMenu();
            });
            contextMenu.appendChild(discussOption);
            document.body.appendChild(contextMenu);
        }

        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;
        contextMenu.style.display = 'block';
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.credibility-context-menu')) {
            hideContextMenu();
        }
    });

    try {
        range.surroundContents(span);
        selection.removeAllRanges();
    } catch (e) {
        console.error("Error surrounding contents:", e);
    }
};

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