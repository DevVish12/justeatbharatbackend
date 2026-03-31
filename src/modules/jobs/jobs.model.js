import pool from "../../config/db.js";

const JOB_TABLE = "job_applications";

export const createJobApplicationsTable = async () => {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${JOB_TABLE} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(140) NOT NULL,
            email VARCHAR(180) NOT NULL,
            phone VARCHAR(40) NOT NULL,
            position VARCHAR(180) NOT NULL,
            resume_filename VARCHAR(255) NOT NULL,
            resume_original_name VARCHAR(255) NULL,
            resume_mime VARCHAR(120) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
};

const normalizeRow = (row) => {
    if (!row) return null;

    return {
        id: Number(row.id),
        name: row.name,
        email: row.email,
        phone: row.phone,
        position: row.position,
        resumeFilename: row.resumeFilename,
        resumeOriginalName: row.resumeOriginalName || "",
        resumeMime: row.resumeMime || "",
        createdAt: row.createdAt,
    };
};

export const getJobApplicationById = async (id) => {
    const [rows] = await pool.execute(
        `
            SELECT
                id,
                name,
                email,
                phone,
                position,
                resume_filename AS resumeFilename,
                resume_original_name AS resumeOriginalName,
                resume_mime AS resumeMime,
                created_at AS createdAt
            FROM ${JOB_TABLE}
            WHERE id = ?
            LIMIT 1
        `,
        [id]
    );

    return normalizeRow(rows[0]);
};

export const createJobApplication = async ({
    name,
    email,
    phone,
    position,
    resumeFilename,
    resumeOriginalName,
    resumeMime,
}) => {
    const [result] = await pool.execute(
        `
            INSERT INTO ${JOB_TABLE}
                (name, email, phone, position, resume_filename, resume_original_name, resume_mime)
            VALUES
                (?, ?, ?, ?, ?, ?, ?)
        `,
        [
            name,
            email,
            phone,
            position,
            resumeFilename,
            resumeOriginalName || null,
            resumeMime || null,
        ]
    );

    return getJobApplicationById(result.insertId);
};

export const getAllJobApplications = async () => {
    const [rows] = await pool.execute(
        `
            SELECT
                id,
                name,
                email,
                phone,
                position,
                resume_filename AS resumeFilename,
                resume_original_name AS resumeOriginalName,
                resume_mime AS resumeMime,
                created_at AS createdAt
            FROM ${JOB_TABLE}
            ORDER BY id DESC
        `
    );

    return rows.map(normalizeRow);
};

export const deleteJobApplicationById = async (id) => {
    const application = await getJobApplicationById(id);
    if (!application) {
        return null;
    }

    await pool.execute(`DELETE FROM ${JOB_TABLE} WHERE id = ?`, [id]);
    return application;
};
