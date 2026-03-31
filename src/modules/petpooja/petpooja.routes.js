import express from "express";
import {
    createOrder,
    menu,
    orderCallback,
    storeStatus
} from "./petpooja.controller.js";

const router = express.Router();

// router.get("/menu", testMenu);
router.get("/menu", menu);
router.post("/save-order", createOrder);
router.post("/order-callback", orderCallback);
router.get("/store-status", storeStatus);

export default router;
