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

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;

        try {
            JSON.parse(trimmed);
            return trimmed;
        } catch {
            return JSON.stringify(trimmed);
        }
    }

    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
};

const toDecimal = (value) => {
    const n = Number.parseFloat(String(value ?? "").trim());
    return Number.isFinite(n) ? n : null;
};

/* =========================
   NORMAL MENU SYNC
========================= */
export const syncPetpoojaMenu = async () => {
    await createMenuTable();

    const menu = await getTestMenu();
    const items = Array.isArray(menu?.items) ? menu.items : [];

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const sql = `
            INSERT INTO menu_items (
                itemid,itemname,itemdescription,price,item_categoryid,
                item_attributeid,item_image_url,in_stock,
                itemallowvariation,variation,itemallowaddon,addon,
                is_combo,is_recommend,cuisine,item_tags,custom_image
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE
                itemname = VALUES(itemname),
                itemdescription = VALUES(itemdescription),
                price = VALUES(price),
                item_categoryid = VALUES(item_categoryid),
                item_image_url = VALUES(item_image_url),
                in_stock = VALUES(in_stock),
                itemallowvariation = VALUES(itemallowvariation),
                variation = VALUES(variation),
                itemallowaddon = VALUES(itemallowaddon),
                addon = VALUES(addon),
                is_combo = VALUES(is_combo),
                is_recommend = VALUES(is_recommend),
                cuisine = VALUES(cuisine),
                item_tags = VALUES(item_tags),
                custom_image = COALESCE(VALUES(custom_image), custom_image),
                updated_at = CURRENT_TIMESTAMP
        `;

        let upserted = 0;

        for (const it of items) {
            const itemid = String(it?.itemid ?? "").trim();
            if (!itemid) continue;

            const params = [
                itemid,
                it?.itemname ?? null,
                it?.itemdescription ?? null,
                toDecimal(it?.price),
                it?.categoryid ?? null,
                it?.item_attributeid ?? null,
                it?.item_image_url ?? null,
                it?.in_stock ?? null,
                it?.itemallowvariation ?? null,
                safeJson(it?.variation),
                it?.itemallowaddon ?? null,
                safeJson(it?.addon),
                it?.is_combo ?? null,
                it?.is_recommend ?? null,
                safeJson(it?.cuisine),
                safeJson(it?.item_tags),
                it?.custom_image ?? null,
            ];

            await connection.execute(sql, params);
            upserted++;
        }

        await connection.commit();

        return { success: true, upserted };

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

/* =========================
   PUSH MENU (LIVE)
========================= */
export const syncPushMenuData = async (restaurant) => {
    await createMenuTable();

    const categories = restaurant?.categories || [];
    const items = restaurant?.items || [];

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const sql = `
            INSERT INTO menu_items (
                itemid,itemname,price,item_categoryid,
                itemallowvariation,variation,itemallowaddon,addon
            ) VALUES (?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE
                itemname = VALUES(itemname),
                price = VALUES(price),
                item_categoryid = VALUES(item_categoryid),
                itemallowvariation = COALESCE(VALUES(itemallowvariation), itemallowvariation),
                variation = COALESCE(VALUES(variation), variation),
                itemallowaddon = COALESCE(VALUES(itemallowaddon), itemallowaddon),
                addon = COALESCE(VALUES(addon), addon),
                updated_at = CURRENT_TIMESTAMP
        `;

        for (const it of items) {
            const itemid = String(it?.itemid ?? "").trim();
            if (!itemid) continue;

            const price =
                Number(it?.price) > 0
                    ? Number(it.price)
                    : (it?.child_variations?.[0]?.price || 0);

            await connection.execute(sql, [
                itemid,
                it?.itemname,
                price,
                it?.categoryid,
                it?.child_variations ? 1 : 0,
                safeJson(it?.child_variations),
                it?.addons ? 1 : 0,
                safeJson(it?.addons),
            ]);
        }

        await connection.commit();

        console.log("✅ PUSH MENU SAVED:", items.length);

        return { success: true };

    } catch (err) {
        await connection.rollback();
        console.error("❌ PUSH ERROR:", err);
        throw err;
    } finally {
        connection.release();
    }
};