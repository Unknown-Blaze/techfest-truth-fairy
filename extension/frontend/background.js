// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "flagText") {
    const { selectedText, pageURL, userId } = request;
    console.log("Received flagText request:", selectedText, pageURL, userId);

    // Call addFlaggedText (implementation below)
    flagTextOnServer(selectedText, pageURL, userId)
      .then(response => { // Receive credibilityScore
        sendResponse(response); // Send back the score
      })
      .catch(error => {
        console.error("Error handling flagText:", error);
        sendResponse({ error: error.message }); // Send detailed error
      });

    return true; // Keep the message channel open
  } else if (request.action === "unflagText") {
    // No changes needed here, as we don't use unflag anymore
     return true;
  }
});
async function flagTextOnServer(text, url, userId) {
    try {
        const response = await fetch('http://localhost:3000/flagText', { //your server address
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text, website: url, userId }), //send to backend
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        // Simulate AI verification (replace with actual AI call)
        const credibilityScore = Math.random(); // Placeholder
        const aiResult = credibilityScore > 0.5 ? "Likely True" : "Likely False";

        // Send AI verification data to backend
        const verifyResponse = await fetch('http://localhost:3000/verifyText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                flaggedTextId: data.flaggedTextId, // Use the ID from the flagText response
                aiResult,
                aiScore: 1-credibilityScore,
            }),
        });

        if (!verifyResponse.ok) {
            const errorText = await verifyResponse.text();
            throw new Error(`AI Verification error: ${verifyResponse.status} ${errorText}`);
        }
        return {credibilityScore}; //return ai score


    } catch (error) {
        console.error("Error flagging text on server:", error);
        throw error; // Re-throw to be caught by the caller
    }
}