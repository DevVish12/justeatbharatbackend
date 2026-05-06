import axios from "axios";
import pool from "../../config/db.js";
import config from "../../config/petpooja.js";
import redisClient, { isRedisEnabled } from "../../config/redis.js";
import { getAllDishImages } from "../admin/admin.model.js";
import { createCategoryTable } from "../menu/menu.category.model.js";
import { createMenuTable } from "../menu/menu.model.js";

const FALLBACK_IMAGE = "/images/food-placeholder.jpg";
const REDIS_MENU_KEY = "petpooja:menu";

let cachedMenu = null;


// ================= CACHE =================
export const invalidatePetpoojaMenuCache = () => {
    cachedMenu = null;
};


// ================= SAFE ARRAY =================
const safeArray = (v) => (Array.isArray(v) ? v : []);

const normalizeVariation = (variationValue) => {
    try {
        if (Array.isArray(variationValue)) {
            return variationValue;
        }

        // MySQL may return TEXT/JSON as a Buffer in some driver modes
        if (Buffer.isBuffer(variationValue)) {
            variationValue = variationValue.toString("utf8");
        }

        if (variationValue && typeof variationValue === "object") {
            return [variationValue];
        }

        if (typeof variationValue === "string") {
            const trimmed = variationValue.trim();
            if (!trimmed) return [];

            let parsed = JSON.parse(trimmed || "[]");

            // Handle double-stringified JSON (e.g. "[{...}]" as a JSON string)
            if (typeof parsed === "string") {
                parsed = JSON.parse(parsed || "[]");
            }

            if (Array.isArray(parsed)) {
                return parsed;
            }

            if (parsed && typeof parsed === "object") {
                return [parsed];
            }

            return [];
        }

        return [];
    } catch (err) {
        console.error("❌ VARIATION PARSE FAILED:", err?.message);
        return [];
    }
};


// ================= APPLY CUSTOM IMAGES =================
const applyCustomDishImages = async (menu) => {
    const items = safeArray(menu?.items);
    if (!items.length) return menu;

    const dbImages = await getAllDishImages();
    if (!dbImages?.length) return menu;

    const map = new Map();

    for (const img of dbImages) {
        map.set(String(img.itemid), {
            image: img.image,
            updated_at: img.updated_at
        });
    }

    const updatedItems = items.map((item) => {
        const id = String(item.itemid || item.id || "");

        const found = map.get(id);

        if (!found) return item;

        return {
            ...item,
            custom_image: found.image,
            image: found.image,
            item_image_url: found.image,
            local_image: found.image,
            image_updated_at: found.updated_at
        };
    });

    return {
        ...menu,
        items: updatedItems
    };
};


// ================= DB READ =================
const readMenuFromDb = async () => {
    try {
        await createMenuTable();

        const [rows] = await pool.execute(`SELECT * FROM menu_items`);

        if (!rows.length) return null;

        await createCategoryTable();
        const [cats] = await pool.execute(`SELECT * FROM menu_categories`);

        const normalizedItems = (rows || []).map((row) => {
            const variations = normalizeVariation(row?.variation);

            // STEP 5 — DEBUG LOGS (only for likely-variant items)
            if (Number(row?.itemallowvariation) === 1 || (typeof row?.variation === "string" && row.variation.trim())) {
                console.log(
                    "🔥 MENU API VARIATION DEBUG",
                    row?.itemname,
                    row?.variation
                );
                console.log(
                    "🔥 MENU API PARSED VARIATION",
                    row?.itemname,
                    variations
                );
            }

            // STEP 4 — LOWEST PRICE FALLBACK (API response only)
            const basePrice = Number(row?.price || 0);
            const variantPrices = variations
                .map((v) => Number(v?.price || 0))
                .filter((n) => Number.isFinite(n) && n > 0);

            const lowestVariantPrice =
                variantPrices.length > 0
                    ? Math.min(...variantPrices)
                    : 0;

            const effectivePrice = basePrice > 0 ? basePrice : lowestVariantPrice;

            return {
                ...row,
                price: Number.isFinite(effectivePrice) ? effectivePrice : 0,
                variation: variations,
            };
        });

        return {
            categories: cats || [],
            items: normalizedItems,
            taxes: [],
            discounts: [],
            addongroups: [],
            addongroupitems: []
        };

    } catch (err) {
        console.log("DB read error:", err.message);
        return null;
    }
};


// ================= MAIN MENU =================
export const getTestMenu = async () => {

    // 🔥 ONLY DB MODE (IMPORTANT)
    const dbMenu = await readMenuFromDb();

    if (dbMenu) {
        return await applyCustomDishImages(dbMenu);
    }

    return {
        categories: [],
        items: [],
        taxes: [],
        discounts: [],
        addongroups: [],
        addongroupitems: []
    };
};


// ================= REDIS CACHE =================
export const updatePetpoojaMenuRedisCache = async (menu) => {
    cachedMenu = menu;

    if (!isRedisEnabled()) return;

    try {
        await redisClient.set(REDIS_MENU_KEY, JSON.stringify(menu));
        console.log("Redis updated");
    } catch (e) {
        console.log("Redis error:", e.message);
    }
};


// ================= RESET =================
export const hardResetMenu = async () => {
    cachedMenu = null;

    if (isRedisEnabled()) {
        try {
            await redisClient.del(REDIS_MENU_KEY);
        } catch (e) {
            console.log("Redis delete error:", e.message);
        }
    }
};