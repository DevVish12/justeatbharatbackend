import admin from "firebase-admin";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Expected location:
// backend/src/firebase-service-account.json
const SERVICE_ACCOUNT_PATH = path.resolve(
    __dirname,
    "..",
    "firebase-service-account.json"
);

let initPromise = null;
let hasLoggedSuccess = false;

const formatFsError = (error) => {
    if (!error) {
        return "";
    }

    if (error.code === "ENOENT") {
        return `Service account file not found at: ${SERVICE_ACCOUNT_PATH}`;
    }

    return error.message || String(error);
};

export const initFirebaseAdmin = async () => {
    if (admin.apps?.length) {
        return admin.app();
    }

    if (initPromise) {
        return initPromise;
    }

    initPromise = (async () => {
        try {
            const raw = await readFile(SERVICE_ACCOUNT_PATH, "utf8");
            const serviceAccount = JSON.parse(raw);

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });

            if (!hasLoggedSuccess) {
                console.log("Firebase Admin Initialized Successfully");
                hasLoggedSuccess = true;
            }

            return admin.app();
        } catch (error) {
            console.error(
                "Failed to initialize Firebase Admin:",
                formatFsError(error)
            );

            // allow retry after fixing file
            initPromise = null;

            throw error;
        }
    })();

    return initPromise;
};

export { admin };
export default admin;
