import express from "express";
import adminAuthMiddleware from "../../middlewares/adminAuth.middleware.js";
import {
    listLoginHistoryController,
    listUsersController,
} from "./admin.user.controller.js";

const router = express.Router();

// GET /api/admin/users
router.get("/users", adminAuthMiddleware, listUsersController);

// GET /api/admin/login-history
router.get("/login-history", adminAuthMiddleware, listLoginHistoryController);

export default router;
