import express from "express";
import adminAuthMiddleware from "../../middlewares/adminAuth.middleware.js";
import {
    createTableController,
    deleteTableController,
    getTablesController,
    updateTableController,
} from "./table.controller.js";
import { createTablesTable } from "./table.model.js";

const router = express.Router();

// Ensure DB table exists on startup (without touching server.js).
await createTablesTable();

// Public (used by CartPage)
router.get("/tables", getTablesController);

// Admin
router.post("/tables", adminAuthMiddleware, createTableController);
router.put("/tables/:id", adminAuthMiddleware, updateTableController);
router.delete("/tables/:id", adminAuthMiddleware, deleteTableController);

export default router;
