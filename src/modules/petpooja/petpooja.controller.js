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


export const menu = async (req, res) => {
    try {

        const data = await getTestMenu();

        return res.status(200).json(data);

    } catch (error) {

        console.error("Menu fetch error:", error.message);

        return res.status(500).json({
            message: "Menu fetch failed",
            error: error.message
        });

    }
};


// export const createOrder = async (req, res) => {

//     // console.log("Incoming request body:", req.body);


//     try {

//         const payload = req.body;

//         const result = await sendOrderToPetpooja(payload);

//         return res.status(200).json(result);

//     } catch (error) {

//         const { statusCode, body } = toHttpErrorPayload(error);

//         return res.status(statusCode).json(body);

//     }

// };

export const createOrder = async (req, res) => {

    try {

        const payload = req.body;

        const result = await sendOrderToPetpooja(payload);

        return res.status(200).json({
            success: true,
            petpooja: result
        });

    } catch (error) {

        const { statusCode, body } = toHttpErrorPayload(error);

        return res.status(statusCode).json(body);

    }

};

export const orderCallback = async (req, res) => {
    console.log("Petpooja order callback received:", req.body);
    return res.status(200).json({ status: "received" });
};



export const cancelOrder = async (req, res) => {
    try {
        const result = await cancelPetpoojaOrder(req.body);

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Cancel failed"
        });
    }
};


export const storeStatus = async (req, res) => {
    try {
        const { restID } = req.body;

        return res.status(200).json({
            http_code: 200,
            status: "success",
            store_status: "1", // 1 = open, 0 = closed
            message: "Store Delivery Status fetched successfully"
        });

    } catch (error) {
        return res.status(200).json({
            http_code: 400,
            status: "failed",
            store_status: "0",
            message: "Error fetching store status"
        });
    }
};

export const updateStoreStatus = async (req, res) => {
    console.log("🔥 UPDATE STORE STATUS HIT:", req.body);

    try {
        const { restID, store_status, reason, turn_on_time } = req.body;

        // 👉 optional: DB में save कर सकते हो
        // अभी simple response दे रहे हैं

        return res.status(200).json({
            http_code: 200,
            status: "success",
            message: `Store status updated successfully for store ${restID}`
        });

    } catch (error) {
        return res.status(200).json({
            http_code: 400,
            status: "failed",
            message: "Failed to update store status"
        });
    }
};

export const pushMenu = async (req, res) => {
    console.log("PUSH MENU RECEIVED:", JSON.stringify(req.body, null, 2));

    try {
        await createMenuCategoryTable();

        // const restaurant = req.body?.restaurants?.[0];

        // const categories = restaurant?.categories;
        // const items = restaurant?.items;
        const restaurant = req.body?.restaurants?.[0];

        // Petpooja payloads vary: sometimes categories/items are top-level, sometimes nested under restaurants[0].
        // Prefer top-level if present, otherwise fall back to restaurant.*
        const categories = Array.isArray(req.body?.categories)
            ? req.body.categories
            : Array.isArray(restaurant?.categories)
                ? restaurant.categories
                : [];
        const items = Array.isArray(req.body?.items)
            ? req.body.items
            : Array.isArray(restaurant?.items)
                ? restaurant.items
                : [];


        console.log("🔥 CATEGORIES RECEIVED:", categories.length);
        console.log("🔥 ITEMS RECEIVED:", items.length);


        if (!Array.isArray(req.body?.restaurants) || !restaurant) {
            return res.status(200).json({
                success: "0",
                message: "Menu push failed",
            });
        }

        if (!Array.isArray(categories) || !Array.isArray(items)) {
            return res.status(200).json({
                success: "0",
                message: "Menu push failed",
            });
        }

        // Save categories (Petpooja categoryid/categoryname) into DB.
        try {
            const upsertSql = `
                INSERT INTO menu_categories (categoryid, categoryname)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE
                    categoryname = VALUES(categoryname),
                    updated_at = CURRENT_TIMESTAMP
            `;

            for (const c of categories) {
                const categoryid = String(c?.categoryid ?? "").trim();
                const categoryname = String(c?.categoryname ?? c?.name ?? "").trim();
                if (!categoryid || !categoryname) continue;
                await pool.execute(upsertSql, [categoryid, categoryname]);
            }
        } catch (error) {
            console.error(
                "[Petpooja] menu_categories upsert failed:",
                error?.message || error
            );
        }

        // Process images + apply custom images so DB/Redis consumers stay consistent.
        // Ensure we persist categories/items in meta even if payload shape differs.
        const restaurantForSync = {
            ...(restaurant || {}),
            categories,
            items,
        };
        const processedMenu = await processIncomingPetpoojaMenu(restaurantForSync);

        // Save the pushed menu snapshot + upsert items.
        await syncPushMenuData(processedMenu);

        // Refresh caches so GET /api/petpooja/menu serves latest data.
        invalidatePetpoojaMenuCache();
        await updatePetpoojaMenuRedisCache(processedMenu);

        return res.status(200).json({
            success: "1",
            message: "Menu items are successfully listed.",
        });
    } catch (error) {
        console.error("[Petpooja] pushmenu failed:", error?.message || error);
        return res.status(200).json({
            success: "0",
            message: "Menu push failed",
        });
    }
};




export const updateItemStock = async (req, res) => {
    console.log("🔥 ITEM STOCK UPDATE:", req.body);

    try {
        const {
            restID,
            inStock,
            type,
            itemID,
            autoTurnOnTime,
            customTurnOnTime
        } = req.body;

        // ✅ Validation
        if (!restID || typeof inStock !== "boolean" || !type || !Array.isArray(itemID)) {
            return res.status(400).json({
                code: 400,
                status: "failed",
                message: "Invalid request payload"
            });
        }

        // ✅ DB UPDATE (IMPORTANT)
        const stockValue = inStock ? 2 : 0; // 2 = available, 0 = out_of_stock

        for (const id of itemID) {
            await pool.execute(
                `UPDATE menu_items SET in_stock = ? WHERE itemid = ?`,
                [stockValue, id]
            );
        }

        console.log(`✅ Updated ${itemID.length} items`);

        return res.status(200).json({
            code: 200,
            status: "success",
            message: "Stock status updated successfully"
        });

    } catch (error) {
        console.error("❌ ITEM STOCK ERROR:", error);

        return res.status(500).json({
            code: 400,
            status: "failed",
            message: "Stock status not updated successfully"
        });
    }
};


export const resetMenu = async (req, res) => {
    try {
        await hardResetMenu();

        return res.json({
            success: true,
            message: "Menu reset successful"
        });
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
};