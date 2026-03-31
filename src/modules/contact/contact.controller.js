import {
    createContactMessage,
    deleteContactById,
    getAllContactMessages,
} from "./contact.model.js";

const isValidEmail = (email) => {
    const value = String(email || "").trim();
    if (!value) {
        return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const parseContactPayload = (body = {}) => {
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    return {
        name,
        email,
        subject,
        message,
    };
};

export const createContactController = async (req, res, next) => {
    try {
        const payload = parseContactPayload(req.body);

        if (!payload.name) {
            return res.status(400).json({ message: "Name is required" });
        }

        if (!payload.email) {
            return res.status(400).json({ message: "Email is required" });
        }

        if (!isValidEmail(payload.email)) {
            return res.status(400).json({ message: "Invalid email" });
        }

        if (!payload.subject) {
            return res.status(400).json({ message: "Subject is required" });
        }

        if (!payload.message) {
            return res.status(400).json({ message: "Message is required" });
        }

        const contact = await createContactMessage(payload);
        return res.status(201).json({
            message: "Message submitted successfully",
            contact,
        });
    } catch (error) {
        return next(error);
    }
};

export const getAdminContactsController = async (req, res, next) => {
    try {
        const contacts = await getAllContactMessages();
        return res.status(200).json({ contacts });
    } catch (error) {
        return next(error);
    }
};

export const deleteAdminContactController = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid contact id" });
        }

        const contact = await deleteContactById(id);
        if (!contact) {
            return res.status(404).json({ message: "Contact message not found" });
        }

        return res.status(200).json({ message: "Contact message deleted successfully" });
    } catch (error) {
        return next(error);
    }
};
