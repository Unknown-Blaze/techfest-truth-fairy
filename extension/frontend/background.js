// background.js

// Example: Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "flagText") {
    // 1. Receive data from content script (selectedText, pageURL, etc.)
    const { selectedText, pageURL, pageTitle } = request;
    console.log("Received flagText request:", selectedText, pageURL, pageTitle);

    // 2. Send data to Firebase (Firestore)
    //  (Replace with your Firebase initialization and data handling)
    //  This is a *placeholder*.  You'll need to integrate the actual
    //  Firebase SDK and structure your data appropriately.

    // Simulate AI - return a random credibility score
    sendResponse({ credibilityScore: Math.random() });
    return true; // Keep message channel open

    // ***  Firebase interaction (example using the Firebase JS SDK) ***
    /*  (UNCOMMENT AND FILL IN ONCE FIREBASE IS SET UP)
    import { initializeApp } from "firebase/app";
    import { getFirestore, collection, addDoc } from "firebase/firestore";

    const firebaseConfig = {
      // YOUR FIREBASE CONFIG HERE
    };
// background.js

// Example: Listen for messages from the content script
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  try {
    if (request.action === "flagText") {
      // 1. Receive data from content script (selectedText, pageURL, etc.)
      const { selectedText, pageURL, pageTitle } = request;
      console.log("Received flagText request:", selectedText, pageURL, pageTitle);

      // 2. Send data to Firebase (Firestore)
      const firebaseConfig = {
        // YOUR FIREBASE CONFIG HERE
      };

      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);

      const docRef = await addDoc(collection(db, "flaggedTexts"), {
        text: selectedText,
        url: pageURL,
        title: pageTitle,
        timestamp: new Date(),
        // Add other relevant fields
      });

      console.log("Document written with ID: ", docRef.id);
      // Send a response back to the content script (e.g., the document ID)
      sendResponse({ docId: docRef.id, credibilityScore: Math.random() }); // Simulate AI score
    } else if (request.action === "unflagText") {
      // Simulate unflagging (e.g., return a higher credibility score)
      sendResponse({ credibilityScore: Math.random() * 0.2 + 0.8 }); // Example: Score between 0.8 and 1.0
    }
  } catch (error) {
    console.error("Error handling message:", error);
    sendResponse({ error: "Failed to process request" });
  }

  return true; // Keep the message channel open for async response (important!)
});
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    addDoc(collection(db, "flaggedTexts"), {
      text: selectedText,
      url: pageURL,
      title: pageTitle,
      timestamp: new Date(),
      // Add other relevant fields
    })
      .then((docRef) => {
        console.log("Document written with ID: ", docRef.id);
        // Send a response back to the content script (e.g., the document ID)
        sendResponse({ docId: docRef.id, credibilityScore: Math.random() }); // Simulate AI score
      })
      .catch((error) => {
        console.error("Error adding document: ", error);
        sendResponse({ error: "Failed to save data" });
      });
    */

    return true; // Keep the message channel open for async response (important!)
  } else if (request.action === "unflagText") {
    // Simulate unflagging (e.g., return a higher credibility score)
    sendResponse({ credibilityScore: Math.random() * 0.2 + 0.8 }); // Example: Score between 0.8 and 1.0
    return true; // Keep the message channel open
  }
});