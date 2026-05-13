// import pool from "../../config/db.js";

// const USERS_TABLE = "users";

// export const createUsersTable = async () => {
//     await pool.execute(`
// 		CREATE TABLE IF NOT EXISTS ${USERS_TABLE} (
// 			id INT AUTO_INCREMENT PRIMARY KEY,
// 			phone VARCHAR(15) NOT NULL,
// 			name VARCHAR(80) NULL,
// 			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
// 			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
// 			UNIQUE KEY uniq_users_phone (phone)
// 		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
// 	`);

//     // Lightweight migration for existing DBs: add `name` column if missing.
//     const [nameColumns] = await pool.execute(
//         `SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'name'`
//     );
//     if (!Array.isArray(nameColumns) || nameColumns.length === 0) {
//         await pool.execute(
//             `ALTER TABLE ${USERS_TABLE} ADD COLUMN name VARCHAR(80) NULL AFTER phone`
//         );
//     }
// };

// const normalizeRow = (row) => {
//     if (!row) {
//         return null;
//     }

//     return {
//         id: Number(row.id),
//         phone: row.phone,
//         name: row.name ?? null,
//         createdAt: row.createdAt,
//         updatedAt: row.updatedAt,
//     };
// };

// export const getUserById = async (id) => {
//     const [rows] = await pool.execute(
//         `
// 			SELECT
// 				id,
// 				phone,
//                 name,
// 				created_at AS createdAt,
// 				updated_at AS updatedAt
// 			FROM ${USERS_TABLE}
// 			WHERE id = ?
// 			LIMIT 1
// 		`,
//         [id]
//     );

//     return normalizeRow(rows[0]);
// };

// export const getUserByPhone = async (phone) => {
//     const [rows] = await pool.execute(
//         `
// 			SELECT
// 				id,
// 				phone,
// 				name,
// 				created_at AS createdAt,
// 				updated_at AS updatedAt
// 			FROM ${USERS_TABLE}
// 			WHERE phone = ?
// 			LIMIT 1
// 		`,
//         [phone]
//     );

//     return normalizeRow(rows[0]);
// };

// export const updateUserNameById = async (id, name) => {
//     await pool.execute(
//         `UPDATE ${USERS_TABLE} SET name = ? WHERE id = ? LIMIT 1`,
//         [name, id]
//     );

//     return getUserById(id);
// };

// export const createUser = async (phone) => {
//     const [result] = await pool.execute(
//         `INSERT INTO ${USERS_TABLE} (phone) VALUES (?)`,
//         [phone]
//     );

//     return getUserById(result.insertId);
// };

// export const getOrCreateUserByPhone = async (phone) => {
//     const existing = await getUserByPhone(phone);
//     if (existing) {
//         return existing;
//     }

//     try {
//         return await createUser(phone);
//     } catch (error) {
//         if (error?.code === "ER_DUP_ENTRY") {
//             return getUserByPhone(phone);
//         }
//         throw error;
//     }
// };


import pool from "../../config/db.js";

const USERS_TABLE = "users";
const USER_LOGIN_HISTORY_TABLE = "user_login_history";

export const createUsersTable = async () => {
    await pool.execute(`
		CREATE TABLE IF NOT EXISTS ${USERS_TABLE} (
			id INT AUTO_INCREMENT PRIMARY KEY,
			phone VARCHAR(15) NOT NULL,
			name VARCHAR(80) NULL,
            is_verified BOOLEAN DEFAULT FALSE,
            last_login TIMESTAMP NULL,
            login_count INT DEFAULT 0,
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

    const [isVerifiedColumns] = await pool.execute(
        `SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'is_verified'`
    );
    if (!Array.isArray(isVerifiedColumns) || isVerifiedColumns.length === 0) {
        await pool.execute(
            `ALTER TABLE ${USERS_TABLE} ADD COLUMN is_verified BOOLEAN DEFAULT FALSE AFTER name`
        );
    }

    const [lastLoginColumns] = await pool.execute(
        `SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'last_login'`
    );
    if (!Array.isArray(lastLoginColumns) || lastLoginColumns.length === 0) {
        await pool.execute(
            `ALTER TABLE ${USERS_TABLE} ADD COLUMN last_login TIMESTAMP NULL AFTER is_verified`
        );
    }

    const [loginCountColumns] = await pool.execute(
        `SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'login_count'`
    );
    if (!Array.isArray(loginCountColumns) || loginCountColumns.length === 0) {
        await pool.execute(
            `ALTER TABLE ${USERS_TABLE} ADD COLUMN login_count INT DEFAULT 0 AFTER last_login`
        );
    }

    await createUserLoginHistoryTable();
};

export const createUserLoginHistoryTable = async () => {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${USER_LOGIN_HISTORY_TABLE} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            phone VARCHAR(15) NOT NULL,
            ip_address VARCHAR(45) NULL,
            user_agent VARCHAR(255) NULL,
            login_status VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_login_history_user_id (user_id),
            INDEX idx_login_history_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
};

const normalizeRow = (row) => {
    if (!row) {
        return null;
    }

    return {
        id: Number(row.id),
        phone: row.phone,
        name: row.name ?? null,
        isVerified: row.isVerified === undefined ? undefined : Boolean(row.isVerified),
        lastLogin: row.lastLogin ?? null,
        loginCount: row.loginCount === undefined ? undefined : Number(row.loginCount ?? 0),
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
                is_verified AS isVerified,
                last_login AS lastLogin,
                login_count AS loginCount,
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
                is_verified AS isVerified,
                last_login AS lastLogin,
                login_count AS loginCount,
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

export const markUserLoginSuccess = async (userId) => {
    await pool.execute(
        `
            UPDATE ${USERS_TABLE}
            SET
                is_verified = TRUE,
                last_login = CURRENT_TIMESTAMP,
                login_count = COALESCE(login_count, 0) + 1
            WHERE id = ?
            LIMIT 1
        `,
        [userId]
    );

    return getUserById(userId);
};

export const insertUserLoginHistory = async ({
    userId,
    phone,
    ipAddress,
    userAgent,
    loginStatus,
}) => {
    await pool.execute(
        `
            INSERT INTO ${USER_LOGIN_HISTORY_TABLE}
                (user_id, phone, ip_address, user_agent, login_status)
            VALUES
                (?, ?, ?, ?, ?)
        `,
        [userId ?? null, phone, ipAddress ?? null, userAgent ?? null, loginStatus]
    );
};

export const getUsersForAdmin = async () => {
    const [rows] = await pool.execute(
        `
            SELECT
                id,
                phone,
                name,
                created_at AS createdAt,
                last_login AS lastLogin,
                login_count AS loginCount,
                is_verified AS isVerified
            FROM ${USERS_TABLE}
            ORDER BY created_at DESC
        `
    );

    return Array.isArray(rows)
        ? rows.map((row) => ({
            id: Number(row.id),
            phone: row.phone,
            name: row.name ?? null,
            createdAt: row.createdAt,
            lastLogin: row.lastLogin ?? null,
            loginCount: Number(row.loginCount ?? 0),
            isVerified: Boolean(row.isVerified),
        }))
        : [];
};

export const getLoginHistoryForAdmin = async ({ limit = 500 } = {}) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 2000);

    const [rows] = await pool.execute(
        `
            SELECT
                h.id,
                h.user_id AS userId,
                h.phone,
                h.ip_address AS ipAddress,
                h.user_agent AS userAgent,
                h.login_status AS loginStatus,
                h.created_at AS createdAt
            FROM ${USER_LOGIN_HISTORY_TABLE} h
            ORDER BY h.created_at DESC
            LIMIT ${safeLimit}
        `
    );

    return Array.isArray(rows)
        ? rows.map((row) => ({
            id: Number(row.id),
            userId: row.userId === null ? null : Number(row.userId),
            phone: row.phone,
            ipAddress: row.ipAddress ?? null,
            userAgent: row.userAgent ?? null,
            loginStatus: row.loginStatus,
            createdAt: row.createdAt,
        }))
        : [];
};
