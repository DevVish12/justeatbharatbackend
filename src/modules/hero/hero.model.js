import pool from "../../config/db.js";

const ensureColumnExists = async (columnName, definition) => {
    const [rows] = await pool.execute(
        `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'hero_banners'
                AND COLUMN_NAME = ?
        `,
        [columnName]
    );

    if (!rows.length) {
        await pool.execute(`ALTER TABLE hero_banners ADD COLUMN ${definition}`);
    }
};

const hasLegacyImageUrlColumn = async () => {
    const [rows] = await pool.execute(
        `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'hero_banners'
                AND COLUMN_NAME = 'image_url'
        `
    );

    return rows.length > 0;
};

export const createHeroTable = async () => {
    await pool.execute(`
    CREATE TABLE IF NOT EXISTS hero_banners (
      id INT AUTO_INCREMENT PRIMARY KEY,
            image_desktop VARCHAR(255),
            image_tablet VARCHAR(255),
            image_mobile VARCHAR(255),
      status BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

    await ensureColumnExists("image_desktop", "image_desktop VARCHAR(255) NULL");
    await ensureColumnExists("image_tablet", "image_tablet VARCHAR(255) NULL");
    await ensureColumnExists("image_mobile", "image_mobile VARCHAR(255) NULL");
    await ensureColumnExists("image_url", "image_url VARCHAR(255) NULL");

    const legacyColumnExists = await hasLegacyImageUrlColumn();
    if (legacyColumnExists) {
        await pool.execute(`
            UPDATE hero_banners
            SET
                image_desktop = COALESCE(image_desktop, image_url),
                image_tablet = COALESCE(image_tablet, image_url),
                image_mobile = COALESCE(image_mobile, image_url)
            WHERE image_url IS NOT NULL
        `);
    }
};

export const insertHeroBanner = async ({
    imageDesktop,
    imageTablet,
    imageMobile,
}) => {
    const legacyColumnExists = await hasLegacyImageUrlColumn();

    let result;
    if (legacyColumnExists) {
        [result] = await pool.execute(
            `
                INSERT INTO hero_banners (image_desktop, image_tablet, image_mobile, image_url, status)
                VALUES (?, ?, ?, ?, TRUE)
            `,
            [imageDesktop, imageTablet, imageMobile, imageDesktop]
        );
    } else {
        [result] = await pool.execute(
            `
                INSERT INTO hero_banners (image_desktop, image_tablet, image_mobile, status)
                VALUES (?, ?, ?, TRUE)
            `,
            [imageDesktop, imageTablet, imageMobile]
        );
    }

    const [rows] = await pool.execute(
        `
            SELECT
                id,
                image_desktop AS imageDesktop,
                image_tablet AS imageTablet,
                image_mobile AS imageMobile,
                image_desktop AS imageUrl,
                status,
                created_at AS createdAt
            FROM hero_banners
            WHERE id = ?
            LIMIT 1
        `,
        [result.insertId]
    );

    return rows[0] || null;
};

export const getAllHeroBanners = async () => {
    const [rows] = await pool.execute(
        `
            SELECT
                id,
                image_desktop AS imageDesktop,
                image_tablet AS imageTablet,
                image_mobile AS imageMobile,
                image_desktop AS imageUrl,
                status,
                created_at AS createdAt
            FROM hero_banners
            ORDER BY created_at DESC
        `
    );
    return rows;
};

export const getHeroBannerById = async (id) => {
    const [rows] = await pool.execute(
        `
            SELECT
                id,
                image_desktop AS imageDesktop,
                image_tablet AS imageTablet,
                image_mobile AS imageMobile,
                image_desktop AS imageUrl,
                status,
                created_at AS createdAt
            FROM hero_banners
            WHERE id = ?
            LIMIT 1
        `,
        [id]
    );
    return rows[0] || null;
};

export const toggleHeroBannerStatus = async (id) => {
    const [result] = await pool.execute(
        "UPDATE hero_banners SET status = NOT status WHERE id = ?",
        [id]
    );

    if (!result.affectedRows) {
        return null;
    }

    return getHeroBannerById(id);
};

export const deleteHeroBannerById = async (id) => {
    const banner = await getHeroBannerById(id);
    if (!banner) {
        return null;
    }

    await pool.execute("DELETE FROM hero_banners WHERE id = ?", [id]);
    return banner;
};
