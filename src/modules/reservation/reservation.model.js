import pool from "../../config/db.js";

const RESERVATIONS_TABLE = "reservations";
const TABLES_TABLE = "tables";

export const createReservationsTable = async () => {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${RESERVATIONS_TABLE} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            table_id INT NOT NULL,
            table_number VARCHAR(50) NULL,
            user_phone VARCHAR(30) NOT NULL,
            starts_at DATETIME NOT NULL,
            ends_at DATETIME NOT NULL,
            status ENUM('ACTIVE','EXPIRED','CANCELLED') DEFAULT 'ACTIVE',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_phone (user_phone),
            INDEX idx_table_active (table_id, status),
            INDEX idx_ends_at (ends_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
};

export const expireReservationsAndFreeTables = async (conn = pool) => {
    await conn.execute(
        `
            UPDATE ${RESERVATIONS_TABLE}
            SET status = 'EXPIRED'
            WHERE status = 'ACTIVE'
              AND ends_at <= NOW()
        `
    );

    await conn.execute(
        `
            UPDATE ${TABLES_TABLE}
            SET status = 'free', booked_until = NULL, booked_by_phone = NULL
            WHERE status = 'booked'
              AND booked_until IS NOT NULL
              AND booked_until <= NOW()
        `
    );
};

const normalizePhone = (raw) => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";

    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
    if (digits.length > 10) return digits.slice(-10);
    return digits;
};

const normalizeReservation = (row) => {
    if (!row) return null;
    return {
        id: Number(row.id),
        tableId: Number(row.tableId ?? row.table_id),
        tableNumber: row.tableNumber ?? row.table_number ?? "",
        userPhone: row.userPhone ?? row.user_phone ?? "",
        startsAt: row.startsAt ?? row.starts_at,
        endsAt: row.endsAt ?? row.ends_at,
        status: row.status,
        createdAt: row.createdAt ?? row.created_at,
    };
};

export const listReservationsByPhone = async ({ phone, limit } = {}) => {
    const normalized = normalizePhone(phone);
    const safeLimit = Number(limit);
    const useLimit = Number.isFinite(safeLimit) ? Math.min(Math.max(safeLimit, 1), 500) : 200;

    await expireReservationsAndFreeTables();

    const [rows] = await pool.execute(
        `
            SELECT
                r.id,
                r.table_id AS tableId,
                CASE
                    WHEN r.ends_at > NOW() AND t.table_number IS NOT NULL THEN t.table_number
                    ELSE r.table_number
                END AS tableNumber,
                r.user_phone AS userPhone,
                r.starts_at AS startsAt,
                r.ends_at AS endsAt,
                r.status,
                r.created_at AS createdAt
            FROM ${RESERVATIONS_TABLE} r
            LEFT JOIN ${TABLES_TABLE} t ON t.id = r.table_id
            WHERE r.user_phone = ?
            ORDER BY r.id DESC
            LIMIT ${useLimit}
        `,
        [normalized]
    );

    return rows.map(normalizeReservation);
};

export const listReservations = async ({ limit } = {}) => {
    const safeLimit = Number(limit);
    const useLimit = Number.isFinite(safeLimit) ? Math.min(Math.max(safeLimit, 1), 500) : 200;

    await expireReservationsAndFreeTables();

    const [rows] = await pool.execute(
        `
            SELECT
                r.id,
                r.table_id AS tableId,
                CASE
                    WHEN r.ends_at > NOW() AND t.table_number IS NOT NULL THEN t.table_number
                    ELSE r.table_number
                END AS tableNumber,
                r.user_phone AS userPhone,
                r.starts_at AS startsAt,
                r.ends_at AS endsAt,
                r.status,
                r.created_at AS createdAt
            FROM ${RESERVATIONS_TABLE} r
            LEFT JOIN ${TABLES_TABLE} t ON t.id = r.table_id
            ORDER BY r.id DESC
            LIMIT ${useLimit}
        `
    );

    return rows.map(normalizeReservation);
};

export const bookTableByNumberForPhone = async ({
    tableNumber,
    phone,
    durationMinutes,
} = {}) => {
    const normalizedPhone = normalizePhone(phone);
    const normalizedTableNumber = String(tableNumber || "").trim();
    const minsRaw = Number(durationMinutes);
    const mins = Number.isFinite(minsRaw) ? Math.min(Math.max(minsRaw, 5), 24 * 60) : 60;

    if (!normalizedPhone) {
        const err = new Error("phone is required");
        err.statusCode = 400;
        throw err;
    }

    if (!normalizedTableNumber) {
        const err = new Error("table_no is required");
        err.statusCode = 400;
        throw err;
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await expireReservationsAndFreeTables(conn);

        const [tables] = await conn.execute(
            `
                SELECT id, table_number AS tableNumber, status, booked_until AS bookedUntil, booked_by_phone AS bookedByPhone
                FROM ${TABLES_TABLE}
                WHERE table_number = ?
                LIMIT 1
                FOR UPDATE
            `,
            [normalizedTableNumber]
        );

        const table = tables?.[0] || null;
        if (!table) {
            const err = new Error("Table not found");
            err.statusCode = 404;
            throw err;
        }

        const status = String(table.status || "");
        const bookedByPhone = normalizePhone(table.bookedByPhone);
        const bookedUntil = table.bookedUntil ? new Date(table.bookedUntil) : null;
        const now = new Date();

        if (status === "occupied") {
            const err = new Error("Table is occupied");
            err.statusCode = 409;
            throw err;
        }

        if (status === "booked") {
            const stillBooked = bookedUntil && bookedUntil.getTime() > now.getTime();
            if (stillBooked && bookedByPhone && bookedByPhone !== normalizedPhone) {
                const err = new Error("Table is already booked");
                err.statusCode = 409;
                throw err;
            }
        }

        const startsAt = now;
        const endsAt = new Date(now.getTime() + mins * 60 * 1000);

        const [result] = await conn.execute(
            `
                INSERT INTO ${RESERVATIONS_TABLE} (table_id, table_number, user_phone, starts_at, ends_at, status)
                VALUES (?, ?, ?, ?, ?, 'ACTIVE')
            `,
            [Number(table.id), normalizedTableNumber, normalizedPhone, startsAt, endsAt]
        );

        await conn.execute(
            `
                UPDATE ${TABLES_TABLE}
                SET status = 'booked', booked_until = ?, booked_by_phone = ?
                WHERE id = ?
            `,
            [endsAt, normalizedPhone, Number(table.id)]
        );

        await conn.commit();

        const insertedId = Number(result.insertId);
        const [rows] = await pool.execute(
            `
                SELECT
                    id,
                    table_id AS tableId,
                    table_number AS tableNumber,
                    user_phone AS userPhone,
                    starts_at AS startsAt,
                    ends_at AS endsAt,
                    status,
                    created_at AS createdAt
                FROM ${RESERVATIONS_TABLE}
                WHERE id = ?
                LIMIT 1
            `,
            [insertedId]
        );

        return normalizeReservation(rows[0]);
    } catch (error) {
        try {
            await conn.rollback();
        } catch {
            // ignore
        }
        throw error;
    } finally {
        conn.release();
    }
};
