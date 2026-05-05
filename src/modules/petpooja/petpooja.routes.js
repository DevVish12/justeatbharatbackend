import express from "express";
import {
    cancelOrder,
    createOrder,
    menu,
    orderCallback,
    pushMenu,
    resetMenu,
    storeStatus,
    updateItemStock,
    updateStoreStatus
} from "./petpooja.controller.js";

const router = express.Router();

// ================= MENU =================
router.get("/menu", menu);

// ================= PUSH MENU =================
router.post("/pushmenu", pushMenu);

// ================= ORDER =================
router.post("/save_order", createOrder); // ✅ FIXED
router.post("/order_callback", orderCallback); // ✅ FIXED
router.post("/cancel_order", cancelOrder);

// ================= STORE =================
router.post("/store_status", storeStatus);
router.post("/update_store_status", updateStoreStatus);

// ================= STOCK =================
router.post("/item_stock", updateItemStock);

// ================= ADMIN =================
router.post("/reset_menu", resetMenu);

export default router;