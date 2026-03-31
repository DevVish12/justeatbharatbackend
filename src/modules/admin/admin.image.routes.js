import express from "express";
import multer from "multer";
import path from "path";
import adminAuthMiddleware from "../../middlewares/adminAuth.middleware.js";
import {
    uploadDishImageController,
    uploadDishImagesController,
} from "./admin.image.controller.js";

const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

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
    storage: multer.memoryStorage(),
    limits: { fileSize: 300 * 1024 },
    fileFilter,
});

const uploadDishImageMiddleware = (req, res, next) => {
    uploader.single("image")(req, res, (error) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "Image must be smaller than 300KB",
            });
        }

        const statusCode = error.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Upload failed",
        });
    });
};

const uploadDishImagesMiddleware = (req, res, next) => {
    uploader.fields([
        { name: "images", maxCount: 50 },
        { name: "images[]", maxCount: 50 },
    ])(req, res, (error) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "Image must be smaller than 300KB",
            });
        }

        const statusCode = error.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Upload failed",
        });
    });
};

const router = express.Router();

// POST /api/admin/upload-dish-image
router.post(
    "/admin/upload-dish-image",
    adminAuthMiddleware,
    uploadDishImageMiddleware,
    uploadDishImageController
);

// POST /api/admin/upload-dish-images
router.post(
    "/admin/upload-dish-images",
    adminAuthMiddleware,
    uploadDishImagesMiddleware,
    uploadDishImagesController
);

export default router;
