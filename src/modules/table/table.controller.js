import { expireReservationsAndFreeTables } from "../reservation/reservation.model.js";
import {
    createTable,
    deleteTableById,
    getAllTables,
    updateTableById,
} from "./table.model.js";

const allowedStatus = new Set(["free", "occupied", "booked"]);

const parseId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) return null;
    return id;
};

export const getTablesController = async (req, res, next) => {
    try {
        await expireReservationsAndFreeTables();
        const tables = await getAllTables();
        return res.status(200).json({ tables });
    } catch (error) {
        return next(error);
    }
};

export const createTableController = async (req, res, next) => {
    try {
        const tableNumber = String(req.body?.table_number ?? req.body?.tableNumber ?? "").trim();
        const statusRaw = req.body?.status;
        const status = statusRaw !== undefined ? String(statusRaw).trim() : undefined;

        if (!tableNumber) {
            return res.status(400).json({ message: "table_number is required" });
        }

        if (status !== undefined && status && !allowedStatus.has(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const table = await createTable({
            tableNumber,
            status: status || "free",
        });

        return res.status(201).json({ message: "Table created", table });
    } catch (error) {
        return next(error);
    }
};

export const updateTableController = async (req, res, next) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Invalid table id" });
        }

        const tableNumberRaw = req.body?.table_number ?? req.body?.tableNumber;
        const statusRaw = req.body?.status;

        const tableNumber =
            tableNumberRaw !== undefined ? String(tableNumberRaw).trim() : undefined;
        const status = statusRaw !== undefined ? String(statusRaw).trim() : undefined;

        if (tableNumber === undefined && status === undefined) {
            return res.status(400).json({ message: "Nothing to update" });
        }

        if (status !== undefined && status && !allowedStatus.has(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const updated = await updateTableById(id, {
            tableNumber,
            status,
        });

        if (!updated) {
            return res.status(404).json({ message: "Table not found" });
        }

        return res.status(200).json({ message: "Table updated", table: updated });
    } catch (error) {
        return next(error);
    }
};

export const deleteTableController = async (req, res, next) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Invalid table id" });
        }

        const deleted = await deleteTableById(id);
        if (!deleted) {
            return res.status(404).json({ message: "Table not found" });
        }

        return res.status(200).json({ message: "Table deleted" });
    } catch (error) {
        return next(error);
    }
};
