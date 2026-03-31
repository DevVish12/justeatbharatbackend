import pool from "../../config/db.js";

let ensured = false;

export const createStoreSettingsTableIfNotExists = async () => {
    if (ensured) return;

    await pool.query(`
        CREATE TABLE IF NOT EXISTS store_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            store_open TINYINT NOT NULL DEFAULT 1,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [rows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM store_settings`
    );
    const count = Number(rows?.[0]?.cnt ?? 0);

    if (!Number.isFinite(count) || count <= 0) {
        await pool.query(
            `INSERT INTO store_settings (store_open, updated_at) VALUES (1, NOW())`
        );
    }

    ensured = true;
};

export const getStoreOpen = async () => {
    await createStoreSettingsTableIfNotExists();

    const [rows] = await pool.query(
        `SELECT store_open FROM store_settings ORDER BY id DESC LIMIT 1`
    );

    const value = rows?.[0]?.store_open;
    return Number(value) === 1;
};

export const setStoreOpen = async ({ storeOpen }) => {
    await createStoreSettingsTableIfNotExists();

    const next = storeOpen ? 1 : 0;
    await pool.query(
        `INSERT INTO store_settings (store_open, updated_at) VALUES (?, NOW())`,
        [next]
    );

    return getStoreOpen();
};
