import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { upsertDishImage } from "./admin.model.js";

const MENU_UPLOAD_DIR = path.join(process.cwd(), "uploads", "menu");

const ensureUploadDir = async () => {
    await fs.mkdir(MENU_UPLOAD_DIR, { recursive: true });
    return MENU_UPLOAD_DIR;
};

export const saveDishImageAndUpsertRecord = async ({ itemid, file }) => {
    const itemId = String(itemid || "").trim();

    if (!itemId) {
        const error = new Error("itemid is required");
        error.statusCode = 400;
        throw error;
    }

    if (!file?.buffer) {
        const error = new Error("image file is required");
        error.statusCode = 400;
        throw error;
    }

    await ensureUploadDir();

    const filename = `${itemId}.webp`;
    const fullPath = path.join(MENU_UPLOAD_DIR, filename);

    // Convert to WebP (no resize logic).
    await sharp(file.buffer).rotate().webp().toFile(fullPath);

    const imagePath = `/uploads/menu/${filename}`;

    await upsertDishImage({ itemid: itemId, imagePath });

    // Best-effort: ensure the menu endpoint reflects updates immediately.
    try {
        const mod = await import("../petpooja/petpooja.menu.service.js");
        if (typeof mod.invalidatePetpoojaMenuCache === "function") {
            mod.invalidatePetpoojaMenuCache();
        }
    } catch {
        // ignore
    }

    return {
        itemid: itemId,
        image: imagePath,
    };
};

const parseItemIdFromOriginalName = (originalname) => {
    const base = path.parse(String(originalname || "")).name;
    const itemId = String(base || "").trim();

    // Enforce filename rule: basename must be the dish itemid.
    if (!itemId || !/^\d+$/.test(itemId)) {
        const error = new Error(
            "Invalid filename. Use the dish itemid as filename (e.g., 10537737.jpg)"
        );
        error.statusCode = 400;
        throw error;
    }

    return itemId;
};

export const saveDishImagesAndUpsertRecords = async ({ files }) => {
    const list = Array.isArray(files) ? files : [];
    if (list.length === 0) {
        const error = new Error("images[] is required");
        error.statusCode = 400;
        throw error;
    }

    await ensureUploadDir();

    const uploaded = [];

    for (const file of list) {
        if (!file?.buffer) {
            const error = new Error("image files are required");
            error.statusCode = 400;
            throw error;
        }

        const itemId = parseItemIdFromOriginalName(file.originalname);
        const filename = `${itemId}.webp`;
        const fullPath = path.join(MENU_UPLOAD_DIR, filename);

        // Convert to WebP (no resize logic).
        await sharp(file.buffer).rotate().webp().toFile(fullPath);

        const imagePath = `/uploads/menu/${filename}`;
        await upsertDishImage({ itemid: itemId, imagePath });
        uploaded.push(imagePath);
    }

    // Best-effort: ensure the menu endpoint reflects updates immediately.
    try {
        const mod = await import("../petpooja/petpooja.menu.service.js");
        if (typeof mod.invalidatePetpoojaMenuCache === "function") {
            mod.invalidatePetpoojaMenuCache();
        }
    } catch {
        // ignore
    }

    return { uploaded };
};
