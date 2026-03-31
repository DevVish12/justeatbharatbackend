import express from "express";
import adminAuthMiddleware from "../../middlewares/adminAuth.middleware.js";
import { syncPetpoojaMenuController } from "./admin.petpoojaSync.controller.js";

const router = express.Router();

// POST /api/admin/sync-petpooja-menu
router.post("/admin/sync-petpooja-menu", adminAuthMiddleware, syncPetpoojaMenuController);

export default router;
