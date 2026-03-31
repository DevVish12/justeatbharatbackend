import dotenv from "dotenv";

dotenv.config();

const env = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: Number(process.env.PORT || 5000),
    DB_HOST: process.env.DB_HOST || "localhost",
    DB_PORT: Number(process.env.DB_PORT || 3306),
    DB_USER: process.env.DB_USER || "root",
    DB_PASSWORD: process.env.DB_PASSWORD || "",
    DB_NAME: process.env.DB_NAME || "taste_trekker_town",
    JWT_SECRET: process.env.JWT_SECRET || "replace_me_with_long_random_secret",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1h",
    CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:8080",
    BACKEND_BASE_URL: process.env.BACKEND_BASE_URL || "http://localhost:5000",
    ADMIN_API_PREFIX: process.env.ADMIN_API_PREFIX || "admin-auth-9x7k2",
    FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL || "http://localhost:8080",
    ADMIN_RESET_PATH: process.env.ADMIN_RESET_PATH || "secure-portal-r9k-reset",
    SMTP_HOST: process.env.SMTP_HOST || "",
    SMTP_PORT: Number(process.env.SMTP_PORT || 587),
    SMTP_USER: process.env.SMTP_USER || "",
    SMTP_PASS: process.env.SMTP_PASS || "",
    SMTP_FROM: process.env.SMTP_FROM || "no-reply@taste-trekker.local",

    USER_JWT_EXPIRES_IN: process.env.USER_JWT_EXPIRES_IN || "7d",
    USER_AUTH_COOKIE_NAME: process.env.USER_AUTH_COOKIE_NAME || "user_auth_token",

    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",

    // Redis (optional)
    // Example: redis://localhost:6379 or rediss://user:pass@host:port
    REDIS_URL: process.env.REDIS_URL || "",
};

export default env;
