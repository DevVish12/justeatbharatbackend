import {
    bookTableByNumberForPhone,
    listReservations,
    listReservationsByPhone,
} from "./reservation.model.js";

export const listMyReservationsController = async (req, res, next) => {
    try {
        const phone = String(req.user?.phone || "").trim();
        if (!phone) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const reservations = await listReservationsByPhone({
            phone,
            limit: req.query?.limit,
        });

        return res.status(200).json({ reservations });
    } catch (error) {
        return next(error);
    }
};

export const listReservationsController = async (req, res, next) => {
    try {
        const reservations = await listReservations({ limit: req.query?.limit });
        return res.status(200).json({ reservations });
    } catch (error) {
        return next(error);
    }
};

export const createReservationController = async (req, res, next) => {
    try {
        const phone = String(req.user?.phone || "").trim();
        if (!phone) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const tableNo = String(req.body?.table_no ?? req.body?.tableNo ?? "").trim();
        const durationMinutes = req.body?.duration_minutes ?? req.body?.durationMinutes;

        const reservation = await bookTableByNumberForPhone({
            tableNumber: tableNo,
            phone,
            durationMinutes,
        });

        return res.status(201).json({ message: "Table booked", reservation });
    } catch (error) {
        return next(error);
    }
};
