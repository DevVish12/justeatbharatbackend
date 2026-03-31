import express from "express";
import rateLimit from "express-rate-limit";
import adminAuthMiddleware from "../../middlewares/adminAuth.middleware.js";
import {
    forgotAdminPasswordController,
    getAdminProfileController,
    loginAdminController,
    logoutAdminController,
    registerAdminController,
    resetAdminPasswordController,
} from "./admin.controller.js";

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Try again in 15 minutes." },
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 6,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many password reset requests. Try later." },
});

router.post("/register", registerAdminController);
router.post("/login", loginLimiter, loginAdminController);
router.post("/forgot-password", forgotPasswordLimiter, forgotAdminPasswordController);
router.post("/reset-password", resetAdminPasswordController);
router.get("/me", adminAuthMiddleware, getAdminProfileController);
router.post("/logout", adminAuthMiddleware, logoutAdminController);

export default router;
