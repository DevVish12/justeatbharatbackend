import express from "express";
import fs from "fs/promises";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import adminAuthMiddleware from "../../middlewares/adminAuth.middleware.js";
import {
    deleteHeroBannerController,
    getHeroBannersController,
    toggleHeroBannerController,
    uploadHeroBannerController,
} from "./hero.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempUploadDir = path.resolve(__dirname, "../../../uploads/hero/temp");

const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];

const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

const ensureTempDir = async () => {
    await fs.mkdir(tempUploadDir, { recursive: true });
};

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await ensureTempDir();
            cb(null, tempUploadDir);
        } catch (error) {
            cb(error, tempUploadDir);
        }
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        cb(null, `temp-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const isValidMime = allowedMimeTypes.includes(file.mimetype);
    const isImageMime = String(file.mimetype || "").startsWith("image/");
    const isValidExt = allowedExtensions.includes(ext);

    if (!isImageMime || !isValidMime || !isValidExt) {
        const error = new Error("Only jpg, jpeg, png, webp images are allowed");
        error.statusCode = 400;
        return cb(error);
    }

    return cb(null, true);
};

const uploader = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter,
});

const uploadHeroMiddleware = (req, res, next) => {
    uploader.single("image")(req, res, (error) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "Image size must be 2MB or less" });
        }

        const statusCode = error.statusCode || 400;
        return res.status(statusCode).json({ message: error.message || "Upload failed" });
    });
};

const router = express.Router();

router.post("/admin/hero/upload", adminAuthMiddleware, uploadHeroMiddleware, uploadHeroBannerController);
router.get("/hero", getHeroBannersController);
router.patch("/admin/hero/toggle/:id", adminAuthMiddleware, toggleHeroBannerController);
router.delete("/admin/hero/:id", adminAuthMiddleware, deleteHeroBannerController);

export default router;
