import pool from "../../config/db.js";
import redisClient, { isRedisEnabled } from "../../config/redis.js";
import { createMenuTable } from "../menu/menu.model.js";
import {
    fetchPetpoojaMenuFresh,
    getTestMenu,
    invalidatePetpoojaMenuCache,
} from "./petpooja.menu.service.js";

let syncInterval = null;
let syncInProgress = false;

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

export const startPetpoojaMenuAutoSync = () => {
    if (syncInterval) return;

    console.log("[Petpooja] Auto menu sync started (every 2 minutes)");

    const syncMenu = async () => {
        if (syncInProgress) return;
        syncInProgress = true;

        try {
            // Hybrid mode: if DB already has menu (typically from push), don't overwrite caches via fetch.
            if (await hasDbMenu()) {
                return;
            }

            const menu = await fetchPetpoojaMenuFresh();

            // fetchPetpoojaMenuFresh already updates Redis when enabled.
            if (isRedisEnabled()) {
                const cached = await redisClient.get("petpooja:menu");
                if (cached) {
                    console.log("[Petpooja] Menu synced and cached in Redis");
                } else {
                    console.log("[Petpooja] Menu synced (Redis unavailable)");
                }
            } else {
                console.log("[Petpooja] Menu synced (Redis disabled)");
            }

            // Ensure we don't serve stale in-memory data when Redis is the source of truth.
            if (isRedisEnabled()) {
                invalidatePetpoojaMenuCache();
            }

            // Optional future: also persist snapshot into MySQL here if desired.
            void menu;
        } catch (err) {
            console.error("[Petpooja] Sync error:", err?.message || err);
        } finally {
            syncInProgress = false;
        }
    };

    // Run immediately
    syncMenu();

    // Then repeat
    syncInterval = setInterval(syncMenu, 120000);
};

const safeJson = (value) => {
    if (value === undefined) return null;
    if (value === null) return null;

    // If already a string, try to normalize to JSON.
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;

        // If looks like JSON, keep as-is if valid.
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
                JSON.parse(trimmed);
                return trimmed;
            } catch {
                return JSON.stringify(trimmed);
            }
        }

        // Otherwise store as JSON string.
        return JSON.stringify(trimmed);
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

export const syncPetpoojaMenu = async () => {
    // Ensure DB schema exists even if the server started with an older table.
    await createMenuTable();

    const menu = await getTestMenu();
    const items = Array.isArray(menu?.items) ? menu.items : [];

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
                item_attributeid,
                item_image_url,
                in_stock,
                itemallowvariation,
                variation,
                itemallowaddon,
                addon,
                is_combo,
                is_recommend,
                cuisine,
                item_tags,
                custom_image
            ) VALUES (
                ?,?,?,?,?,?,?,?,
                ?,?,?,?,?,?,?,?,?
            )
            ON DUPLICATE KEY UPDATE
                itemname = VALUES(itemname),
                itemdescription = VALUES(itemdescription),
                price = VALUES(price),
                item_categoryid = VALUES(item_categoryid),
                item_attributeid = VALUES(item_attributeid),
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
                updated_at = CURRENT_TIMESTAMP
        `;

        let upserted = 0;

        for (const it of items) {
            const itemid = String(it?.itemid ?? "").trim();
            if (!itemid) continue;

            const itemCategoryId =
                it?.item_categoryid ||
                it?.categoryid ||
                it?.categoryId ||
                null;

            const params = [
                itemid,
                it?.itemname ?? null,
                it?.itemdescription ?? null,
                toDecimal(it?.price),
                itemCategoryId,
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
                // Insert custom_image if provided by upstream; do not overwrite on updates.
                it?.custom_image ?? null,
            ];

            await connection.execute(sql, params);
            upserted += 1;
        }

        await connection.commit();

        return {
            success: true,
            itemCount: items.length,
            upserted,
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const createPetpoojaMenuMetaTable = async (connection) => {
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS petpooja_menu_meta (
            id INT AUTO_INCREMENT PRIMARY KEY,
            rest_id VARCHAR(50) NULL,
            categories_json JSON NULL,
            addongroups_json JSON NULL,
            addongroupitems_json JSON NULL,
            taxes_json JSON NULL,
            discounts_json JSON NULL,
            updated_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_rest_id (rest_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
};

export const syncPushMenuData = async (restaurant) => {
    await createMenuTable();

    const restId =
        restaurant?.rest_id ||
        restaurant?.restID ||
        restaurant?.restaurantid ||
        restaurant?.restaurant_id ||
        null;

    const categories = Array.isArray(restaurant?.categories) ? restaurant.categories : [];
    const addongroups = Array.isArray(restaurant?.addongroups) ? restaurant.addongroups : [];
    const addongroupitems = Array.isArray(restaurant?.addongroupitems) ? restaurant.addongroupitems : [];
    const taxes = Array.isArray(restaurant?.taxes) ? restaurant.taxes : [];
    const discounts = Array.isArray(restaurant?.discounts) ? restaurant.discounts : [];

    const rawItems = Array.isArray(restaurant?.items) ? restaurant.items : [];
    const itemsById = new Map();
    for (const it of rawItems) {
        const itemid = String(it?.itemid ?? "").trim();
        if (!itemid) continue;
        itemsById.set(itemid, it);
    }
    const items = Array.from(itemsById.values());

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await createPetpoojaMenuMetaTable(connection);

        // Store menu meta as JSON for DB-first hybrid serving.
        await connection.execute(
            `
            INSERT INTO petpooja_menu_meta (
                rest_id,
                categories_json,
                addongroups_json,
                addongroupitems_json,
                taxes_json,
                discounts_json
            ) VALUES (?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE
                categories_json = VALUES(categories_json),
                addongroups_json = VALUES(addongroups_json),
                addongroupitems_json = VALUES(addongroupitems_json),
                taxes_json = VALUES(taxes_json),
                discounts_json = VALUES(discounts_json),
                updated_at = CURRENT_TIMESTAMP
            `,
            [
                restId,
                safeJson(categories),
                safeJson(addongroups),
                safeJson(addongroupitems),
                safeJson(taxes),
                safeJson(discounts),
            ]
        );

        const sql = `
            INSERT INTO menu_items (
                itemid,
                itemname,
                itemdescription,
                price,
                item_categoryid,
                item_attributeid,
                item_image_url,
                in_stock,
                itemallowvariation,
                variation,
                itemallowaddon,
                addon,
                is_combo,
                is_recommend,
                cuisine,
                item_tags,
                custom_image
            ) VALUES (
                ?,?,?,?,?,?,?,?,
                ?,?,?,?,?,?,?,?,?
            )
            ON DUPLICATE KEY UPDATE
                itemname = VALUES(itemname),
                itemdescription = VALUES(itemdescription),
                price = VALUES(price),
                item_categoryid = VALUES(item_categoryid),
                item_attributeid = VALUES(item_attributeid),
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
                updated_at = CURRENT_TIMESTAMP
        `;

        let upserted = 0;

        for (const it of items) {
            const itemid = String(it?.itemid ?? "").trim();
            if (!itemid) continue;

            const itemCategoryId =
                it?.item_categoryid ||
                it?.categoryid ||
                it?.categoryId ||
                null;

            // IMPORTANT: Ignore deprecated `variation`; prefer `child_variations`.
            const childVariations = it?.child_variations ?? null;
            const hasVariations = Array.isArray(childVariations) && childVariations.length > 0;

            // Add-on mapping differs across payloads; store whatever linkage we receive.
            const addonPayload =
                it?.addongroups ??
                it?.addon_groups ??
                it?.addon_group_ids ??
                it?.addongroupids ??
                it?.addon ??
                it?.addons ??
                null;

            const hasAddons = addonPayload !== null && addonPayload !== undefined;

            const params = [
                itemid,
                it?.itemname ?? null,
                it?.itemdescription ?? null,
                toDecimal(it?.price),
                itemCategoryId,
                it?.item_attributeid ?? null,
                it?.item_image_url ?? null,
                it?.in_stock ?? null,
                hasVariations ? 1 : (it?.itemallowvariation ?? null),
                safeJson(childVariations),
                hasAddons ? 1 : (it?.itemallowaddon ?? null),
                safeJson(addonPayload),
                it?.is_combo ?? null,
                it?.is_recommend ?? null,
                safeJson(it?.cuisine),
                safeJson(it?.item_tags),
                // Preserve custom_image on updates (no UPDATE clause for custom_image).
                it?.custom_image ?? null,
            ];

            console.log("SAVE ITEM:", {
                name: it.itemname,
                incoming_categoryid: it.categoryid,
                saved_categoryid: itemCategoryId,
            });

            await connection.execute(sql, params);
            upserted += 1;
        }

        await connection.commit();
        return { success: true, itemCount: rawItems.length, upserted };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};
