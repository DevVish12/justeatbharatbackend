import crypto from "crypto";
import Razorpay from "razorpay";
import pool from "../../config/db.js";
import env from "../../config/env.js";
import { sendOrderToPetpooja } from "../petpooja/petpooja.order.service.js";
import { bookTableByNumberForPhone } from "../reservation/reservation.model.js";
import { getStoreOpen } from "../store/store.model.js";
import {
    createOrder,
    getOrderByDbId,
    getOrderByOrderId,
    getOrderByRazorpayOrderId,
    listOrders,
    listOrdersByPhone,
    markPaymentPaid,
    updateOrderStatus,
} from "./order.model.js";

const allowedPaymentMethods = new Set(["ONLINE", "OFFLINE"]);
const allowedOrderStatuses = new Set(["PLACED", "PREPARING", "COMPLETED"]);

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const normalizePhone = (raw) => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";

    // Prefer 10-digit local mobile number.
    if (digits.length === 12 && digits.startsWith("91")) {
        return digits.slice(2);
    }
    if (digits.length > 10) {
        return digits.slice(-10);
    }
    return digits;
};

const normalizeOrderType = (value) => {
    const v = String(value || "").trim().toLowerCase();
    if (v === "d" || v === "dine_in" || v === "dinein") return "D";
    if (v === "p" || v === "pickup" || v === "pick_up") return "P";
    return String(value || "").trim() || "";
};

const formatMysqlDatetime = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";

    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
        d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const normalizePetpoojaOrderType = (value) => {
    const v = String(value || "").trim().toLowerCase();
    if (v === "d" || v === "dinein" || v === "dine_in" || v.includes("dine")) return "D";
    if (v === "p" || v === "pickup" || v === "pick_up" || v.includes("pick")) return "P";
    if (v === "h" || v === "delivery" || v === "home_delivery" || v.includes("deliver")) return "H";
    return "H";
};

const normalizePetpoojaPaymentType = (value) => {
    const v = String(value || "").trim().toUpperCase();
    if (v === "ONLINE") return "ONLINE";
    if (v === "OFFLINE") return "COD";
    if (v === "COD") return "COD";
    return "COD";
};

const formatAmount = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

const extractSavedOrderItems = (createdOrderRow) => {
    try {
        const parsed = JSON.parse(createdOrderRow?.items_json || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const buildPetpoojaPayloadFromOrder = ({ createdOrderRow, reqBody }) => {
    const items = extractSavedOrderItems(createdOrderRow);

    const orderType = normalizePetpoojaOrderType(createdOrderRow?.order_type);
    const tableNo = String(createdOrderRow?.table_no || "").trim();

    const addressFromBody = String(
        reqBody?.address ?? reqBody?.customer_address ?? reqBody?.delivery_address ?? ""
    ).trim();
    const address = addressFromBody || (orderType === "D" && tableNo ? `Table ${tableNo}` : "-");

    const petpoojaItems = items
        .map((item) => {
            const id = String(item?.itemid ?? item?.itemId ?? item?.id ?? "").trim();
            const name = String(item?.name ?? "").trim();
            const price = Number(item?.price);
            const quantity = Number(item?.quantity ?? item?.qty);

            if (!id || !name || !Number.isFinite(price) || !Number.isFinite(quantity)) {
                return null;
            }

            return {
                id,
                name,
                price: formatAmount(price),
                final_price: formatAmount(price),
                quantity: String(quantity),
                gst_liability: "restaurant",
                tax_inclusive: true,
            };
        })
        .filter(Boolean);

    const createdOn = formatMysqlDatetime(new Date());

    return {
        orderID: String(createdOrderRow?.order_id || "").trim(),
        name: String(createdOrderRow?.user_name || "").trim(),
        phone: normalizePhone(createdOrderRow?.phone),
        address,
        order_type: orderType,
        payment_type: normalizePetpoojaPaymentType(createdOrderRow?.payment_method),
        total: formatAmount(createdOrderRow?.total),
        tax_total: formatAmount(createdOrderRow?.tax),
        created_on: createdOn,
        order_items: petpoojaItems,
        description: String(createdOrderRow?.special_instructions || "").trim(),
    };
};

let ensuredPetpoojaResponseColumn = false;

const ensurePetpoojaResponseColumn = async () => {
    if (ensuredPetpoojaResponseColumn) return;
    try {
        await pool.query(
            `ALTER TABLE orders ADD COLUMN petpooja_response LONGTEXT NULL`
        );
    } catch (error) {
        // If it already exists (or table doesn't support ALTER here), just continue.
        if (error?.code !== "ER_DUP_FIELDNAME") {
            throw error;
        }
    } finally {
        ensuredPetpoojaResponseColumn = true;
    }
};

const persistPetpoojaResponse = async ({ orderDbId, response }) => {
    const serialized = JSON.stringify(response ?? null);
    try {
        await pool.query(`UPDATE orders SET petpooja_response = ? WHERE id = ?`, [
            serialized,
            orderDbId,
        ]);
    } catch (error) {
        // Auto-heal older DBs missing this column.
        if (error?.code === "ER_BAD_FIELD_ERROR") {
            await ensurePetpoojaResponseColumn();
            await pool.query(`UPDATE orders SET petpooja_response = ? WHERE id = ?`, [
                serialized,
                orderDbId,
            ]);
            return;
        }
        throw error;
    }
};

const buildPublicOrder = (row) => {
    if (!row) return null;
    let items = [];
    try {
        items = JSON.parse(row.items_json || "[]");
    } catch {
        items = [];
    }

    return {
        id: row.id,
        order_id: row.order_id,
        user_name: row.user_name,
        phone: row.phone,
        order_type: row.order_type,
        table_no: row.table_no,
        items,
        subtotal: Number(row.subtotal),
        discount: Number(row.discount),
        tax: Number(row.tax),
        total: Number(row.total),
        payment_method: row.payment_method,
        payment_status: row.payment_status,
        order_status: row.order_status,
        special_instructions: row.special_instructions || "",
        razorpay_order_id: row.razorpay_order_id,
        razorpay_payment_id: row.razorpay_payment_id,
        created_at: row.created_at,
    };
};

const generateAppOrderId = () => {
    const rand = crypto.randomBytes(4).toString("hex");
    return `TTT-${Date.now()}-${rand}`;
};

const getRazorpayClient = () => {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
        throw new Error("Razorpay keys are not configured");
    }

    return new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
    });
};

const computeSubtotalFromItems = (items) => {
    let subtotal = 0;
    for (const it of items) {
        const price = toNumber(it?.price, 0);
        const qty = toNumber(it?.quantity ?? it?.qty, 0);
        if (price < 0 || qty < 0) continue;
        subtotal += price * qty;
    }
    return Math.max(0, subtotal);
};

export const createOrderController = async (req, res, next) => {
    try {
        const storeOpen = await getStoreOpen();
        if (!storeOpen) {
            return res.status(200).json({
                success: false,
                message: "Store is currently closed",
            });
        }

        const userName = String(req.body?.user_name ?? req.body?.userName ?? "").trim();
        const phone = normalizePhone(req.body?.phone);
        const orderType = normalizeOrderType(req.body?.order_type ?? req.body?.orderType);
        const tableNo = String(req.body?.table_no ?? req.body?.tableNo ?? "").trim();
        const paymentMethod = String(req.body?.payment_method ?? req.body?.paymentMethod ?? "")
            .trim()
            .toUpperCase();
        const specialInstructions = String(
            req.body?.special_instructions ?? req.body?.specialInstructions ?? ""
        ).trim();

        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        if (!userName) {
            return res.status(400).json({ message: "user_name is required" });
        }
        if (!phone) {
            return res.status(400).json({ message: "phone is required" });
        }
        if (!orderType) {
            return res.status(400).json({ message: "order_type is required" });
        }
        if (orderType === "D" && !tableNo) {
            return res.status(400).json({ message: "table_no is required for dine-in" });
        }
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "items are required" });
        }
        if (!allowedPaymentMethods.has(paymentMethod)) {
            return res.status(400).json({ message: "Invalid payment_method" });
        }

        const subtotal = computeSubtotalFromItems(items);
        const discount = Math.max(0, toNumber(req.body?.discount ?? req.body?.discount_total, 0));
        const tax = Math.max(0, toNumber(req.body?.tax, 0));
        const total = Math.max(0, subtotal - discount + tax);

        const orderId = generateAppOrderId();

        // Dine-in: book table for a fixed window so other users see it as booked.
        if (orderType === "D") {
            await bookTableByNumberForPhone({
                tableNumber: tableNo,
                phone,
                durationMinutes: 60,
            });
        }

        if (paymentMethod === "OFFLINE") {
            const created = await createOrder({
                orderId,
                userName,
                phone,
                orderType,
                tableNo: orderType === "D" ? tableNo : null,
                itemsJson: JSON.stringify(items),
                subtotal,
                discount,
                tax,
                total,
                paymentMethod,
                paymentStatus: "PENDING",
                orderStatus: "PLACED",
                specialInstructions,
                razorpayOrderId: null,
            });

            const petpoojaPayload = buildPetpoojaPayloadFromOrder({
                createdOrderRow: created,
                reqBody: req.body,
            });

            let petpoojaResponse = null;
            try {
                petpoojaResponse = await sendOrderToPetpooja(petpoojaPayload);
            } catch (error) {
                console.error("[Petpooja] Failed to send order (offline)", {
                    order_id: created?.order_id,
                    message: error?.message,
                    status: error?.response?.status,
                    data: error?.response?.data,
                });
                petpoojaResponse = {
                    ok: false,
                    error: error?.message || "Petpooja send failed",
                    status: error?.response?.status,
                    data: error?.response?.data,
                    at: formatMysqlDatetime(new Date()),
                };
            }

            try {
                await persistPetpoojaResponse({
                    orderDbId: created.id,
                    response: petpoojaResponse,
                });
            } catch (persistError) {
                console.error("[Petpooja] Failed to persist petpooja_response", {
                    order_id: created?.order_id,
                    message: persistError?.message,
                });
            }

            return res.status(201).json({
                message: "Order placed",
                order: buildPublicOrder(created),
            });
        }

        // ONLINE: create Razorpay order, store local order with payment PENDING.
        const razorpay = getRazorpayClient();
        const amountPaise = Math.round(total * 100);

        const rpOrder = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: orderId,
        });

        const created = await createOrder({
            orderId,
            userName,
            phone,
            orderType,
            tableNo: orderType === "D" ? tableNo : null,
            itemsJson: JSON.stringify(items),
            subtotal,
            discount,
            tax,
            total,
            paymentMethod,
            paymentStatus: "PENDING",
            orderStatus: "PLACED",
            specialInstructions,
            razorpayOrderId: rpOrder.id,
        });

        const petpoojaPayload = buildPetpoojaPayloadFromOrder({
            createdOrderRow: created,
            reqBody: req.body,
        });

        let petpoojaResponse = null;
        try {
            petpoojaResponse = await sendOrderToPetpooja(petpoojaPayload);
        } catch (error) {
            console.error("[Petpooja] Failed to send order (online)", {
                order_id: created?.order_id,
                message: error?.message,
                status: error?.response?.status,
                data: error?.response?.data,
            });
            petpoojaResponse = {
                ok: false,
                error: error?.message || "Petpooja send failed",
                status: error?.response?.status,
                data: error?.response?.data,
                at: formatMysqlDatetime(new Date()),
            };
        }

        try {
            await persistPetpoojaResponse({
                orderDbId: created.id,
                response: petpoojaResponse,
            });
        } catch (persistError) {
            console.error("[Petpooja] Failed to persist petpooja_response", {
                order_id: created?.order_id,
                message: persistError?.message,
            });
        }

        return res.status(201).json({
            message: "Razorpay order created",
            order: buildPublicOrder(created),
            razorpay: {
                key_id: env.RAZORPAY_KEY_ID,
                order_id: rpOrder.id,
                amount: rpOrder.amount,
                currency: rpOrder.currency,
                receipt: rpOrder.receipt,
            },
        });
    } catch (error) {
        return next(error);
    }
};

export const verifyRazorpayPaymentController = async (req, res, next) => {
    try {
        const orderId = String(req.body?.order_id ?? req.body?.receipt ?? "").trim();
        const razorpayOrderId = String(req.body?.razorpay_order_id || "").trim();
        const razorpayPaymentId = String(req.body?.razorpay_payment_id || "").trim();
        const razorpaySignature = String(req.body?.razorpay_signature || "").trim();

        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            return res.status(400).json({ message: "Missing Razorpay payment fields" });
        }

        const base = `${razorpayOrderId}|${razorpayPaymentId}`;
        const expected = crypto
            .createHmac("sha256", env.RAZORPAY_KEY_SECRET || "")
            .update(base)
            .digest("hex");

        if (expected !== razorpaySignature) {
            return res.status(400).json({ message: "Invalid payment signature" });
        }

        // Prefer linking by our receipt order id if provided.
        let updated = null;
        if (orderId) {
            const existing = await getOrderByOrderId(orderId);
            if (!existing) {
                return res.status(404).json({ message: "Order not found" });
            }
            updated = await markPaymentPaid({
                orderId,
                razorpayOrderId,
                razorpayPaymentId,
            });
        } else {
            const existing = await getOrderByRazorpayOrderId(razorpayOrderId);
            if (!existing) {
                return res.status(404).json({ message: "Order not found" });
            }
            updated = await markPaymentPaid({
                orderId: null,
                razorpayOrderId,
                razorpayPaymentId,
            });
        }

        return res.status(200).json({
            message: "Payment verified",
            order: buildPublicOrder(updated),
        });
    } catch (error) {
        return next(error);
    }
};

export const listOrdersController = async (req, res, next) => {
    try {
        const orders = await listOrders({ limit: req.query?.limit });
        return res.status(200).json({ orders: orders.map(buildPublicOrder) });
    } catch (error) {
        return next(error);
    }
};

export const listMyOrdersController = async (req, res, next) => {
    try {
        const phone = String(req.user?.phone || "").trim();
        if (!phone) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const orders = await listOrdersByPhone({ phone, limit: req.query?.limit });
        return res.status(200).json({ orders: orders.map(buildPublicOrder) });
    } catch (error) {
        return next(error);
    }
};

export const getOrderController = async (req, res, next) => {
    try {
        const raw = String(req.params.id || "").trim();
        if (!raw) return res.status(400).json({ message: "Invalid id" });

        const numeric = Number(raw);
        const order = Number.isInteger(numeric) && numeric > 0
            ? await getOrderByDbId(numeric)
            : await getOrderByOrderId(raw);

        if (!order) return res.status(404).json({ message: "Order not found" });
        return res.status(200).json({ order: buildPublicOrder(order) });
    } catch (error) {
        return next(error);
    }
};

export const updateOrderStatusController = async (req, res, next) => {
    try {
        const status = String(req.body?.order_status ?? req.body?.status ?? "")
            .trim()
            .toUpperCase();

        const id = req.body?.id ? Number(req.body.id) : null;
        const orderId = String(req.body?.order_id ?? req.body?.orderId ?? "").trim();

        if (!allowedOrderStatuses.has(status)) {
            return res.status(400).json({ message: "Invalid order_status" });
        }

        if ((!id || !Number.isInteger(id) || id <= 0) && !orderId) {
            return res.status(400).json({ message: "id or order_id is required" });
        }

        const updated = await updateOrderStatus({
            id: Number.isInteger(id) && id > 0 ? id : null,
            orderId: orderId || null,
            status,
        });

        if (!updated) return res.status(404).json({ message: "Order not found" });

        return res.status(200).json({
            message: "Order status updated",
            order: buildPublicOrder(updated),
        });
    } catch (error) {
        return next(error);
    }
};
