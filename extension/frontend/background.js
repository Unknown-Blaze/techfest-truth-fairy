// // background.js

// // Example: Listen for messages from the content script
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "flagText") {
//     // 1. Receive data from content script (selectedText, pageURL, etc.)
//     const { selectedText, pageURL, pageTitle } = request;
//     console.log("Received flagText request:", selectedText, pageURL, pageTitle);

//     // 2. Send data to Firebase (Firestore)
//     //  (Replace with your Firebase initialization and data handling)
//     //  This is a *placeholder*.  You'll need to integrate the actual
//     //  Firebase SDK and structure your data appropriately.

//     // Simulate AI - return a random credibility score
//     sendResponse({ credibilityScore: Math.random() });
//     return true; // Keep message channel open

//     // ***  Firebase interaction (example using the Firebase JS SDK) ***
//     /*  (UNCOMMENT AND FILL IN ONCE FIREBASE IS SET UP)
//     import { initializeApp } from "firebase/app";
//     import { getFirestore, collection, addDoc } from "firebase/firestore";

//     const firebaseConfig = {
//       // YOUR FIREBASE CONFIG HERE
//     };
// // background.js

// // Example: Listen for messages from the content script
// chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
//   try {
//     if (request.action === "flagText") {
//       // 1. Receive data from content script (selectedText, pageURL, etc.)
//       const { selectedText, pageURL, pageTitle } = request;
//       console.log("Received flagText request:", selectedText, pageURL, pageTitle);

//       // 2. Send data to Firebase (Firestore)
//       const firebaseConfig = {
//         // YOUR FIREBASE CONFIG HERE
//       };

//       const app = initializeApp(firebaseConfig);
//       const db = getFirestore(app);

//       const docRef = await addDoc(collection(db, "flaggedTexts"), {
//         text: selectedText,
//         url: pageURL,
//         title: pageTitle,
//         timestamp: new Date(),
//         // Add other relevant fields
//       });

//       console.log("Document written with ID: ", docRef.id);
//       // Send a response back to the content script (e.g., the document ID)
//       sendResponse({ docId: docRef.id, credibilityScore: Math.random() }); // Simulate AI score
//     } else if (request.action === "unflagText") {
//       // Simulate unflagging (e.g., return a higher credibility score)
//       sendResponse({ credibilityScore: Math.random() * 0.2 + 0.8 }); // Example: Score between 0.8 and 1.0
//     }
//   } catch (error) {
//     console.error("Error handling message:", error);
//     sendResponse({ error: "Failed to process request" });
//   }

//   return true; // Keep the message channel open for async response (important!)
// });
//     const app = initializeApp(firebaseConfig);
//     const db = getFirestore(app);

//     addDoc(collection(db, "flaggedTexts"), {
//       text: selectedText,
//       url: pageURL,
//       title: pageTitle,
//       timestamp: new Date(),
//       // Add other relevant fields
//     })
//       .then((docRef) => {
//         console.log("Document written with ID: ", docRef.id);
//         // Send a response back to the content script (e.g., the document ID)
//         sendResponse({ docId: docRef.id, credibilityScore: Math.random() }); // Simulate AI score
//       })
//       .catch((error) => {
//         console.error("Error adding document: ", error);
//         sendResponse({ error: "Failed to save data" });
//       });
//     */

//     return true; // Keep the message channel open for async response (important!)
//   } else if (request.action === "unflagText") {
//     // Simulate unflagging (e.g., return a higher credibility score)
//     sendResponse({ credibilityScore: Math.random() * 0.2 + 0.8 }); // Example: Score between 0.8 and 1.0
//     return true; // Keep the message channel open
//   }
// });

// Firebase setup is removed since it's handled by the backend
// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "flagText") {
    const { selectedText, pageURL, userId } = request;
    console.log("Received flagText request:", selectedText, pageURL, userId);

    (async () => {
      try {
        // Step 1: Flag the text
        const flagResponse = await fetch('http://localhost:3000/flagText', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: selectedText, website: pageURL, userId }),
        });

        if (!flagResponse.ok) {
          console.error("Backend response error:", flagResponse.statusText);
          sendResponse({ error: "Backend request failed: " + flagResponse.statusText });
          return;
        }

        const flagData = await flagResponse.json();
        console.log("Flagged text response:", flagData);

        if (!flagData.flaggedTextId) {
          sendResponse({ error: "Invalid response from backend" });
          return;
        }

        // Step 2: Calculate AI Score
        const credibilityScore = Math.random(); // Placeholder logic
        const aiScore = 1 - credibilityScore;
        const aiResult = credibilityScore > 0.5 ? "Likely True" : "Likely False"; // Example result logic

        console.log("Sending AI verification:", { flaggedTextId: flagData.flaggedTextId, aiResult, aiScore });

        // Step 3: Verify the text with AI
        const verifyResponse = await fetch('http://localhost:3000/verifyText', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flaggedTextId: flagData.flaggedTextId,
            aiResult,
            aiScore
          }),
        });

        if (!verifyResponse.ok) {
          console.error("AI Verification error:", verifyResponse.statusText);
          sendResponse({ error: "AI Verification failed: " + verifyResponse.statusText });
          return;
        }

        const verifyData = await verifyResponse.json();
        console.log("AI verification response:", verifyData);

        sendResponse({ docId: flagData.flaggedTextId, credibilityScore, aiScore, aiResult });
      } catch (error) {
        console.error("Fetch error:", error);
        sendResponse({ error: "Failed to flag and verify text" });
      }
    })();

    return true; // Keep the response channel open for async calls
  }
});

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "flagText") {
//     const { selectedText, pageURL, userId } = request;
//     console.log("Received flagText request:", selectedText, pageURL, userId);

//     (async () => {
//       try {
//         const response = await fetch('http://localhost:3000/flagText', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ text: selectedText, website: pageURL, userId }),
//         });

//         if (!response.ok) {
//           console.error("Backend response error:", response.statusText);
//           sendResponse({ error: "Backend request failed: " + response.statusText });
//           return;
//         }

//         const data = await response.json();
//         console.log("Flagged text response:", data);

//         if (data.flaggedTextId) {
//           sendResponse({ docId: data.flaggedTextId, credibilityScore: Math.random() });
//         } else {
//           sendResponse({ error: "Invalid response from backend" });
//         }
//       } catch (error) {
//         console.error("Fetch error:", error);
//         sendResponse({ error: "Failed to flag text" });
//       }
//     })();

//     return true; // Keep the response channel open for async calls
//   }
// });
