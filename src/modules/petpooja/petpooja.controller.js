import pool from "../../config/db.js";
import { createCategoryTable as createMenuCategoryTable } from "../menu/menu.category.model.js";
import {
    getTestMenu,
    hardResetMenu,
    invalidatePetpoojaMenuCache,
    processIncomingPetpoojaMenu,
    updatePetpoojaMenuRedisCache,
} from "./petpooja.menu.service.js";

import { cancelPetpoojaOrder, sendOrderToPetpooja } from "./petpooja.order.service.js";
import { syncPushMenuData } from "./petpooja.sync.service.js";
import { toHttpErrorPayload } from "./petpooja.utils.js";


// ================= MENU =================
export const menu = async (req, res) => {
    try {
        const data = await getTestMenu();
        return res.status(200).json(data);
    } catch (error) {
        console.error("Menu fetch error:", error.message);
        return res.status(500).json({
            message: "Menu fetch failed",
            error: error.message,
        });
    }
};


// ================= CREATE ORDER =================
export const createOrder = async (req, res) => {
    try {
        const payload = req.body;
        const result = await sendOrderToPetpooja(payload);

        return res.status(200).json({
            success: true,
            petpooja: result,
        });

    } catch (error) {
        const { statusCode, body } = toHttpErrorPayload(error);
        return res.status(statusCode).json(body);
    }
};


// ================= ORDER CALLBACK =================
export const orderCallback = async (req, res) => {
    console.log("Petpooja order callback:", req.body);
    return res.status(200).json({ status: "received" });
};


// ================= CANCEL ORDER =================
export const cancelOrder = async (req, res) => {
    try {
        const result = await cancelPetpoojaOrder(req.body);

        return res.status(200).json({
            success: true,
            data: result,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Cancel failed",
        });
    }
};


// ================= STORE STATUS =================
export const storeStatus = async (req, res) => {
    return res.status(200).json({
        http_code: 200,
        status: "success",
        store_status: "1",
        message: "Store status fetched",
    });
};


// ================= UPDATE STORE STATUS =================
export const updateStoreStatus = async (req, res) => {
    console.log("UPDATE STORE STATUS:", req.body);

    try {
        const { restID } = req.body;

        return res.status(200).json({
            http_code: 200,
            status: "success",
            message: `Store status updated for ${restID}`,
        });

    } catch {
        return res.status(200).json({
            http_code: 400,
            status: "failed",
            message: "Failed to update store status",
        });
    }
};


// ================= 🔥 PUSH MENU (FIXED CORE ISSUE) =================
export const pushMenu = async (req, res) => {
    console.log("PUSH MENU RECEIVED", JSON.stringify(req.body, null, 2));

    try {
        await createMenuCategoryTable();

        const restaurant = req.body?.restaurants?.[0] || {};

        const categories = Array.isArray(req.body?.categories)
            ? req.body.categories
            : restaurant.categories || [];

        const items = Array.isArray(req.body?.items)
            ? req.body.items
            : restaurant.items || [];

        console.log("CATEGORIES:", categories.length);
        console.log("ITEMS:", items.length);

        // ❗ VERY IMPORTANT → ALWAYS RETURN "0"
        if (!categories.length || !items.length) {
            return res.status(200).send("0");
        }

        // ===== SAVE CATEGORY =====
        const upsertSql = `
            INSERT INTO menu_categories (categoryid, categoryname)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
                categoryname = VALUES(categoryname),
                updated_at = CURRENT_TIMESTAMP
        `;

        for (const c of categories) {
            const id = String(c.categoryid || "").trim();
            const name = String(c.categoryname || "").trim();

            if (!id || !name) continue;

            await pool.execute(upsertSql, [id, name]);
        }

        // ===== SAVE MENU =====
        const restaurantForSync = {
            ...restaurant,
            categories,
            items,
        };

        const processedMenu = await processIncomingPetpoojaMenu(restaurantForSync);
        await syncPushMenuData(processedMenu);

        // ===== CACHE =====
        invalidatePetpoojaMenuCache();

        try {
            await updatePetpoojaMenuRedisCache(processedMenu);
        } catch (e) {
            console.log("Redis skipped:", e.message);
        }

        // ✅ SUCCESS (CRITICAL)
        return res.status(200).send("0");

    } catch (error) {
        console.error("PUSH MENU ERROR:", error);

        // ❗ EVEN ERROR → SEND "0"
        return res.status(200).send("0");
    }
};


// ================= STOCK UPDATE =================
export const updateItemStock = async (req, res) => {
    try {
        const { restID, inStock, type, itemID } = req.body;

        if (!restID || !Array.isArray(itemID)) {
            return res.status(400).json({
                code: 400,
                status: "failed",
                message: "Invalid payload",
            });
        }

        const stock = inStock ? 2 : 0;

        for (const id of itemID) {
            await pool.execute(
                `UPDATE menu_items SET in_stock = ? WHERE itemid = ?`,
                [stock, id]
            );
        }

        return res.status(200).json({
            code: 200,
            status: "success",
            message: "Stock updated",
        });

    } catch (error) {
        console.error("STOCK ERROR:", error);

        return res.status(500).json({
            code: 400,
            status: "failed",
            message: "Stock update failed",
        });
    }
};


// ================= RESET MENU =================
export const resetMenu = async (req, res) => {
    try {
        await hardResetMenu();

        return res.json({
            success: true,
            message: "Menu reset successful",
        });

    } catch (err) {
        return res.status(500).json({
            error: err.message,
        });
    }
};