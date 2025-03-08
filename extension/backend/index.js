const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const app = express();

// Initialize Firebase Admin with your service account credentials
const serviceAccount = require('./firebase_credentials.json');

const cors = require('cors')

app.use(cors());

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://truthfairy-86766.firebaseio.com"
});

// Set up body parser to parse incoming JSON data
app.use(bodyParser.json());

const db = admin.firestore();

// Test Firebase connection
db.collection('test')
    .doc('testdoc')
    .set({ test: 'connected' })
    .then(() => {
        console.log("Firebase connected");
    })
    .catch((err) => {
        console.log("Error connecting to Firebase", err);
    });

// Endpoint to flag text
app.post('/flagText', async (req, res) => {
    const { text, website, userId } = req.body;
    console.log("Received flagText request:", text, website, userId);

    // Check if the text already exists in the database
    const flaggedRef = db.collection('flaggedTexts');
    const existingQuery = await flaggedRef
        .where('text', '==', text)
        .where('website', '==', website)
        .get();

    if (!existingQuery.empty) {
        // Update the flagged text document
        let doc = existingQuery.docs[0];
        await doc.ref.update({
            flaggedBy: admin.firestore.FieldValue.arrayUnion(userId),
            lastUpdated: admin.firestore.Timestamp.now(),
        });

        return res.json({ message: "Updated existing flag", flaggedTextId: doc.id });
    }

    // Create a new flagged text document
    const newFlagRef = await flaggedRef.add({
        text,
        website,
        flaggedBy: [userId],
        AI_verification: null,
        discussionThread: null,
        createdAt: admin.firestore.Timestamp.now(),
        lastUpdated: admin.firestore.Timestamp.now(),
    });

    res.json({ message: "Flagged successfully", flaggedTextId: newFlagRef.id });
});

// Endpoint to verify text with AI results
app.post('/verifyText', async (req, res) => {
    const { flaggedTextId, aiResult, aiScore } = req.body;

    const flaggedRef = db.collection('flaggedTexts').doc(flaggedTextId);
    await flaggedRef.update({
        AI_verification: { score: aiScore, result: aiResult },
        lastUpdated: admin.firestore.Timestamp.now(),
    });

    res.json({ message: "AI Verification Updated" });
});

// Endpoint to get annotations based on URL
app.get('/getAnnotations', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ message: "Missing URL parameter" });
    }

    console.log("Querying annotations for:", url);

    try {
        const snapshot = await db.collection('flaggedTexts').where('website', '==', url).get();
        if (snapshot.empty) {
            return res.json({ message: "No annotations found" });
        }
        console.log("Annotations found:", snapshot.docs.map(doc => doc.data()));

        const flaggedTexts = snapshot.docs.map(doc => ({
            id: doc.id,
            text: doc.data().text,
            AI_verification: doc.data().AI_verification,
            flaggedBy: doc.data().flaggedBy,
            justification: doc.data().AI_verification.justification,
        } 
    ));
        // console.log(snapshot.docs.AI_verification);
        console.log("Flagged texts:", flaggedTexts);

        res.json(flaggedTexts);
    } catch (error) {
        console.error("Error retrieving annotations:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Endpoint to add a discussion message for a flagged text
app.post('/addDiscussionMessage', async (req, res) => {
    const { text, userId, message, url } = req.body;

    // First, check if the flagged text document exists based on the text or url fields
    const flaggedRef = db.collection('flaggedTexts');

    // Test querying by only the 'text' field first to debug
    const existingQuery = await flaggedRef.where('text', '==', text).get();
    console.log("Query by text result:", existingQuery);

    // Test querying by only the 'url' field
    // const existingQueryByUrl = await flaggedRef.where('url', '==', url).get();
    // console.log("Query by url result:", existingQueryByUrl);

    // // Check if both fields are provided and then run the query with both
    // const existingQuery = await flaggedRef
    //     .where('text', '==', text)
    //     .where('url', '==', url) // Search by both text and URL
    //     .get();
    // console.log("Existing query:", existingQuery);

    if (existingQuery.empty) {
        return res.status(404).json({ message: "Flagged text not found for this URL" });
    }

    // Get the flaggedTextId (document ID)
    const flaggedTextId = existingQuery.docs[0].id;
    console.log("Flagged text ID:", flaggedTextId);

    // Now, add the message to the discussion thread for the matched flaggedTextId
    const newMessage = {
        userId,
        message,
        timestamp: admin.firestore.Timestamp.now(),
    };
    console.log("New message:", newMessage);

    // Update the flagged text with the new message in the discussion thread
    await flaggedRef.doc(flaggedTextId).update({
        discussionThread: admin.firestore.FieldValue.arrayUnion(newMessage),
        lastUpdated: admin.firestore.Timestamp.now(),
    });
    console.log("Discussion thread updated");

    res.json({ message: "Message added to discussion", flaggedTextId });
});

app.get('/getDiscussionThreads', async (req, res) => {
    const { text } = req.query; // Get the text parameter from the request
    console.log("Querying discussion threads for:", text);

    if (!text) {
        return res.status(400).json({ message: "Text parameter is required" });
    }

    const flaggedRef = db.collection('flaggedTexts');

    // Query the database to find documents where the text matches the provided text
    const querySnapshot = await flaggedRef.where('text', '==', text).get();

    // Check if any document matches the text
    if (querySnapshot.empty) {
        return res.status(404).json({ message: "No flagged texts found for the given text" });
    }
    console.log("Query snapshot:", querySnapshot);

    // Extract the discussion threads and additional fields from the matched documents
    const discussionThreads = querySnapshot.docs.map(doc => ({
        id: doc.id, // Include the document ID for reference
        discussionThread: doc.data().discussionThread || [], // Get the discussion thread or an empty array if none exists
        category: doc.data().AI_verification.category || "Uncategorized", // Assuming category is stored in the database
        justification: doc.data().AI_verification.justification || "No justification provided", // Assuming justification is stored in the database
        sources: doc.data().AI_verification.sources || [] // Assuming sources is an array in the database
    }));

    console.log("Discussion threads:", discussionThreads.map(thread => thread.discussionThread));

    // Return the list of discussion threads with additional information
    res.json(discussionThreads);
});

// Endpoint to store AI analysis in the database
app.post('/store_analysis', async (req, res) => {
    const { text, url, category, justification, sources, userId } = req.body;
    console.log("Storing AI analysis for:", text, url);

    try {
        const flaggedRef = db.collection('flaggedTexts');

        // Query to find the flagged text document
        const existingQuery = await flaggedRef
            .where('text', '==', text)
            .where('website', '==', url)
            .get();

        if (existingQuery.empty) {
            return res.status(404).json({ message: "Flagged text not found" });
        }

        // Get the flagged text document ID
        const flaggedTextId = existingQuery.docs[0].id;
        console.log("Updating flagged text ID:", flaggedTextId);

        // Update the flagged text document with AI analysis
        await flaggedRef.doc(flaggedTextId).update({
            AI_verification: {
                category,
                justification,
                sources,
                analyzedBy: userId,
            },
            lastUpdated: admin.firestore.Timestamp.now(),
        });

        res.json({ success: true, message: "AI analysis stored successfully" });
    } catch (error) {
        console.error("Error storing AI analysis:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

app.post('/flagImage', async (req, res) => {
    const { imageUrl, url, prediction, heatmap_image, userId } = req.body;
    console.log("Received flagImage request:", imageUrl, url, prediction, userId);

    if (!imageUrl || !url || prediction === undefined || !userId) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        const flaggedRef = db.collection('flaggedImages');

        // Check if the image URL is already flagged
        const existingQuery = await flaggedRef
            .where('imageUrl', '==', imageUrl)
            .where('website', '==', url)
            .get();

        if (!existingQuery.empty) {
            // Update existing flagged image
            let doc = existingQuery.docs[0];
            await doc.ref.update({
                flaggedBy: admin.firestore.FieldValue.arrayUnion(userId),
                lastUpdated: admin.firestore.Timestamp.now(),
                prediction,
                heatmap_image
            });

            return res.json({ message: "Updated existing flagged image", flaggedImageId: doc.id });
        }

        // Create a new flagged image entry
        const newFlagRef = await flaggedRef.add({
            imageUrl,
            website: url,
            flaggedBy: [userId],
            prediction, // AI analysis result (0 = fake, 1 = real)
            heatmap_image, // AI-generated heatmap
            createdAt: admin.firestore.Timestamp.now(),
            lastUpdated: admin.firestore.Timestamp.now(),
        });

        res.json({ message: "Image flagged successfully", flaggedImageId: newFlagRef.flaggedBy[0] });
    } catch (error) {
        console.error("Error flagging image:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Add the endpoint to get all flagged images
app.get('/flaggedImages', async (req, res) => {
    try {
        const flaggedRef = db.collection('flaggedImages');
        const snapshot = await flaggedRef.get();

        if (snapshot.empty) {
            return res.status(404).json({ message: "No flagged images found" });
        }

        const flaggedImages = snapshot.docs.map(doc => ({
            id: doc.id, // Document ID
            imageUrl: doc.data().imageUrl, // Image URL
            website: doc.data().website, // Website URL
            flaggedBy: doc.data().flaggedBy, // List of user IDs who flagged the image
            prediction: doc.data().prediction, // AI prediction (0 = fake, 1 = real)
            heatmap_image: doc.data().heatmap_image, // AI-generated heatmap image
            createdAt: doc.data().createdAt.toDate(), // Timestamp converted to date
            lastUpdated: doc.data().lastUpdated.toDate(), // Timestamp converted to date
        }));

        res.json(flaggedImages);
    } catch (error) {
        console.error("Error retrieving flagged images:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});



// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});