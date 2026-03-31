import env from "../../config/env.js";
import { signUserToken } from "../../utils/jwt.js";
import { getOrCreateUserByPhone, getUserById, updateUserNameById } from "./user.model.js";
import { verifyFirebaseIdToken } from "./firebase.service.js";

const cookieOptions = () => {
    const isProd = env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    };
};

export const firebaseLoginController = async (req, res, next) => {
    try {
        const idToken = req.body?.idToken;
        if (!idToken) {
            return res.status(400).json({ message: "idToken is required" });
        }

        const decoded = await verifyFirebaseIdToken(idToken);
        const phoneNumber = decoded?.phone_number;
        if (!phoneNumber) {
            return res
                .status(400)
                .json({ message: "Phone number not present in Firebase token" });
        }

        const digits = String(phoneNumber).replace(/\D/g, "");
        // For +91 numbers store the 10-digit local mobile.
        const normalizedPhone =
            digits.length === 12 && digits.startsWith("91")
                ? digits.slice(2)
                : digits;

        const user = await getOrCreateUserByPhone(normalizedPhone);

        const token = signUserToken({
            id: user.id,
            phone: user.phone,
            role: "user",
        });

        res.cookie(env.USER_AUTH_COOKIE_NAME, token, cookieOptions());

        return res.status(200).json({
            message: "Login successful",
            user: { id: user.id, phone: user.phone, name: user.name ?? null },
        });
    } catch (error) {
        return next(error);
    }
};

export const getMeController = async (req, res, next) => {
    try {
        const userId = Number(req.user?.id);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await getUserById(userId);
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        return res
            .status(200)
            .json({ user: { id: user.id, phone: user.phone, name: user.name ?? null } });
    } catch (error) {
        return next(error);
    }
};

export const updateMeController = async (req, res, next) => {
    try {
        const userId = Number(req.user?.id);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const rawName = req.body?.name;
        if (rawName === undefined) {
            return res.status(400).json({ message: "name is required" });
        }

        const name = String(rawName).trim();
        if (name.length < 2) {
            return res.status(400).json({ message: "Name must be at least 2 characters" });
        }
        if (name.length > 80) {
            return res.status(400).json({ message: "Name must be at most 80 characters" });
        }

        const updated = await updateUserNameById(userId, name);
        if (!updated) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({
            message: "Profile updated",
            user: { id: updated.id, phone: updated.phone, name: updated.name ?? null },
        });
    } catch (error) {
        return next(error);
    }
};

export const logoutController = async (req, res) => {
    res.clearCookie(env.USER_AUTH_COOKIE_NAME, {
        path: "/",
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
    });

    return res.status(200).json({ message: "Logged out" });
};
