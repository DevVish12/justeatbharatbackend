import twilio from "twilio";
import env from "../config/env.js";

let cachedClient = null;

const requireTwilioConfig = () => {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !verifyServiceSid) {
        const error = new Error(
            "Twilio Verify is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID."
        );
        error.statusCode = 500;
        throw error;
    }

    return { accountSid, authToken, verifyServiceSid };
};

const getClient = () => {
    if (cachedClient) {
        return cachedClient;
    }

    const { accountSid, authToken } = requireTwilioConfig();
    cachedClient = twilio(accountSid, authToken);
    return cachedClient;
};

const toFriendlyTwilioError = (error) => {
    const status = Number(error?.status || error?.statusCode || 0);
    const code = String(error?.code || "");
    const message = String(error?.message || "");

    // Common Verify failures:
    // - 429: too many requests
    // - 400 w/ specific codes for invalid params
    if (status === 429) {
        return { statusCode: 429, message: "Too many attempts. Please try again later." };
    }

    // Twilio may return code 20404 (not found) for bad service sid, etc.
    if (code === "20404") {
        return { statusCode: 500, message: "OTP service misconfigured. Please contact support." };
    }

    // Invalid phone or invalid code typically surface as 400.
    if (status >= 400 && status < 500) {
        return { statusCode: 400, message: "Request failed. Please check details and try again." };
    }

    return {
        statusCode: 502,
        message: message || "OTP service unavailable. Please try again.",
    };
};

export const sendVerifyOtpSms = async ({ toE164 }) => {
    try {
        const { verifyServiceSid } = requireTwilioConfig();
        const client = getClient();

        const result = await client.verify.v2
            .services(verifyServiceSid)
            .verifications.create({
                to: toE164,
                channel: "sms",
            });

        return result;
    } catch (error) {
        const friendly = toFriendlyTwilioError(error);
        const err = new Error(friendly.message);
        err.statusCode = friendly.statusCode;
        err.details = {
            provider: "twilio",
            status: error?.status,
            code: error?.code,
        };
        throw err;
    }
};

export const checkVerifyOtp = async ({ toE164, code }) => {
    try {
        const { verifyServiceSid } = requireTwilioConfig();
        const client = getClient();

        const result = await client.verify.v2
            .services(verifyServiceSid)
            .verificationChecks.create({
                to: toE164,
                code,
            });

        return result;
    } catch (error) {
        const friendly = toFriendlyTwilioError(error);
        const err = new Error(friendly.message);
        err.statusCode = friendly.statusCode;
        err.details = {
            provider: "twilio",
            status: error?.status,
            code: error?.code,
        };
        throw err;
    }
};
