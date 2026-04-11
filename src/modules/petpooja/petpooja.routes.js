import express from "express";
import {
    cancelOrder,
    createOrder,
    menu,
    orderCallback,
    pushMenu,
    storeStatus,
    updateStoreStatus,
    updateItemStock
} from "./petpooja.controller.js";

const router = express.Router();

// router.get("/menu", testMenu);
router.get("/menu", menu);
router.post("/pushmenu", pushMenu);
router.post("/save-order", createOrder);
router.post("/order-callback", orderCallback);
router.post("/cancel-order", cancelOrder);
router.post("/store-status", storeStatus);
router.post("/update_store_status", updateStoreStatus);
router.post("/item_stock", updateItemStock);

export default router;
