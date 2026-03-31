import express from "express";
import adminAuthMiddleware from "../../middlewares/adminAuth.middleware.js";
import {
    createContactController,
    deleteAdminContactController,
    getAdminContactsController,
} from "./contact.controller.js";

const router = express.Router();

// Public
router.post("/contact", createContactController);

// Admin
router.get("/admin/contacts", adminAuthMiddleware, getAdminContactsController);
router.delete(
    "/admin/contacts/:id",
    adminAuthMiddleware,
    deleteAdminContactController
);

export default router;
