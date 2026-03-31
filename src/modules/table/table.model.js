import pool from "../../config/db.js";

const TABLES_TABLE = "tables";

export const createTablesTable = async () => {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLES_TABLE} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            table_number VARCHAR(50),
            status ENUM('free','occupied','booked') DEFAULT 'free',
            booked_until DATETIME NULL,
            booked_by_phone VARCHAR(30) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Lightweight migrations for existing installs.
    const [statusCols] = await pool.execute(
        `SHOW COLUMNS FROM ${TABLES_TABLE} LIKE 'status'`
    );
    const statusType = String(statusCols?.[0]?.Type || "");
    if (statusType && !statusType.includes("'booked'")) {
        await pool.execute(
            `ALTER TABLE ${TABLES_TABLE} MODIFY COLUMN status ENUM('free','occupied','booked') DEFAULT 'free'`
        );
    }

    const [bookedUntilCols] = await pool.execute(
        `SHOW COLUMNS FROM ${TABLES_TABLE} LIKE 'booked_until'`
    );
    if (!bookedUntilCols || bookedUntilCols.length === 0) {
        await pool.execute(
            `ALTER TABLE ${TABLES_TABLE} ADD COLUMN booked_until DATETIME NULL`
        );
    }

    const [bookedByCols] = await pool.execute(
        `SHOW COLUMNS FROM ${TABLES_TABLE} LIKE 'booked_by_phone'`
    );
    if (!bookedByCols || bookedByCols.length === 0) {
        await pool.execute(
            `ALTER TABLE ${TABLES_TABLE} ADD COLUMN booked_by_phone VARCHAR(30) NULL`
        );
    }
};

const normalizeRow = (row) => {
    if (!row) return null;

    return {
        id: Number(row.id),
        tableNumber: row.tableNumber ?? row.table_number ?? "",
        status: row.status,
        bookedUntil: row.bookedUntil ?? row.booked_until ?? null,
        bookedByPhone: row.bookedByPhone ?? row.booked_by_phone ?? null,
        createdAt: row.createdAt ?? row.created_at,
    };
};

export const releaseExpiredBookings = async () => {
    await pool.execute(
        `
            UPDATE ${TABLES_TABLE}
            SET status = 'free', booked_until = NULL, booked_by_phone = NULL
            WHERE status = 'booked'
              AND booked_until IS NOT NULL
              AND booked_until <= NOW()
        `
    );
};

export const getTableById = async (id) => {
    const [rows] = await pool.execute(
        `
            SELECT
                id,
                table_number AS tableNumber,
                status,
                booked_until AS bookedUntil,
                booked_by_phone AS bookedByPhone,
                created_at AS createdAt
            FROM ${TABLES_TABLE}
            WHERE id = ?
            LIMIT 1
        `,
        [id]
    );

    return normalizeRow(rows[0]);
};

export const getTableByNumber = async (tableNumber) => {
    const tn = String(tableNumber || "").trim();
    if (!tn) return null;

    const [rows] = await pool.execute(
        `
            SELECT
                id,
                table_number AS tableNumber,
                status,
                booked_until AS bookedUntil,
                booked_by_phone AS bookedByPhone,
                created_at AS createdAt
            FROM ${TABLES_TABLE}
            WHERE table_number = ?
            LIMIT 1
        `,
        [tn]
    );

    return normalizeRow(rows[0]);
};

export const getAllTables = async () => {
    const [rows] = await pool.execute(
        `
            SELECT
                id,
                table_number AS tableNumber,
                status,
                booked_until AS bookedUntil,
                booked_by_phone AS bookedByPhone,
                created_at AS createdAt
            FROM ${TABLES_TABLE}
            ORDER BY id DESC
        `
    );

    return rows.map(normalizeRow);
};

export const createTable = async ({ tableNumber, status }) => {
    const [result] = await pool.execute(
        `
            INSERT INTO ${TABLES_TABLE} (table_number, status)
            VALUES (?, ?)
        `,
        [tableNumber || null, status || "free"]
    );

    return getTableById(result.insertId);
};

export const updateTableById = async (id, { tableNumber, status }) => {
    const existing = await getTableById(id);
    if (!existing) return null;

    const nextTableNumber = tableNumber !== undefined ? tableNumber : existing.tableNumber;
    const nextStatus = status !== undefined ? status : existing.status;

    const shouldClearBooking = nextStatus !== "booked";
    await pool.execute(
        `
            UPDATE ${TABLES_TABLE}
            SET table_number = ?,
                status = ?,
                booked_until = ${shouldClearBooking ? "NULL" : "booked_until"},
                booked_by_phone = ${shouldClearBooking ? "NULL" : "booked_by_phone"}
            WHERE id = ?
        `,
        [nextTableNumber || null, nextStatus, id]
    );

    return getTableById(id);
};

export const deleteTableById = async (id) => {
    const existing = await getTableById(id);
    if (!existing) return null;

    await pool.execute(`DELETE FROM ${TABLES_TABLE} WHERE id = ?`, [id]);
    return existing;
};
