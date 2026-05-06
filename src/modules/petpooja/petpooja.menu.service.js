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

const parseVariation = (raw) => {
    // STEP 4 — API RESPONSE FIX: never return variation: null
    if (Array.isArray(raw)) return raw;
    if (!raw) return [];

    try {
        const parsed = typeof raw === "string" ? JSON.parse(raw || "[]") : raw;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
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

        const normalizedItems = (rows || []).map((row) => ({
            ...row,
            variation: parseVariation(row?.variation),
        }));

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