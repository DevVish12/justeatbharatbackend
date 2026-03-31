import bcrypt from "bcryptjs";
import crypto from "crypto";
import env from "../../config/env.js";
import { signAdminToken } from "../../utils/jwt.js";
import { sendAdminPasswordResetEmail } from "./admin.mailer.js";
import {
    createAdmin,
    findAdminByEmail,
    findAdminById,
    findAdminByResetTokenHash,
    saveAdminResetToken,
    updateAdminPasswordAndClearResetToken,
} from "./admin.model.js";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

export const registerAdminService = async ({ email, password }) => {
    const normalizedEmail = normalizeEmail(email);

    const existingAdmin = await findAdminByEmail(normalizedEmail);
    if (existingAdmin) {
        const error = new Error("Admin email already registered");
        error.statusCode = 409;
        throw error;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await createAdmin({ email: normalizedEmail, passwordHash });

    return admin;
};

export const loginAdminService = async ({ email, password }) => {
    const normalizedEmail = normalizeEmail(email);
    const admin = await findAdminByEmail(normalizedEmail);

    if (!admin) {
        const error = new Error("Invalid credentials");
        error.statusCode = 401;
        throw error;
    }

    const passwordMatched = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatched) {
        const error = new Error("Invalid credentials");
        error.statusCode = 401;
        throw error;
    }

    const token = signAdminToken({
        id: admin.id,
        email: admin.email,
        role: "admin",
    });

    return {
        token,
        admin: {
            id: admin.id,
            email: admin.email,
        },
    };
};

export const getAdminProfileService = async (adminId) => {
    const admin = await findAdminById(adminId);
    if (!admin) {
        const error = new Error("Admin not found");
        error.statusCode = 404;
        throw error;
    }

    return admin;
};

export const forgotAdminPasswordService = async ({ email }) => {
    const normalizedEmail = normalizeEmail(email);
    const admin = await findAdminByEmail(normalizedEmail);

    if (!admin) {
        return {
            message: "If the email exists, a reset link has been sent",
        };
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await saveAdminResetToken({
        adminId: admin.id,
        tokenHash: resetTokenHash,
        expiresAt: resetTokenExpiresAt,
    });

    const resetLink = `${env.FRONTEND_BASE_URL}/admin/${env.ADMIN_RESET_PATH}?token=${resetToken}`;
    await sendAdminPasswordResetEmail({ to: admin.email, resetLink });

    return {
        message: "If the email exists, a reset link has been sent",
    };
};

export const resetAdminPasswordService = async ({ token, newPassword }) => {
    const resetTokenHash = crypto
        .createHash("sha256")
        .update(String(token || ""))
        .digest("hex");

    const admin = await findAdminByResetTokenHash(resetTokenHash);
    if (!admin || !admin.resetTokenExpiresAt) {
        const error = new Error("Invalid or expired reset token");
        error.statusCode = 400;
        throw error;
    }

    if (new Date(admin.resetTokenExpiresAt).getTime() < Date.now()) {
        const error = new Error("Invalid or expired reset token");
        error.statusCode = 400;
        throw error;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await updateAdminPasswordAndClearResetToken({
        adminId: admin.id,
        passwordHash,
    });

    return { message: "Password reset successful" };
};
