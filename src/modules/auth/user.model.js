import pool from "../../config/db.js";

const USERS_TABLE = "users";

export const createUsersTable = async () => {
    await pool.execute(`
		CREATE TABLE IF NOT EXISTS ${USERS_TABLE} (
			id INT AUTO_INCREMENT PRIMARY KEY,
			phone VARCHAR(15) NOT NULL,
			name VARCHAR(80) NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			UNIQUE KEY uniq_users_phone (phone)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);

    // Lightweight migration for existing DBs: add `name` column if missing.
    const [nameColumns] = await pool.execute(
        `SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'name'`
    );
    if (!Array.isArray(nameColumns) || nameColumns.length === 0) {
        await pool.execute(
            `ALTER TABLE ${USERS_TABLE} ADD COLUMN name VARCHAR(80) NULL AFTER phone`
        );
    }
};

const normalizeRow = (row) => {
    if (!row) {
        return null;
    }

    return {
        id: Number(row.id),
        phone: row.phone,
        name: row.name ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
};

export const getUserById = async (id) => {
    const [rows] = await pool.execute(
        `
			SELECT
				id,
				phone,
                name,
				created_at AS createdAt,
				updated_at AS updatedAt
			FROM ${USERS_TABLE}
			WHERE id = ?
			LIMIT 1
		`,
        [id]
    );

    return normalizeRow(rows[0]);
};

export const getUserByPhone = async (phone) => {
    const [rows] = await pool.execute(
        `
			SELECT
				id,
				phone,
				name,
				created_at AS createdAt,
				updated_at AS updatedAt
			FROM ${USERS_TABLE}
			WHERE phone = ?
			LIMIT 1
		`,
        [phone]
    );

    return normalizeRow(rows[0]);
};

export const updateUserNameById = async (id, name) => {
    await pool.execute(
        `UPDATE ${USERS_TABLE} SET name = ? WHERE id = ? LIMIT 1`,
        [name, id]
    );

    return getUserById(id);
};

export const createUser = async (phone) => {
    const [result] = await pool.execute(
        `INSERT INTO ${USERS_TABLE} (phone) VALUES (?)`,
        [phone]
    );

    return getUserById(result.insertId);
};

export const getOrCreateUserByPhone = async (phone) => {
    const existing = await getUserByPhone(phone);
    if (existing) {
        return existing;
    }

    try {
        return await createUser(phone);
    } catch (error) {
        if (error?.code === "ER_DUP_ENTRY") {
            return getUserByPhone(phone);
        }
        throw error;
    }
};
