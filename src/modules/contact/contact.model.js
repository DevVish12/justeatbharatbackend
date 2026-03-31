import pool from "../../config/db.js";

const CONTACT_TABLE = "contact_messages";

export const createContactTable = async () => {
    await pool.execute(`
		CREATE TABLE IF NOT EXISTS ${CONTACT_TABLE} (
			id INT AUTO_INCREMENT PRIMARY KEY,
			name VARCHAR(120) NOT NULL,
			email VARCHAR(160) NOT NULL,
			subject VARCHAR(200) NULL,
			message TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);
};

const normalizeRow = (row) => {
    if (!row) {
        return null;
    }

    return {
        id: Number(row.id),
        name: row.name,
        email: row.email,
        subject: row.subject ?? "",
        message: row.message,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
};

export const getContactById = async (id) => {
    const [rows] = await pool.execute(
        `
			SELECT
				id,
				name,
				email,
				subject,
				message,
				created_at AS createdAt,
				updated_at AS updatedAt
			FROM ${CONTACT_TABLE}
			WHERE id = ?
			LIMIT 1
		`,
        [id]
    );

    return normalizeRow(rows[0]);
};

export const createContactMessage = async ({ name, email, subject, message }) => {
    const [result] = await pool.execute(
        `
			INSERT INTO ${CONTACT_TABLE} (name, email, subject, message)
			VALUES (?, ?, ?, ?)
		`,
        [name, email, subject || null, message]
    );

    return getContactById(result.insertId);
};

export const getAllContactMessages = async () => {
    const [rows] = await pool.execute(
        `
			SELECT
				id,
				name,
				email,
				subject,
				message,
				created_at AS createdAt,
				updated_at AS updatedAt
			FROM ${CONTACT_TABLE}
			ORDER BY id DESC
		`
    );

    return rows.map(normalizeRow);
};

export const deleteContactById = async (id) => {
    const contact = await getContactById(id);
    if (!contact) {
        return null;
    }

    await pool.execute(`DELETE FROM ${CONTACT_TABLE} WHERE id = ?`, [id]);
    return contact;
};
