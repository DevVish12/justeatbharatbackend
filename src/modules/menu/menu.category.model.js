import pool from "../../config/db.js";

/*
Auto-migrating table for Petpooja menu categories.

Follows the same pattern as menu_items:
- Creates table if missing
- Adds missing columns dynamically
- Avoids duplicate column/index errors
*/

const getExistingColumns = async () => {
    const [rows] = await pool.execute(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'menu_categories'
    `);

    return new Set((rows || []).map((r) => r.COLUMN_NAME));
};

const addColumnIfMissing = async (existingColumns, columnName, columnSql) => {
    if (existingColumns.has(columnName)) return;

    try {
        await pool.execute(`ALTER TABLE menu_categories ADD COLUMN ${columnSql}`);
        existingColumns.add(columnName);
        console.log(`[menu_categories] Added missing column: ${columnName}`);
    } catch (error) {
        // Ignore duplicate column error
        if (error?.code === "ER_DUP_FIELDNAME" || error?.errno === 1060) {
            existingColumns.add(columnName);
            return;
        }

        console.error(
            `[menu_categories] Failed to add column ${columnName}:`,
            error?.message || error
        );
        throw error;
    }
};

const ensureUniqueIndex = async (indexName, indexSql) => {
    try {
        await pool.execute(indexSql);
        console.log(`[menu_categories] Ensured UNIQUE index: ${indexName}`);
    } catch (error) {
        // Ignore "Duplicate key name"
        if (error?.code === "ER_DUP_KEYNAME" || error?.errno === 1061) return;
        console.error(
            `[menu_categories] Failed to ensure UNIQUE index ${indexName}:`,
            error?.message || error
        );
        throw error;
    }
};

export const createCategoryTable = async () => {
    // Step 1: ensure table exists.
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS menu_categories (
            categoryid VARCHAR(50) PRIMARY KEY,
            categoryname VARCHAR(255) NULL,
            updated_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Step 2: ensure required columns exist.
    const existingColumns = await getExistingColumns();

    await addColumnIfMissing(existingColumns, "categoryid", "categoryid VARCHAR(50)");
    await addColumnIfMissing(existingColumns, "categoryname", "categoryname VARCHAR(255) NULL");
    await addColumnIfMissing(
        existingColumns,
        "updated_at",
        "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    );

    // Requirement: petpooja category id should be unique.
    // Here categoryid IS the petpooja category id and is PRIMARY KEY, which is already unique.
    // Still, keep an explicit unique index for clarity/safety.
    await ensureUniqueIndex(
        "uniq_menu_categories_categoryid",
        "ALTER TABLE menu_categories ADD UNIQUE KEY uniq_menu_categories_categoryid (categoryid)"
    );
};
