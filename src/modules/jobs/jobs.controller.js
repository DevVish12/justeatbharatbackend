import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import env from "../../config/env.js";
import {
    createJobApplication,
    deleteJobApplicationById,
    getAllJobApplications,
} from "./jobs.model.js";

const isValidEmail = (email) => {
    const value = String(email || "").trim();
    if (!value) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const parsePayload = (body = {}) => {
    return {
        name: String(body.name || "").trim(),
        email: String(body.email || "").trim(),
        phone: String(body.phone || "").trim(),
        position: String(body.position || "").trim(),
    };
};

const toResumeUrl = (filename) =>
    `${env.BACKEND_BASE_URL}/uploads/resumes/${encodeURIComponent(filename)}`;

export const applyJobController = async (req, res, next) => {
    try {
        const payload = parsePayload(req.body);

        if (!payload.name) {
            return res.status(400).json({ message: "Name is required" });
        }

        if (!payload.email) {
            return res.status(400).json({ message: "Email is required" });
        }

        if (!isValidEmail(payload.email)) {
            return res.status(400).json({ message: "Invalid email" });
        }

        if (!payload.phone) {
            return res.status(400).json({ message: "Phone is required" });
        }

        if (!payload.position) {
            return res.status(400).json({ message: "Position is required" });
        }

        const resume = req.file;
        if (!resume) {
            return res.status(400).json({ message: "Resume file is required" });
        }

        const saved = await createJobApplication({
            ...payload,
            resumeFilename: resume.filename,
            resumeOriginalName: resume.originalname,
            resumeMime: resume.mimetype,
        });

        return res.status(201).json({
            message: "Application submitted successfully",
            application: {
                ...saved,
                resumeUrl: toResumeUrl(saved.resumeFilename),
            },
        });
    } catch (error) {
        return next(error);
    }
};

export const getAdminJobApplicationsController = async (req, res, next) => {
    try {
        const applications = await getAllJobApplications();
        return res.status(200).json({
            applications: applications.map((a) => ({
                ...a,
                resumeUrl: toResumeUrl(a.resumeFilename),
            })),
        });
    } catch (error) {
        return next(error);
    }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resumesDir = path.resolve(__dirname, "../../../uploads/resumes");

export const deleteAdminJobApplicationController = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid application id" });
        }

        const application = await deleteJobApplicationById(id);
        if (!application) {
            return res.status(404).json({ message: "Job application not found" });
        }

        if (application.resumeFilename) {
            const resumePath = path.join(resumesDir, application.resumeFilename);
            try {
                await fs.unlink(resumePath);
            } catch (error) {
                if (error?.code !== "ENOENT") {
                    return next(error);
                }
            }
        }

        return res.status(200).json({ message: "Job application deleted successfully" });
    } catch (error) {
        return next(error);
    }
};
