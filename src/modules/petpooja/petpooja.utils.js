import axios from "axios";
import petpoojaConfig from "../../config/petpooja.js";
import { PETPOOJA_DEFAULT_TIMEOUT_MS } from "./petpooja.constants.js";

/* =========================
   HEADERS BUILDER
========================= */
const buildPetpoojaHeaders = () => {
    return {
        "Content-Type": "application/json",
    };
};

/* =========================
   CONFIG VALIDATION
========================= */
export const assertPetpoojaConfigured = () => {
    const missing = [];

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

    if (!petpoojaConfig.restId) {
        missing.push("PETPOOJA_REST_ID");
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
   MENU CLIENT
========================= */
export const petpoojaMenuClient = petpoojaConfig.menuBaseUrl
    ? axios.create({
          baseURL: petpoojaConfig.menuBaseUrl,
          timeout: PETPOOJA_DEFAULT_TIMEOUT_MS,
          headers: buildPetpoojaHeaders(),
      })
    : null;

/* =========================
   ORDER CLIENT
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

    if (response) {
        return {
            statusCode: response.status || 502,
            body: {
                message: "Petpooja API request failed",
                petpooja: response.data,
            },
        };
    }

    return {
        statusCode: error?.statusCode || 500,
        body: {
            message: error?.message || "Unexpected error",
            ...(error?.details ? { details: error.details } : {}),
        },
    };
};