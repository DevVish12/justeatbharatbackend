import axios from "axios";
import config from "../../config/petpooja.js";
import redisClient, { isRedisEnabled } from "../../config/redis.js";
import { findDishImagesByItemIds } from "../admin/admin.model.js";
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

export const fetchPetpoojaMenuFresh = async () => {
    const menu = await fetchMenuFromPetpooja();
        const normalized = normalizeItems(menu);
    const enriched = await enrichMenuWithLocalImages(menu);
    const withCustomImages = await applyCustomDishImages(enriched);

    cachedMenu = withCustomImages;
    cachedAtMs = Date.now();

    await writeMenuToRedis(withCustomImages);
    return withCustomImages;
};

export const getTestMenu = async () => {
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