import pool from "../../config/db.js";
import redisClient, { isRedisEnabled } from "../../config/redis.js";
import { createMenuTable } from "../menu/menu.model.js";
import {
    getTestMenu,
    invalidatePetpoojaMenuCache,
    updatePetpoojaMenuRedisCache,
} from "./petpooja.menu.service.js";

let syncInterval = null;
let syncInProgress = false;

/* =========================
   CHECK DB MENU EXISTS
========================= */
const hasDbMenu = async () => {
    try {
        await createMenuTable();
        const [rows] = await pool.execute(
            "SELECT itemid FROM menu_items LIMIT 1"
        );
        return Array.isArray(rows) && rows.length > 0;
    } catch {
        return false;
    }
};

/* =========================
   AUTO SYNC (DB → CACHE)
========================= */
export const startPetpoojaMenuAutoSync = () => {
    if (syncInterval) return;

    console.log("[Petpooja] Auto sync started (DB → cache)");

    const syncMenu = async () => {
        if (syncInProgress) return;
        syncInProgress = true;

        try {
            if (!(await hasDbMenu())) {
                console.log("⚠️ No menu in DB yet");
                return;
            }

            const menu = await getTestMenu();
            if (!menu) return;

            if (isRedisEnabled()) {
                await updatePetpoojaMenuRedisCache(menu);
                console.log("✅ Redis cache updated");
            }

            invalidatePetpoojaMenuCache();
            console.log("✅ Memory cache cleared");

        } catch (err) {
            console.error("[SYNC ERROR]", err?.message || err);
        } finally {
            syncInProgress = false;
        }
    };

    syncMenu();
    syncInterval = setInterval(syncMenu, 120000);
};

/* =========================
   HELPERS
========================= */
const safeJson = (value) => {
    if (value === undefined || value === null) return null;

    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
};

const toDecimal = (value) => {
    const n = Number.parseFloat(String(value ?? "").trim());
    return Number.isFinite(n) ? n : 0;
};

/* =========================
   PUSH MENU (MAIN FIX)
========================= */
export const syncPushMenuData = async (restaurant) => {
    await createMenuTable();

    const items = Array.isArray(restaurant?.items)
        ? restaurant.items
        : [];

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const sql = `
            INSERT INTO menu_items (
                itemid,
                itemname,
                itemdescription,
                price,
                item_categoryid,
                itemallowvariation,
                variation,
                itemallowaddon,
                addon,
                in_stock
            ) VALUES (?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE
                itemname = VALUES(itemname),
                price = VALUES(price),
                item_categoryid = VALUES(item_categoryid),
                itemallowvariation = VALUES(itemallowvariation),
                variation = VALUES(variation),
                itemallowaddon = VALUES(itemallowaddon),
                addon = VALUES(addon),
                in_stock = VALUES(in_stock),
                updated_at = CURRENT_TIMESTAMP
        `;

        let count = 0;

        for (const it of items) {
            const itemid = String(it?.itemid ?? "").trim();
            if (!itemid) continue;

            // STEP 1 — VERIFY RAW PETPOOJA VARIATION DATA (temporary debug)
            // Do not remove existing logs.
            console.log(
                "ITEM VARIATION DEBUG:",
                it?.itemname,
                JSON.stringify(it?.variation, null, 2)
            );

            // ✅ CATEGORY
            const categoryId =
                it?.categoryid ||
                it?.item_categoryid ||
                null;

                        // ✅ VARIATION (Petpooja sends variants in `variation` array; keep fallback to older fields)
                        const safeVariation = Array.isArray(it?.variation)
                                ? it.variation
                                : Array.isArray(it?.child_variations)
                                    ? it.child_variations
                                    : [];

                        const hasVariation = safeVariation.length > 0;

            // ✅ ADDONS
            const addonPayload =
                it?.addongroups ||
                it?.addon_groups ||
                it?.addons ||
                it?.addon ||
                null;

            const hasAddon = addonPayload !== null;

            // ✅ PRICE FIX (MOST IMPORTANT)
            // Petpooja may intentionally set base item price = 0 for variant items.
            const price =
                Number(it?.price) > 0
                    ? Number(it.price)
                    : Number(safeVariation?.[0]?.price || 0);

                const queryParams = [
    itemid ? String(itemid) : null,
    it?.itemname ? String(it.itemname).trim() : null,
    it?.itemdescription ? String(it.itemdescription).trim() : null,
    Number(price || 0),
    categoryId ? String(categoryId) : null,
    hasVariation ? 1 : 0,
    // STEP 3 — SAVE VARIATIONS SAFELY (never store null/undefined)
    JSON.stringify(safeVariation),
    hasAddon ? 1 : 0,
    safeJson(addonPayload ?? null),
    Number(it?.in_stock ?? 2),
];


console.log("MYSQL PARAMS:", JSON.stringify(queryParams, null, 2));

await connection.execute(sql, queryParams);

            count++;
        }

        await connection.commit();

        console.log("✅ PUSH MENU SAVED:", count);

        return {
            success: true,
            count
        };

    } catch (err) {
        await connection.rollback();
        console.error("❌ PUSH ERROR:", err?.message || err);
        throw err;
    } finally {
        connection.release();
    }
};

export const syncPetpoojaMenu = async () => {
    console.log("⚠️ Manual sync disabled (PUSH only mode)");
    return {
        success: true,
        message: "Sync skipped (using PUSH menu only)"
    };
};