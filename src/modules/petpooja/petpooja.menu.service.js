import axios from "axios";
import pool from "../../config/db.js";
import config from "../../config/petpooja.js";
import redisClient, { isRedisEnabled } from "../../config/redis.js";
import { findDishImagesByItemIds } from "../admin/admin.model.js";
import { createCategoryTable } from "../menu/menu.category.model.js";
import { createMenuTable } from "../menu/menu.model.js";
import { downloadMenuItemImage } from "./petpooja.image.utils.js";

const FALLBACK_IMAGE = "/images/food-placeholder.jpg";
const CACHE_TTL_MS = 30 * 60 * 1000;
const REDIS_MENU_KEY = "petpooja:menu";
const REDIS_MENU_TTL_SECONDS = 5 * 60;
let cachedMenu = null;
let cachedAtMs = 0;
let inFlightPromise = null;

export const invalidatePetpoojaMenuCache = () => {
    cachedMenu = null;
    cachedAtMs = 0;
    inFlightPromise = null;
};

const normalizeItems = (menu) => {
    const items = safeArray(menu?.items);

    const normalized = items.map((item) => ({
        ...item,
        description: item.itemdescription || item.description || "",
    }));

    return {
        ...menu,
        items: normalized,
    };
};

const safeArray = (v) => (Array.isArray(v) ? v : []);

const mapLimit = async (list, limit, mapper) => {
    const arr = safeArray(list);
    const results = new Array(arr.length);
    let idx = 0;

    const workers = Array.from({ length: Math.max(1, limit) }, async () => {
        while (idx < arr.length) {
            const current = idx++;
            results[current] = await mapper(arr[current], current);
        }
    });

    await Promise.all(workers);
    return results;
};

const enrichMenuWithLocalImages = async (menu) => {
    const items = safeArray(menu?.items);
    if (items.length === 0) return menu;

    const enrichedItems = await mapLimit(items, 6, async (item) => {
        const itemId = item?.itemid ?? item?.id;
        const url = item?.item_image_url;

        if (!itemId || !url) {
            return { ...item, local_image: FALLBACK_IMAGE };
        }

        const dl = await downloadMenuItemImage({ itemId, url });
        if (dl?.error) {
            console.warn(`Petpooja image download failed for item ${itemId}: ${dl.error}`);
        }

        const local = dl?.local_image || null;
        if (!local) {
            return {
                ...item,
                local_image: FALLBACK_IMAGE,
            };
        }
        return {
            ...item,
            local_image: local,
            item_image_url: local || item?.item_image_url || null,
        };
    });

    return {
        ...menu,
        items: enrichedItems,
    };
};

const applyCustomDishImages = async (menu) => {
    const items = safeArray(menu?.items);
    if (items.length === 0) return menu;

    const itemIds = Array.from(
        new Set(
            items
                .map((it) => String(it?.itemid ?? it?.id ?? "").trim())
                .filter(Boolean)
        )
    );

    const imageMap = await findDishImagesByItemIds(itemIds);
    if (!imageMap || imageMap.size === 0) return menu;

    const enrichedItems = items.map((item) => {
        const itemId = String(item?.itemid ?? item?.id ?? "").trim();
        const customImage = imageMap.get(itemId) || null;
        if (!customImage) return { ...item, custom_image: null };

        return {
            ...item,
            custom_image: customImage,
            // Also override common fields for compatibility with existing consumers.
            item_image_url: customImage,
            local_image: customImage,
        };
    });

    return {
        ...menu,
        items: enrichedItems,
    };
};

const fetchMenuFromPetpooja = async () => {
    const response = await axios.post(
        // `${config.baseUrl}/mapped_restaurant_menus`,
        `${config.menuBaseUrl}/mapped_restaurant_menus`,
        {
            restID: config.restId,
        },
        {
            headers: {
                "Content-Type": "application/json",
                "app-key": config.appKey,
                "app-secret": config.appSecret,
                "access-token": config.accessToken,
            },
        },
    );

    return response.data;
};

const readMenuFromRedis = async () => {
    if (!isRedisEnabled()) return null;

    try {
        const cached = await redisClient.get(REDIS_MENU_KEY);
        if (!cached) return null;
        return JSON.parse(cached);
    } catch (error) {
        console.warn("[Petpooja] Redis cache read failed:", error?.message || error);
        return null;
    }
};

const writeMenuToRedis = async (menu) => {
    if (!isRedisEnabled()) return;

    try {
        await redisClient.set(REDIS_MENU_KEY, JSON.stringify(menu), {
            EX: REDIS_MENU_TTL_SECONDS,
        });
        console.log("[Petpooja] Redis cache updated");
    } catch (error) {
        console.warn("[Petpooja] Redis cache write failed:", error?.message || error);
    }
};

export const updatePetpoojaMenuRedisCache = async (menu) => {
    cachedMenu = menu;
    cachedAtMs = Date.now();
    await writeMenuToRedis(menu);
};

const safeJsonParse = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") return value;

    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return value;

    try {
        return JSON.parse(trimmed);
    } catch {
        return value;
    }
};

const readMenuMetaFromDb = async () => {
    try {
        const [rows] = await pool.execute(
            `SELECT categories_json, taxes_json, discounts_json, addongroups_json, addongroupitems_json
             FROM petpooja_menu_meta
             ORDER BY updated_at DESC
             LIMIT 1`
        );
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row) return null;

        return {
            categories: safeJsonParse(row.categories_json) || [],
            taxes: safeJsonParse(row.taxes_json) || [],
            discounts: safeJsonParse(row.discounts_json) || [],
            addongroups: safeJsonParse(row.addongroups_json) || [],
            addongroupitems: safeJsonParse(row.addongroupitems_json) || [],
        };
    } catch {
        return null;
    }
};

const readMenuFromDb = async () => {
    try {
        await createMenuTable();

        const [rows] = await pool.execute(
            `SELECT 
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
            FROM menu_items`
        );

        const items = Array.isArray(rows)
            ? rows.map((r) => ({
                ...r,
                variation: safeJsonParse(r.variation),
                addon: safeJsonParse(r.addon),
                cuisine: safeJsonParse(r.cuisine),
                item_tags: safeJsonParse(r.item_tags),
            }))
            : [];

        if (!items.length) return null;

        const meta = await readMenuMetaFromDb();

        let categories = Array.isArray(meta?.categories) ? meta.categories : [];
        if (!categories || categories.length === 0) {
            try {
                await createCategoryTable();
                const [catRows] = await pool.execute(
                    `SELECT categoryid, categoryname FROM menu_categories ORDER BY updated_at DESC`
                );
                categories = Array.isArray(catRows) ? catRows : [];
            } catch (error) {
                console.warn(
                    "[Petpooja] menu_categories fallback read failed:",
                    error?.message || error
                );
                categories = [];
            }
        }

        return {
            categories,
            items,
            taxes: meta?.taxes || [],
            discounts: meta?.discounts || [],
            addongroups: meta?.addongroups || [],
            addongroupitems: meta?.addongroupitems || [],
        };
    } catch (error) {
        console.warn("[Petpooja] DB menu read failed:", error?.message || error);
        return null;
    }
};

export const processIncomingPetpoojaMenu = async (menu) => {
    const normalized = normalizeItems(menu);
    const enriched = await enrichMenuWithLocalImages(normalized);
    const withCustomImages = await applyCustomDishImages(enriched);
    return withCustomImages;
};

export const fetchPetpoojaMenuFresh = async () => {
    const menu = await fetchMenuFromPetpooja();
    const withCustomImages = await processIncomingPetpoojaMenu(menu);

    cachedMenu = withCustomImages;
    cachedAtMs = Date.now();

    await writeMenuToRedis(withCustomImages);
    return withCustomImages;
};

export const getTestMenu = async () => {
    // Hybrid mode: if DB has menu data, serve from DB.
    const fromDb = await readMenuFromDb();
    if (fromDb) {
        cachedMenu = fromDb;
        cachedAtMs = Date.now();
        await writeMenuToRedis(fromDb);
        return fromDb;
    }

    // Redis-first: if we have a cached menu, return immediately.
    const fromRedis = await readMenuFromRedis();
    if (fromRedis) {
        cachedMenu = fromRedis;
        cachedAtMs = Date.now();
        return fromRedis;
    }

    const now = Date.now();
    if (cachedMenu && now - cachedAtMs < CACHE_TTL_MS) return cachedMenu;

    if (inFlightPromise) return inFlightPromise;

    inFlightPromise = (async () => {
        const fresh = await fetchPetpoojaMenuFresh();
        return fresh;
    })().finally(() => {
        inFlightPromise = null;
    });

    return inFlightPromise;
};