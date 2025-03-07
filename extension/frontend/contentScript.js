// contentScript.js
let selectedText = "";

// Function to create and show the "flag" button
const showFlagButton = (x, y) => {
    let flagButton = document.getElementById('flag-text-button');
    if(!flagButton){
        flagButton = document.createElement('button');
        flagButton.id = 'flag-text-button';
        flagButton.innerHTML = `<img src="${chrome.runtime.getURL('assets/flag.png')}" style="width: 20px; height: 20px;"> Flag`; // Use your flag icon
        flagButton.style.position = 'absolute';
        flagButton.style.zIndex = '10000'; // Make sure it's on top
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
    if(flagButton){
        flagButton.style.display = 'none';
    }
};

// Handle clicks on the "flag" button
const handleFlagClick = () => {
  if (selectedText) {
      console.log("Flagging text:", selectedText);

      // Send message to background script to handle Firebase interaction
      chrome.runtime.sendMessage(
          {
              action: "flagText",
              selectedText,
              pageURL: window.location.href,
              pageTitle: document.title,
          },
          (response) => {
              if (response && response.veracityScore !== undefined) {
                    applyHighlight(response.veracityScore)
              } else {
                  console.error("Error flagging text:", response);
              }
          }
      );
  }
  hideFlagButton();
};
const handleUnflagClick = () => {
    if(selectedText){
        chrome.runtime.sendMessage(
          {
              action: "unflagText",
              selectedText,
              pageURL: window.location.href,
              pageTitle: document.title,
          },
          (response) => {
              if (response && response.veracityScore !== undefined) {
                  //re-apply highlight.
                  applyHighlight(response.veracityScore);
              } else {
                  console.error("Error unflagging text:", response);
              }
          }
      );
    }
}

// Listen for selection changes
document.addEventListener('mouseup', (event) => {
  const selection = window.getSelection();
  selectedText = selection.toString().trim();

  if (selectedText) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Position the button slightly above the selected text
    showFlagButton(rect.right + window.scrollX + 5, rect.top + window.scrollY - 30);
  } else {
    hideFlagButton();
  }
});

// Function to apply the highlight color based on the AI score
const applyHighlight = (veracityScore) => {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');

    // Determine color based on veracityScore (0 = green, 1 = red)
    const red = Math.round(veracityScore * 255);
    const green = Math.round((1 - veracityScore) * 255);
    span.style.backgroundColor = `rgb(${red}, ${green}, 0)`;
    span.title = `Veracity Score: ${(1 - veracityScore) * 100}%`; // Show score on hover
    span.classList.add('veracity-highlight');


     // Context menu setup (inside applyHighlight)
    span.addEventListener('contextmenu', (event) => {
        event.preventDefault(); // Prevent default context menu

        // Create context menu
        let contextMenu = document.getElementById('veracity-context-menu');
        if(!contextMenu){
            contextMenu = document.createElement('div');
            contextMenu.id = 'veracity-context-menu';
            contextMenu.classList.add('veracity-context-menu')

            const unflagOption = document.createElement('div');
            unflagOption.textContent = 'Unflag';
            unflagOption.classList.add('context-menu-option');
            unflagOption.addEventListener('click', handleUnflagClick);
            contextMenu.appendChild(unflagOption);

            const discussOption = document.createElement('div');
            discussOption.textContent = 'Discuss';
            discussOption.classList.add('context-menu-option');
            discussOption.addEventListener('click', () => {
                // Show discussion popup (implementation below)
                showDiscussionPopup(selectedText);
                hideContextMenu();

            });
            contextMenu.appendChild(discussOption);

            document.body.appendChild(contextMenu);
        }
        
        // Position the context menu
        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;
        contextMenu.style.display = 'block';
    });

    //Hiding the context menu
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.veracity-context-menu')) {
            hideContextMenu();
        }
    });
    //try catch for error handling
    try{
        range.surroundContents(span);
        selection.removeAllRanges();
    }
     catch(e){
        console.error("Error surrounding contents:", e);
    }
};
const hideContextMenu = () => {
   let contextMenu = document.getElementById('veracity-context-menu');
    if(contextMenu){
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
    popup.style.display = 'block';
      // Placeholder for comments
      const commentsSection = document.getElementById("comments-section");

      // Dummy comments (replace with data from Firebase)
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
//Check title
const checkPageTitle = async () => {
     const pageTitle = document.title;

    // Simulate sending the title to the AI (via the background script)
    chrome.runtime.sendMessage({
        action: "flagText",
        selectedText: pageTitle,
        pageURL: window.location.href,
        pageTitle: pageTitle
      }, (response) => {

        // Assume 'response' contains a 'veracityScore' (0 = true, 1 = false)
        if (response && response.veracityScore !== undefined) {
            console.log("Title veracity score:", response.veracityScore);
             const titleElement = document.querySelector('title');
            if (titleElement) {
                // Create a span to wrap the title text
                const span = document.createElement('span');
                const red = Math.round(response.veracityScore * 255);
                const green = Math.round((1 - response.veracityScore) * 255);

                span.style.backgroundColor = `rgb(${red}, ${green}, 0)`; // Apply color
                span.style.color = 'black' //make it more readable.
                span.title = `Veracity Score: ${(1 - response.veracityScore) * 100}%`;
                span.appendChild(document.createTextNode(titleElement.textContent));
                titleElement.textContent = ''; // Clear the original title content
                titleElement.appendChild(span); // Add the styled span
            }
        } else {
          console.error("Error checking title:", response);
        }
    });
};

// Run the title check when the page loads
checkPageTitle();