import admin from "firebase-admin";
import { initFirebaseAdmin } from "../../config/firebaseAdmin.js";

export const verifyFirebaseIdToken = async (idToken) => {
    if (!idToken) {
        const error = new Error("Firebase ID token is required");
        error.statusCode = 400;
        throw error;
    }

    await initFirebaseAdmin();

    try {
        return await admin.auth().verifyIdToken(idToken);
    } catch {
        const error = new Error("Invalid or expired Firebase token");
        error.statusCode = 401;
        throw error;
    }
};
