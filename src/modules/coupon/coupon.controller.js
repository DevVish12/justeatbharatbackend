import {
    countAnyCouponUsageByUser,
    countCouponUsage,
    countCouponUsageByUser,
    createCoupon,
    deleteCouponById,
    getAllCoupons,
    getCouponByCode,
    getCouponById,
    updateCouponById,
} from "./coupon.model.js";

const allowedDiscountTypes = new Set(["flat", "percent", "free_item", "bogo"]);
const allowedStatus = new Set(["active", "inactive"]);

const toNumber = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const toInt = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const n = Number.parseInt(String(value), 10);
    return Number.isFinite(n) ? n : null;
};

const toBool = (value) => {
    if (value === true || value === 1 || value === "1") return true;
    if (value === false || value === 0 || value === "0") return false;
    if (typeof value === "string") {
        const v = value.trim().toLowerCase();
        if (v === "true") return true;
        if (v === "false") return false;
    }
    return false;
};

const parseDateTime = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
        d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const normalizeCode = (code) => String(code || "").trim().toUpperCase();

const discountTypeForPetpooja = (type) => {
    if (type === "flat") return "F";
    if (type === "percent") return "P";
    if (type === "free_item") return "FI";
    if (type === "bogo") return "B";
    return "";
};

const sumDishSubtotal = (cartItems, dishId) => {
    const targetId = String(dishId || "");
    if (!targetId) return 0;

    let subtotal = 0;
    for (const it of cartItems) {
        const itemId = String(it?.itemid ?? it?.itemId ?? it?.id ?? "");
        if (!itemId || itemId !== targetId) continue;
        const price = Number(it?.price || 0);
        const qty = Number(it?.quantity || it?.qty || 0);
        if (!Number.isFinite(price) || !Number.isFinite(qty)) continue;
        subtotal += price * qty;
    }
    return subtotal;
};

const findCartItemById = (cartItems, dishId) => {
    const targetId = String(dishId || "");
    if (!targetId) return null;

    for (const it of cartItems) {
        const itemId = String(it?.itemid ?? it?.itemId ?? it?.id ?? "");
        if (itemId === targetId) return it;
    }
    return null;
};

export const listCouponsController = async (req, res, next) => {
    try {
        const includeInactive = Boolean(req.admin);
        const coupons = await getAllCoupons({ includeInactive });
        return res.status(200).json({ coupons });
    } catch (error) {
        return next(error);
    }
};

export const getCouponByCodeController = async (req, res, next) => {
    try {
        const code = normalizeCode(req.params.code);
        if (!code) {
            return res.status(400).json({ message: "Invalid coupon code" });
        }

        const coupon = await getCouponByCode(code);
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }

        if (!req.admin) {
            if (coupon.status !== "active") {
                return res.status(404).json({ message: "Coupon not found" });
            }
            if (coupon.expiryDate && new Date(coupon.expiryDate).getTime() <= Date.now()) {
                return res.status(404).json({ message: "Coupon expired" });
            }
        }

        return res.status(200).json({ coupon });
    } catch (error) {
        return next(error);
    }
};

export const createCouponController = async (req, res, next) => {
    try {
        const code = normalizeCode(req.body?.code);
        const title = String(req.body?.title || "").trim();
        const description = String(req.body?.description || "").trim();
        const discountType = String(
            (req.body?.discount_type ?? req.body?.discountType) || ""
        ).trim();
        const status = String(req.body?.status || "active").trim();

        if (!code) {
            return res.status(400).json({ message: "code is required" });
        }

        if (!allowedDiscountTypes.has(discountType)) {
            return res.status(400).json({ message: "Invalid discount_type" });
        }

        if (!allowedStatus.has(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const coupon = await createCoupon({
            code,
            title,
            description,
            discountType,
            discountValue: toNumber(req.body?.discount_value ?? req.body?.discountValue),
            minOrder: toNumber(req.body?.min_order ?? req.body?.minOrder),
            dishId: String((req.body?.dish_id ?? req.body?.dishId) || "").trim(),
            freeItemId: String((req.body?.free_item_id ?? req.body?.freeItemId) || "").trim(),
            maxDiscount: toNumber(req.body?.max_discount ?? req.body?.maxDiscount),
            usageLimit: toInt(req.body?.usage_limit ?? req.body?.usageLimit),
            perUserLimit: toInt(req.body?.per_user_limit ?? req.body?.perUserLimit),
            expiryDate: parseDateTime(req.body?.expiry_date ?? req.body?.expiryDate),
            newUserOnly: toBool(req.body?.new_user_only ?? req.body?.newUserOnly),
            status,
        });

        return res.status(201).json({ message: "Coupon created", coupon });
    } catch (error) {
        return next(error);
    }
};

export const updateCouponController = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid coupon id" });
        }

        const existing = await getCouponById(id);
        if (!existing) {
            return res.status(404).json({ message: "Coupon not found" });
        }

        const patch = {};

        if (req.body?.code !== undefined) patch.code = normalizeCode(req.body.code);
        if (req.body?.title !== undefined) patch.title = String(req.body.title || "").trim();
        if (req.body?.description !== undefined) {
            patch.description = String(req.body.description || "").trim();
        }

        if (req.body?.discount_type !== undefined || req.body?.discountType !== undefined) {
            const nextType = String(
                (req.body?.discount_type ?? req.body?.discountType) || ""
            ).trim();
            if (!allowedDiscountTypes.has(nextType)) {
                return res.status(400).json({ message: "Invalid discount_type" });
            }
            patch.discountType = nextType;
        }

        if (req.body?.status !== undefined) {
            const nextStatus = String(req.body.status || "").trim();
            if (!allowedStatus.has(nextStatus)) {
                return res.status(400).json({ message: "Invalid status" });
            }
            patch.status = nextStatus;
        }

        if (req.body?.discount_value !== undefined || req.body?.discountValue !== undefined) {
            patch.discountValue = toNumber(req.body?.discount_value ?? req.body?.discountValue);
        }

        if (req.body?.min_order !== undefined || req.body?.minOrder !== undefined) {
            patch.minOrder = toNumber(req.body?.min_order ?? req.body?.minOrder);
        }

        if (req.body?.dish_id !== undefined || req.body?.dishId !== undefined) {
            patch.dishId = String((req.body?.dish_id ?? req.body?.dishId) || "").trim();
        }

        if (req.body?.free_item_id !== undefined || req.body?.freeItemId !== undefined) {
            patch.freeItemId = String(
                (req.body?.free_item_id ?? req.body?.freeItemId) || ""
            ).trim();
        }

        if (req.body?.max_discount !== undefined || req.body?.maxDiscount !== undefined) {
            patch.maxDiscount = toNumber(req.body?.max_discount ?? req.body?.maxDiscount);
        }

        if (req.body?.usage_limit !== undefined || req.body?.usageLimit !== undefined) {
            patch.usageLimit = toInt(req.body?.usage_limit ?? req.body?.usageLimit);
        }

        if (req.body?.per_user_limit !== undefined || req.body?.perUserLimit !== undefined) {
            patch.perUserLimit = toInt(req.body?.per_user_limit ?? req.body?.perUserLimit);
        }

        if (req.body?.expiry_date !== undefined || req.body?.expiryDate !== undefined) {
            patch.expiryDate = parseDateTime(req.body?.expiry_date ?? req.body?.expiryDate);
        }

        if (req.body?.new_user_only !== undefined || req.body?.newUserOnly !== undefined) {
            patch.newUserOnly = toBool(req.body?.new_user_only ?? req.body?.newUserOnly);
        }

        const updated = await updateCouponById(id, patch);
        return res.status(200).json({ message: "Coupon updated", coupon: updated });
    } catch (error) {
        return next(error);
    }
};

export const deleteCouponController = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid coupon id" });
        }

        const deleted = await deleteCouponById(id);
        if (!deleted) {
            return res.status(404).json({ message: "Coupon not found" });
        }

        return res.status(200).json({ message: "Coupon deleted" });
    } catch (error) {
        return next(error);
    }
};

export const validateCouponController = async (req, res, next) => {
    try {
        const code = normalizeCode(req.body?.coupon_code ?? req.body?.code);
        const cartTotalRaw = req.body?.cart_total ?? req.body?.cartTotal;
        const cartTotal = Number(cartTotalRaw);
        const cartItems = Array.isArray(req.body?.cart_items)
            ? req.body.cart_items
            : Array.isArray(req.body?.cartItems)
                ? req.body.cartItems
                : [];

        const userId = String(req.body?.user_id ?? req.body?.userId ?? "").trim();

        if (!code) {
            return res.status(400).json({ message: "coupon_code is required" });
        }

        if (!Number.isFinite(cartTotal) || cartTotal < 0) {
            return res.status(400).json({ message: "Invalid cart_total" });
        }

        if (!Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ message: "cart_items are required" });
        }

        const coupon = await getCouponByCode(code);
        if (!coupon || coupon.status !== "active") {
            return res.status(404).json({ message: "Coupon not found" });
        }

        if (coupon.expiryDate) {
            const expiresAt = new Date(coupon.expiryDate).getTime();
            if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
                return res.status(400).json({ message: "Coupon expired" });
            }
        }

        const minOrder = coupon.minOrder ?? 0;
        if (Number.isFinite(minOrder) && cartTotal < minOrder) {
            return res.status(400).json({ message: `Minimum order ₹${minOrder} required` });
        }

        const usageLimit = coupon.usageLimit;
        if (usageLimit !== null && usageLimit !== undefined) {
            const used = await countCouponUsage(coupon.id);
            if (used >= usageLimit) {
                return res.status(400).json({ message: "Coupon usage limit reached" });
            }
        }

        if (userId) {
            const perUserLimit = coupon.perUserLimit;
            if (perUserLimit !== null && perUserLimit !== undefined) {
                const usedByUser = await countCouponUsageByUser(coupon.id, userId);
                if (usedByUser >= perUserLimit) {
                    return res.status(400).json({ message: "Per-user coupon limit reached" });
                }
            }

            if (coupon.newUserOnly) {
                const anyUsed = await countAnyCouponUsageByUser(userId);
                if (anyUsed > 0) {
                    return res.status(400).json({ message: "Coupon valid for new users only" });
                }
            }
        } else {
            if (coupon.newUserOnly) {
                return res.status(400).json({ message: "Login required for this coupon" });
            }
        }

        if (coupon.discountType === "bogo" && !coupon.dishId) {
            return res.status(400).json({ message: "BOGO coupon requires dish_id" });
        }

        if (coupon.discountType === "free_item" && !coupon.freeItemId) {
            return res.status(400).json({ message: "Free item coupon requires free_item_id" });
        }

        if (coupon.dishId) {
            const eligible = findCartItemById(cartItems, coupon.dishId);
            if (!eligible) {
                return res.status(400).json({ message: "Coupon not applicable to selected dishes" });
            }
        }

        const baseAmount = coupon.dishId ? sumDishSubtotal(cartItems, coupon.dishId) : cartTotal;
        const maxDiscount = coupon.maxDiscount;

        let discountAmount = 0;
        let freeItem = null;

        if (coupon.discountType === "flat") {
            const v = coupon.discountValue ?? 0;
            discountAmount = Math.min(v, baseAmount);
        } else if (coupon.discountType === "percent") {
            const v = coupon.discountValue ?? 0;
            discountAmount = (baseAmount * v) / 100;
        } else if (coupon.discountType === "free_item") {
            freeItem = {
                itemid: coupon.freeItemId,
                quantity: 1,
            };
            discountAmount = 0;
        } else if (coupon.discountType === "bogo") {
            const eligible = findCartItemById(cartItems, coupon.dishId);
            const price = Number(eligible?.price || 0);
            const qty = Number(eligible?.quantity || eligible?.qty || 0);
            if (!Number.isFinite(price) || !Number.isFinite(qty) || qty < 2) {
                return res.status(400).json({ message: "BOGO requires quantity of 2 or more" });
            }
            const freeQty = Math.floor(qty / 2);
            discountAmount = freeQty * price;
        }

        if (maxDiscount !== null && maxDiscount !== undefined && Number.isFinite(maxDiscount)) {
            discountAmount = Math.min(discountAmount, maxDiscount);
        }

        discountAmount = Math.max(0, Math.min(discountAmount, cartTotal));
        const updatedTotal = Math.max(0, cartTotal - discountAmount);

        return res.status(200).json({
            discountAmount,
            freeItem,
            updatedTotal,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                title: coupon.title,
                description: coupon.description,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                minOrder: coupon.minOrder,
                dishId: coupon.dishId,
                freeItemId: coupon.freeItemId,
                maxDiscount: coupon.maxDiscount,
                usageLimit: coupon.usageLimit,
                perUserLimit: coupon.perUserLimit,
                expiryDate: coupon.expiryDate,
                newUserOnly: coupon.newUserOnly,
                status: coupon.status,
            },
            petpooja: {
                discount_type: discountTypeForPetpooja(coupon.discountType),
                description: `Coupon ${coupon.code} applied`,
            },
        });
    } catch (error) {
        return next(error);
    }
};
