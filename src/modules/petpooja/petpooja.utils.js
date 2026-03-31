// import axios from "axios";
// import petpoojaConfig from "../../config/petpooja.js";
// import {
//     PETPOOJA_DEFAULT_TIMEOUT_MS,
//     PETPOOJA_HEADER_ACCESS_TOKEN,
//     PETPOOJA_HEADER_APP_KEY,
//     PETPOOJA_HEADER_APP_SECRET,
// } from "./petpooja.constants.js";

// const buildPetpoojaHeaders = () => ({
//     "Content-Type": "application/json",
//     [PETPOOJA_HEADER_APP_KEY]: petpoojaConfig.appKey,
//     [PETPOOJA_HEADER_APP_SECRET]: petpoojaConfig.appSecret,
//     [PETPOOJA_HEADER_ACCESS_TOKEN]: petpoojaConfig.accessToken,
// });

// export const assertPetpoojaConfigured = () => {
//     const missing = [];

//     // if (!petpoojaConfig.baseUrl) missing.push("PETPOOJA_BASE_URL");

//     if (!petpoojaConfig.menuBaseUrl) missing.push("PETPOOJA_MENU_BASE_URL");
//     if (!petpoojaConfig.orderBaseUrl) missing.push("PETPOOJA_ORDER_BASE_URL");

//     if (!petpoojaConfig.appKey) missing.push("PETPOOJA_APP_KEY");
//     if (!petpoojaConfig.appSecret) missing.push("PETPOOJA_APP_SECRET");
//     if (!petpoojaConfig.accessToken) missing.push("PETPOOJA_ACCESS_TOKEN");

//     if (missing.length > 0) {
//         const error = new Error(
//             `Petpooja is not configured. Missing env vars: ${missing.join(", ")}`
//         );
//         error.statusCode = 500;
//         throw error;
//     }
// };

// export const petpoojaClient = axios.create({
//     baseURL: petpoojaConfig.baseUrl,
//     timeout: PETPOOJA_DEFAULT_TIMEOUT_MS,
//     headers: buildPetpoojaHeaders(),
// });

// export const toHttpErrorPayload = (error) => {
//     const response = error?.response;

//     if (response) {
//         return {
//             statusCode: response.status || 502,
//             body: {
//                 message: "Petpooja API request failed",
//                 petpooja: response.data,
//             },
//         };
//     }

//     return {
//         statusCode: error?.statusCode || 500,
//         body: {
//             message: error?.message || "Unexpected error",
//             ...(error?.details ? { details: error.details } : {}),
//         },
//     };
// };


import axios from "axios";
import petpoojaConfig from "../../config/petpooja.js";
import {
    PETPOOJA_DEFAULT_TIMEOUT_MS,
    PETPOOJA_HEADER_ACCESS_TOKEN,
    PETPOOJA_HEADER_APP_KEY,
    PETPOOJA_HEADER_APP_SECRET,
} from "./petpooja.constants.js";

const buildPetpoojaHeaders = () => ({
    "Content-Type": "application/json",
    [PETPOOJA_HEADER_APP_KEY]: petpoojaConfig.appKey,
    [PETPOOJA_HEADER_APP_SECRET]: petpoojaConfig.appSecret,
    [PETPOOJA_HEADER_ACCESS_TOKEN]: petpoojaConfig.accessToken,
});

export const assertPetpoojaConfigured = () => {

    const missing = [];

    if (!petpoojaConfig.menuBaseUrl) missing.push("PETPOOJA_MENU_BASE_URL");
    if (!petpoojaConfig.orderBaseUrl) missing.push("PETPOOJA_ORDER_BASE_URL");

    if (!petpoojaConfig.appKey) missing.push("PETPOOJA_APP_KEY");
    if (!petpoojaConfig.appSecret) missing.push("PETPOOJA_APP_SECRET");
    if (!petpoojaConfig.accessToken) missing.push("PETPOOJA_ACCESS_TOKEN");

    if (missing.length > 0) {
        const error = new Error(
            `Petpooja is not configured. Missing env vars: ${missing.join(", ")}`
        );
        error.statusCode = 500;
        throw error;
    }
};

export const petpoojaMenuClient = axios.create({
    baseURL: petpoojaConfig.menuBaseUrl,
    timeout: PETPOOJA_DEFAULT_TIMEOUT_MS,
    headers: buildPetpoojaHeaders(),
});

export const petpoojaOrderClient = axios.create({
    baseURL: petpoojaConfig.orderBaseUrl,
    timeout: PETPOOJA_DEFAULT_TIMEOUT_MS,
    headers: buildPetpoojaHeaders(),
});

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