import pool from "../../config/db.js";

const ensureColumnExists = async (columnName, definition) => {
    const [rows] = await pool.execute(
        `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'admins'
        AND COLUMN_NAME = ?
    `,
        [columnName]
    );

    if (!rows.length) {
        await pool.execute(`ALTER TABLE admins ADD COLUMN ${definition}`);
    }
};

export const createAdminTableIfNotExists = async () => {
    await pool.execute(`
		CREATE TABLE IF NOT EXISTS admins (
			id INT PRIMARY KEY AUTO_INCREMENT,
			email VARCHAR(255) NOT NULL UNIQUE,
			password_hash VARCHAR(255) NOT NULL,
			reset_token_hash VARCHAR(255) NULL,
			reset_token_expires_at DATETIME NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);

    await ensureColumnExists("reset_token_hash", "reset_token_hash VARCHAR(255) NULL");
    await ensureColumnExists(
        "reset_token_expires_at",
        "reset_token_expires_at DATETIME NULL"
    );
};

export const createDishImagesTableIfNotExists = async () => {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS dish_images (
            id INT AUTO_INCREMENT PRIMARY KEY,
            itemid VARCHAR(64) NOT NULL,
            image_path VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_dish_images_itemid (itemid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
};

export const upsertDishImage = async ({ itemid, imagePath }) => {
    const itemId = String(itemid || "").trim();
    const path = String(imagePath || "").trim();

    if (!itemId) {
        const error = new Error("itemid is required");
        error.statusCode = 400;
        throw error;
    }

    if (!path) {
        const error = new Error("imagePath is required");
        error.statusCode = 400;
        throw error;
    }

    await pool.execute(
        `
        INSERT INTO dish_images (itemid, image_path)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
            image_path = VALUES(image_path),
            updated_at = CURRENT_TIMESTAMP
        `,
        [itemId, path]
    );

    return { itemid: itemId, image_path: path };
};

export const findDishImageByItemId = async (itemid) => {
    const itemId = String(itemid || "").trim();
    if (!itemId) return null;

    const [rows] = await pool.execute(
        "SELECT id, itemid, image_path AS imagePath FROM dish_images WHERE itemid = ? LIMIT 1",
        [itemId]
    );
    return rows[0] || null;
};

export const findDishImagesByItemIds = async (itemIds) => {
    const ids = Array.isArray(itemIds)
        ? itemIds.map((id) => String(id || "").trim()).filter(Boolean)
        : [];

    if (ids.length === 0) return new Map();

    const placeholders = ids.map(() => "?").join(",");
    const [rows] = await pool.execute(
        `SELECT itemid, image_path AS imagePath FROM dish_images WHERE itemid IN (${placeholders})`,
        ids
    );

    const map = new Map();
    for (const row of rows) {
        const key = String(row?.itemid || "").trim();
        const value = String(row?.imagePath || "").trim();
        if (key && value) map.set(key, value);
    }
    return map;
};

export const findAdminByEmail = async (email) => {
    const [rows] = await pool.execute(
        "SELECT id, email, password_hash AS passwordHash FROM admins WHERE email = ? LIMIT 1",
        [email]
    );
    return rows[0] || null;
};

export const createAdmin = async ({ email, passwordHash }) => {
    const [result] = await pool.execute(
        "INSERT INTO admins (email, password_hash) VALUES (?, ?)",
        [email, passwordHash]
    );

    return {
        id: result.insertId,
        email,
    };
};

export const findAdminById = async (id) => {
    const [rows] = await pool.execute(
        "SELECT id, email, created_at AS createdAt FROM admins WHERE id = ? LIMIT 1",
        [id]
    );
    return rows[0] || null;
};

export const saveAdminResetToken = async ({ adminId, tokenHash, expiresAt }) => {
    await pool.execute(
        "UPDATE admins SET reset_token_hash = ?, reset_token_expires_at = ? WHERE id = ?",
        [tokenHash, expiresAt, adminId]
    );
};

export const findAdminByResetTokenHash = async (tokenHash) => {
    const [rows] = await pool.execute(
        `
      SELECT id, email, reset_token_expires_at AS resetTokenExpiresAt
      FROM admins
      WHERE reset_token_hash = ?
      LIMIT 1
    `,
        [tokenHash]
    );

    return rows[0] || null;
};

export const updateAdminPasswordAndClearResetToken = async ({
    adminId,
    passwordHash,
}) => {
    await pool.execute(
        `
      UPDATE admins
      SET password_hash = ?,
          reset_token_hash = NULL,
          reset_token_expires_at = NULL
      WHERE id = ?
    `,
        [passwordHash, adminId]
    );
};
