

import pool from "../../config/db.js";

/*
This model ensures that the menu_items table always has
the required schema for Petpooja menu sync.

It automatically:
• Creates table if missing
• Adds missing columns
• Prevents duplicate column errors
*/

const getExistingColumns = async () => {

    const [rows] = await pool.execute(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'menu_items'
    `);

    return new Set(rows.map(r => r.COLUMN_NAME));
};


const addColumnIfMissing = async (existingColumns, columnName, columnSql, fallbackSql) => {

    if (existingColumns.has(columnName)) return;

    try {

        await pool.execute(`ALTER TABLE menu_items ADD COLUMN ${columnSql}`);
        existingColumns.add(columnName);

    } catch (error) {

        // Ignore duplicate column error
        if (error.code === "ER_DUP_FIELDNAME" || error.errno === 1060) {
            existingColumns.add(columnName);
            return;
        }

        if (!fallbackSql) throw error;

        try {

            await pool.execute(`ALTER TABLE menu_items ADD COLUMN ${fallbackSql}`);
            existingColumns.add(columnName);

        } catch (fallbackError) {

            if (fallbackError.code === "ER_DUP_FIELDNAME" || fallbackError.errno === 1060) {
                existingColumns.add(columnName);
                return;
            }

            throw fallbackError;
        }
    }
};


export const createMenuTable = async () => {

    /*
    Step 1
    Ensure table exists
    */

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS menu_items (

            itemid VARCHAR(50) PRIMARY KEY,

            itemname VARCHAR(255) NULL,
            itemdescription TEXT NULL,
            price DECIMAL(10,2) NULL,

            item_categoryid VARCHAR(50) NULL,
            item_attributeid VARCHAR(10) NULL,

            item_image_url TEXT NULL,
            custom_image TEXT NULL,

            in_stock TINYINT NULL,

            itemallowvariation TINYINT NULL,
            variation JSON NULL,

            itemallowaddon TINYINT NULL,
            addon JSON NULL,

            is_combo TINYINT NULL,
            is_recommend TINYINT NULL,

            cuisine JSON NULL,
            item_tags JSON NULL,

            updated_at TIMESTAMP
            DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP

        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);


    /*
    Step 2
    Ensure all columns exist
    */

    const existingColumns = await getExistingColumns();


    await addColumnIfMissing(existingColumns,
        "itemname",
        "itemname VARCHAR(255) NULL"
    );

    await addColumnIfMissing(existingColumns,
        "itemdescription",
        "itemdescription TEXT NULL"
    );

    await addColumnIfMissing(existingColumns,
        "price",
        "price DECIMAL(10,2) NULL"
    );

    await addColumnIfMissing(existingColumns,
        "item_categoryid",
        "item_categoryid VARCHAR(50) NULL"
    );

    await addColumnIfMissing(existingColumns,
        "item_attributeid",
        "item_attributeid VARCHAR(10) NULL"
    );

    await addColumnIfMissing(existingColumns,
        "item_image_url",
        "item_image_url TEXT NULL"
    );

    await addColumnIfMissing(existingColumns,
        "custom_image",
        "custom_image TEXT NULL"
    );

    await addColumnIfMissing(existingColumns,
        "in_stock",
        "in_stock TINYINT NULL"
    );

    await addColumnIfMissing(existingColumns,
        "itemallowvariation",
        "itemallowvariation TINYINT NULL"
    );

    await addColumnIfMissing(
        existingColumns,
        "variation",
        "variation JSON NULL",
        "variation LONGTEXT NULL"
    );

    await addColumnIfMissing(existingColumns,
        "itemallowaddon",
        "itemallowaddon TINYINT NULL"
    );

    await addColumnIfMissing(
        existingColumns,
        "addon",
        "addon JSON NULL",
        "addon LONGTEXT NULL"
    );

    await addColumnIfMissing(existingColumns,
        "is_combo",
        "is_combo TINYINT NULL"
    );

    await addColumnIfMissing(existingColumns,
        "is_recommend",
        "is_recommend TINYINT NULL"
    );

    await addColumnIfMissing(
        existingColumns,
        "cuisine",
        "cuisine JSON NULL",
        "cuisine LONGTEXT NULL"
    );

    await addColumnIfMissing(
        existingColumns,
        "item_tags",
        "item_tags JSON NULL",
        "item_tags LONGTEXT NULL"
    );

    await addColumnIfMissing(existingColumns,
        "updated_at",
        "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    );

};