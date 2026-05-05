import axios from "axios";
import petpoojaConfig from "../../config/petpooja.js";
import {
    PETPOOJA_DEFAULT_TIMEOUT_MS,
    PETPOOJA_HEADER_ACCESS_TOKEN,
    PETPOOJA_HEADER_APP_KEY,
    PETPOOJA_HEADER_APP_SECRET,
} from "./petpooja.constants.js";

/* =========================
   HEADERS BUILDER
========================= */
const buildPetpoojaHeaders = () => {
    const headers = {
        "Content-Type": "application/json",
    };

    if (petpoojaConfig.appKey) {
        headers[PETPOOJA_HEADER_APP_KEY] = petpoojaConfig.appKey;
    }

    if (petpoojaConfig.appSecret) {
        headers[PETPOOJA_HEADER_APP_SECRET] = petpoojaConfig.appSecret;
    }

    if (petpoojaConfig.accessToken) {
        headers[PETPOOJA_HEADER_ACCESS_TOKEN] = petpoojaConfig.accessToken;
    }

    return headers;
};

/* =========================
   CONFIG VALIDATION
========================= */
export const assertPetpoojaConfigured = () => {
    const missing = [];

    // ✅ ONLY ORDER BASE REQUIRED (LIVE PUSH MODE)
    if (!petpoojaConfig.orderBaseUrl) {
        missing.push("PETPOOJA_ORDER_BASE_URL");
    }

    if (!petpoojaConfig.appKey) {
        missing.push("PETPOOJA_APP_KEY");
    }

    if (!petpoojaConfig.appSecret) {
        missing.push("PETPOOJA_APP_SECRET");
    }

    if (!petpoojaConfig.accessToken) {
        missing.push("PETPOOJA_ACCESS_TOKEN");
    }

    if (missing.length > 0) {
        const error = new Error(
            `Petpooja is not configured. Missing env vars: ${missing.join(", ")}`
        );
        error.statusCode = 500;
        throw error;
    }
};

/* =========================
   MENU CLIENT (OPTIONAL)
========================= */
// ⚠️ LIVE में USE नहीं होगा (push only)
export const petpoojaMenuClient = petpoojaConfig.menuBaseUrl
    ? axios.create({
          baseURL: petpoojaConfig.menuBaseUrl,
          timeout: PETPOOJA_DEFAULT_TIMEOUT_MS,
          headers: buildPetpoojaHeaders(),
      })
    : null;

/* =========================
   ORDER CLIENT (MAIN)
========================= */
export const petpoojaOrderClient = axios.create({
    baseURL: petpoojaConfig.orderBaseUrl,
    timeout: PETPOOJA_DEFAULT_TIMEOUT_MS,
    headers: buildPetpoojaHeaders(),
});

/* =========================
   ERROR HANDLER
========================= */
export const toHttpErrorPayload = (error) => {
    const response = error?.response;

    // 🔥 Petpooja API error
    if (response) {
        return {
            statusCode: response.status || 502,
            body: {
                message: "Petpooja API request failed",
                petpooja: response.data,
            },
        };
    }

    // 🔥 Network / server error
    return {
        statusCode: error?.statusCode || 500,
        body: {
            message: error?.message || "Unexpected error",
            ...(error?.details ? { details: error.details } : {}),
        },
    };
};