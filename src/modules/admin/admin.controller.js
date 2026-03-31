import {
    forgotAdminPasswordService,
    getAdminProfileService,
    loginAdminService,
    registerAdminService,
    resetAdminPasswordService,
} from "./admin.service.js";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));

export const registerAdminController = async (req, res, next) => {
    try {
        const { email, password, confirmPassword } = req.body || {};

        if (!email || !password || !confirmPassword) {
            return res.status(400).json({ message: "Email, password and confirm password are required" });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Password and confirm password do not match" });
        }

        const admin = await registerAdminService({ email, password });

        return res.status(201).json({
            message: "Admin registered successfully",
            admin,
        });
    } catch (error) {
        return next(error);
    }
};

export const loginAdminController = async (req, res, next) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        const result = await loginAdminService({ email, password });
        return res.status(200).json({
            message: "Login successful",
            ...result,
        });
    } catch (error) {
        return next(error);
    }
};

export const getAdminProfileController = async (req, res, next) => {
    try {
        const admin = await getAdminProfileService(req.admin.id);
        return res.status(200).json({ admin });
    } catch (error) {
        return next(error);
    }
};

export const logoutAdminController = async (req, res) =>
    res.status(200).json({ message: "Logout successful" });

export const forgotAdminPasswordController = async (req, res, next) => {
    try {
        const { email } = req.body || {};

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        const result = await forgotAdminPasswordService({ email });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

export const resetAdminPasswordController = async (req, res, next) => {
    try {
        const { token, password, confirmPassword } = req.body || {};

        if (!token || !password || !confirmPassword) {
            return res
                .status(400)
                .json({ message: "Token, password and confirm password are required" });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Password and confirm password do not match" });
        }

        const result = await resetAdminPasswordService({
            token,
            newPassword: password,
        });

        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};
