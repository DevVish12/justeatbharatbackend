import express from "express";
import fs from "fs/promises";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import adminAuthMiddleware from "../../middlewares/adminAuth.middleware.js";
import {
    applyJobController,
    deleteAdminJobApplicationController,
    getAdminJobApplicationsController,
} from "./jobs.controller.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resumesDir = path.resolve(__dirname, "../../../uploads/resumes");
await fs.mkdir(resumesDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, resumesDir);
    },
    filename: (req, file, cb) => {
        const original = String(file.originalname || "resume");
        const ext = path.extname(original).toLowerCase() || ".pdf";
        const safeExt = [".pdf", ".doc", ".docx"].includes(ext) ? ext : ".pdf";
        const stamp = Date.now();
        const random = Math.random().toString(16).slice(2);
        cb(null, `resume-${stamp}-${random}${safeExt}`);
    },
});

const uploader = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        const mime = String(file.mimetype || "").toLowerCase();
        const allowed = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];

        if (!allowed.includes(mime)) {
            return cb(new Error("Only PDF/DOC/DOCX files are allowed"));
        }

        cb(null, true);
    },
});

const uploadResumeMiddleware = (req, res, next) => {
    uploader.single("resume")(req, res, (error) => {
        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ message: "Resume must be under 5MB" });
        }

        if (error) {
            return res.status(400).json({ message: error.message || "Upload failed" });
        }

        next();
    });
};

// Public
router.post("/jobs/apply", uploadResumeMiddleware, applyJobController);

// Admin
router.get(
    "/admin/job-applications",
    adminAuthMiddleware,
    getAdminJobApplicationsController
);

router.delete(
    "/admin/job-applications/:id",
    adminAuthMiddleware,
    deleteAdminJobApplicationController
);

export default router;
