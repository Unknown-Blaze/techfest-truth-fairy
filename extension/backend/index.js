const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const app = express();

// Initialize Firebase Admin with your service account credentials
const serviceAccount = require('./firebase_credentials.json');

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
    const webpageRef = db.collection('webpages').where('url', '==', url);
    const snapshot = await webpageRef.get();

    if (snapshot.empty) {
        return res.json({ message: "No annotations found" });
    }

    const data = snapshot.docs.map(doc => doc.data());
    res.json(data);
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
