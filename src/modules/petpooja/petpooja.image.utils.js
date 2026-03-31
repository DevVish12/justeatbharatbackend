import axios from "axios";
import fs from "fs/promises";
import path from "path";

const MENU_UPLOAD_DIR = path.join(process.cwd(), "uploads", "menu");

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const extFromContentType = (contentType) => {
    const ct = String(contentType || "").toLowerCase();
    if (ct.includes("image/jpeg")) return ".jpg";
    if (ct.includes("image/jpg")) return ".jpg";
    if (ct.includes("image/png")) return ".png";
    if (ct.includes("image/webp")) return ".webp";
    if (ct.includes("image/gif")) return ".gif";
    return null;
};

const safeItemId = (value) => String(value ?? "").trim();

export const ensureMenuUploadDir = async () => {
    await fs.mkdir(MENU_UPLOAD_DIR, { recursive: true });
    return MENU_UPLOAD_DIR;
};

export const findExistingMenuImageFilename = async (itemId) => {
    const id = safeItemId(itemId);
    if (!id) return null;

    await ensureMenuUploadDir();

    const candidates = [
        `${id}.jpg`,
        `${id}.jpeg`,
        `${id}.png`,
        `${id}.webp`,
        `${id}.gif`,
    ];

    for (const filename of candidates) {
        const fullPath = path.join(MENU_UPLOAD_DIR, filename);
        try {
            await fs.access(fullPath);
            return filename;
        } catch {
            // ignore
        }
    }

    return null;
};


// export const downloadMenuItemImage = async ({ itemId, url, timeoutMs = 15000 } = {}) => {

//     const id = safeItemId(itemId);
//     const imageUrl = String(url ?? "").trim();

//     if (!id || !imageUrl) return { local_image: null, filename: null, skipped: true };

//     const existing = await findExistingMenuImageFilename(id);
//     if (existing) {
//         return {
//             local_image: `/uploads/menu/${existing}`,
//             filename: existing,
//             skipped: true,
//         };
//     }

//     await ensureMenuUploadDir();

//     // 🔥 REMOVE signed query params
//     const cleanUrl = imageUrl.split("?")[0];

//     let urlExt = null;

//     try {
//         const u = new URL(cleanUrl);
//         const ext = path.extname(u.pathname).toLowerCase();
//         if (ALLOWED_EXTS.has(ext)) urlExt = ext;
//     } catch { }

//     try {

//         const response = await axios.get(cleanUrl, {
//             responseType: "arraybuffer",
//             timeout: timeoutMs,
//             headers: {
//                 "User-Agent": "Mozilla/5.0",
//                 "Accept": "image/*"
//             },
//             validateStatus: (s) => s >= 200 && s < 300,
//         });

//         const ctExt = extFromContentType(response.headers?.["content-type"]);
//         const ext = ctExt || urlExt || ".jpg";

//         const filename = `${id}${ext}`;
//         const fullPath = path.join(MENU_UPLOAD_DIR, filename);

//         await fs.writeFile(fullPath, response.data);

//         return {
//             local_image: `/uploads/menu/${filename}`,
//             filename,
//             skipped: false,
//         };

//     } catch (error) {

//         console.warn(`Image download failed for ${id}:`, error.message);

//         return {
//             local_image: null,
//             filename: null,
//             skipped: false,
//             error: error?.message || String(error),
//         };
//     }
// };

export const downloadMenuItemImage = async ({ itemId, url, timeoutMs = 15000 } = {}) => {

    const id = safeItemId(itemId);
    const imageUrl = String(url ?? "").trim();

    if (!id || !imageUrl) {
        return { local_image: null, filename: null, skipped: true };
    }

    const existing = await findExistingMenuImageFilename(id);
    if (existing) {
        return {
            local_image: `/uploads/menu/${existing}`,
            filename: existing,
            skipped: true,
        };
    }

    await ensureMenuUploadDir();

    try {

        const response = await axios.get(imageUrl, {
            responseType: "arraybuffer",
            timeout: timeoutMs,
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "image/*"
            }
        });

        const ctExt = extFromContentType(response.headers?.["content-type"]);
        const ext = ctExt || ".jpg";

        const filename = `${id}${ext}`;
        const fullPath = path.join(MENU_UPLOAD_DIR, filename);

        await fs.writeFile(fullPath, response.data);

        return {
            local_image: `/uploads/menu/${filename}`,
            filename,
            skipped: false,
        };

    } catch (error) {

        console.warn(`Image download failed for ${id}:`, error.message);

        return {
            local_image: null,
            filename: null,
            skipped: false,
            error: error?.message || String(error),
        };
    }
};