import express from "express";
import adminAuthMiddleware from "../../middlewares/adminAuth.middleware.js";
import userAuthMiddleware from "../../middlewares/userAuth.middleware.js";
import { createTablesTable } from "../table/table.model.js";
import {
    createReservationController,
    listMyReservationsController,
    listReservationsController,
} from "./reservation.controller.js";
import { createReservationsTable } from "./reservation.model.js";

const router = express.Router();

// Ensure DB table exists on startup (without touching server.js).
await createTablesTable();
await createReservationsTable();

// User
router.get("/reservations/my", userAuthMiddleware, listMyReservationsController);
router.post("/reservations", userAuthMiddleware, createReservationController);

// Admin
router.get("/reservations", adminAuthMiddleware, listReservationsController);

export default router;
