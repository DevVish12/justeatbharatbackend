import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import env from "../../config/env.js";
import {
    deleteHeroBannerById,
    getAllHeroBanners,
    insertHeroBanner,
    toggleHeroBannerStatus,
} from "./hero.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "../../../uploads/hero");

const ensureUploadDirectory = async () => {
    await fs.mkdir(uploadDir, { recursive: true });
};

const toPublicUploadUrl = (filename) =>
    `${env.BACKEND_BASE_URL}/uploads/hero/${filename}`;

const getFilenameFromUrl = (url) => {
    if (!url) {
        return null;
    }

    try {
        const parsed = new URL(url);
        return path.basename(parsed.pathname);
    } catch (error) {
        return path.basename(url);
    }
};

export const uploadHeroBannerController = async (req, res, next) => {
    const tempFilePath = req.file?.path;

    try {
        if (!req.file) {
            return res.status(400).json({ message: "Hero image is required" });
        }

        await ensureUploadDirectory();

        const image = sharp(req.file.path, { failOnError: true }).rotate();
        const metadata = await image.metadata();

        const isImage = metadata.format && ["jpeg", "jpg", "png", "webp"].includes(metadata.format);
        if (!isImage) {
            return res.status(400).json({ message: "Invalid image file" });
        }

        if (!metadata.width || !metadata.height || metadata.width < 800 || metadata.height < 450) {
            return res.status(400).json({
                message: "Image resolution too small. Minimum required: 800x450",
            });
        }

        const avg = await sharp(req.file.path, { failOnError: true })
            .rotate()
            .resize(1, 1, { fit: "cover" })
            .removeAlpha()
            .raw()
            .toBuffer();

        const background = {
            r: avg[0] ?? 247,
            g: avg[1] ?? 247,
            b: avg[2] ?? 247,
            alpha: 1,
        };

        const idPrefix = `${Date.now()}-${crypto.randomUUID()}`;
        const desktopFileName = `hero-desktop-${idPrefix}.webp`;
        const tabletFileName = `hero-tablet-${idPrefix}.webp`;
        const mobileFileName = `hero-mobile-${idPrefix}.webp`;

        const desktopPath = path.join(uploadDir, desktopFileName);
        const tabletPath = path.join(uploadDir, tabletFileName);
        const mobilePath = path.join(uploadDir, mobileFileName);

        const processVariant = (outputPath, width, height) =>
            sharp(req.file.path, { failOnError: true })
                .rotate()
                .resize(width, height, {
                    fit: "contain",
                    background,
                })
                .webp({ quality: 85, effort: 6, smartSubsample: true })
                .toFile(outputPath);

        await Promise.all([
            processVariant(desktopPath, 1920, 1080),
            processVariant(tabletPath, 1280, 720),
            processVariant(mobilePath, 768, 432),
        ]);

        await fs.unlink(req.file.path).catch(() => undefined);

        const banner = await insertHeroBanner({
            imageDesktop: toPublicUploadUrl(desktopFileName),
            imageTablet: toPublicUploadUrl(tabletFileName),
            imageMobile: toPublicUploadUrl(mobileFileName),
        });

        return res.status(201).json({
            message: "Hero banner uploaded successfully",
            banner,
        });
    } catch (error) {
        if (tempFilePath) {
            await fs.unlink(tempFilePath).catch(() => undefined);
        }
        return next(error);
    }
};

export const getHeroBannersController = async (req, res, next) => {
    try {
        const banners = await getAllHeroBanners();
        return res.status(200).json({ banners });
    } catch (error) {
        return next(error);
    }
};

export const toggleHeroBannerController = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid banner id" });
        }

        const banner = await toggleHeroBannerStatus(id);
        if (!banner) {
            return res.status(404).json({ message: "Hero banner not found" });
        }

        return res.status(200).json({
            message: "Hero banner status updated",
            banner,
        });
    } catch (error) {
        return next(error);
    }
};

export const deleteHeroBannerController = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid banner id" });
        }

        const banner = await deleteHeroBannerById(id);
        if (!banner) {
            return res.status(404).json({ message: "Hero banner not found" });
        }

        const filenames = [
            getFilenameFromUrl(banner.imageDesktop),
            getFilenameFromUrl(banner.imageTablet),
            getFilenameFromUrl(banner.imageMobile),
            getFilenameFromUrl(banner.imageUrl),
        ].filter(Boolean);

        await Promise.all(
            [...new Set(filenames)].map((filename) =>
                fs.unlink(path.join(uploadDir, filename)).catch(() => undefined)
            )
        );

        return res.status(200).json({ message: "Hero banner deleted" });
    } catch (error) {
        return next(error);
    }
};
