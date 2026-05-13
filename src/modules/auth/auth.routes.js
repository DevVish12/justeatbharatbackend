// import express from "express";
// import rateLimit from "express-rate-limit";
// import userAuthMiddleware from "../../middlewares/userAuth.middleware.js";
// import {
// 	firebaseLoginController,
// 	getMeController,
// 	logoutController,
// 	updateMeController,
// } from "./auth.controller.js";

// const router = express.Router();

// const firebaseLoginLimiter = rateLimit({
// 	windowMs: 10 * 60 * 1000,
// 	max: 60,
// 	standardHeaders: true,
// 	legacyHeaders: false,
// 	message: { message: "Too many login attempts. Try again later." },
// });

// router.post("/auth/firebase-login", firebaseLoginLimiter, firebaseLoginController);
// router.get("/auth/me", userAuthMiddleware, getMeController);
// router.put("/auth/me", userAuthMiddleware, updateMeController);
// router.post("/auth/logout", logoutController);

// export default router;

import express from "express";
import rateLimit from "express-rate-limit";
import userAuthMiddleware from "../../middlewares/userAuth.middleware.js";
import {
    getMeController,
    logoutController,
    resendOtpController,
    sendOtpController,
    updateMeController,
    verifyOtpController,
} from "./auth.controller.js";

const router = express.Router();


const otpRequestLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many OTP requests. Try again later." },
});

router.post("/auth/send-otp", otpRequestLimiter, sendOtpController);
router.post("/auth/verify-otp", verifyOtpController);
router.post("/auth/resend-otp", otpRequestLimiter, resendOtpController);
router.get("/auth/me", userAuthMiddleware, getMeController);
router.put("/auth/me", userAuthMiddleware, updateMeController);
router.post("/auth/logout", logoutController);

export default router;
