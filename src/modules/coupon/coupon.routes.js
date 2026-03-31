import express from "express";
import adminAuthMiddleware from "../../middlewares/adminAuth.middleware.js";
import { verifyToken } from "../../utils/jwt.js";
import {
    createCouponController,
    deleteCouponController,
    getCouponByCodeController,
    listCouponsController,
    updateCouponController,
    validateCouponController,
} from "./coupon.controller.js";
import { createCouponTables } from "./coupon.model.js";

const router = express.Router();

await createCouponTables();

const optionalAdmin = (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token) return next();

        const decoded = verifyToken(token);
        if (decoded && decoded.role === "admin") {
            req.admin = decoded;
        }
    } catch {
        // ignore
    }
    next();
};

router.get("/coupons", optionalAdmin, listCouponsController);
router.get("/coupons/:code", optionalAdmin, getCouponByCodeController);
router.post("/coupons/validate", validateCouponController);

router.post("/coupons", adminAuthMiddleware, createCouponController);
router.put("/coupons/:id", adminAuthMiddleware, updateCouponController);
router.delete("/coupons/:id", adminAuthMiddleware, deleteCouponController);

export default router;
