import express from "express";
import adminAuthMiddleware from "../../middlewares/adminAuth.middleware.js";
import userAuthMiddleware from "../../middlewares/userAuth.middleware.js";
import {
    createOrderController,
    getOrderController,
    listMyOrdersController,
    listOrdersController,
    updateOrderStatusController,
    verifyRazorpayPaymentController,
} from "./order.controller.js";
import { createOrdersTable } from "./order.model.js";

const router = express.Router();

await createOrdersTable();

// Customer checkout
router.post("/orders/create", createOrderController);

// Online payment verification
router.post("/orders/verify", verifyRazorpayPaymentController);

// User dashboard
router.get("/orders/my", userAuthMiddleware, listMyOrdersController);

// Admin dashboard
router.get("/orders", adminAuthMiddleware, listOrdersController);
router.get("/orders/:id", adminAuthMiddleware, getOrderController);
router.put("/orders/status", adminAuthMiddleware, updateOrderStatusController);

export default router;
