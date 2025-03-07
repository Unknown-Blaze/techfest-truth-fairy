// background.js

// Example: Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "flagText") {
    // 1. Receive data from content script (selectedText, pageURL, etc.)
    const { selectedText, pageURL, pageTitle } = request;

    // 2. Send data to Firebase (Firestore)
    //  (Replace with your Firebase initialization and data handling)
    //  This is a *placeholder*.  You'll need to integrate the actual
    //  Firebase SDK and structure your data appropriately.

     console.log("Received flagText request:", selectedText, pageURL, pageTitle)

    //send back a dummy value
     sendResponse({ veracityScore: Math.random() }); // Simulate AI score for now

    // ***  Firebase interaction (example using the Firebase JS SDK) ***
    /*  (UNCOMMENT AND FILL IN ONCE FIREBASE IS SET UP)
    import { initializeApp } from "firebase/app";
    import { getFirestore, collection, addDoc } from "firebase/firestore";

    const firebaseConfig = {
      // YOUR FIREBASE CONFIG HERE
    };

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
        sendResponse({ docId: docRef.id, veracityScore: Math.random() }); // Simulate AI score
      })
      .catch((error) => {
        console.error("Error adding document: ", error);
        sendResponse({ error: "Failed to save data" });
      });
    */

    return true; // Keep the message channel open for async response (important!)
  } else if (request.action === "unflagText"){
        //send back a dummy value
     sendResponse({ veracityScore: Math.random() });
     return true;
  }
});