import pool from "../../config/db.js";

export const getMenuFromDb = async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `
            SELECT
                itemid,
                itemname,
                itemdescription,
                price,
                item_categoryid,
                item_attributeid,
                item_image_url,
                in_stock,
                itemallowvariation,
                variation,
                itemallowaddon,
                addon,
                is_combo,
                is_recommend,
                cuisine,
                item_tags,
                custom_image,
                updated_at
            FROM menu_items
            ORDER BY updated_at DESC
            `
        );

        return res.status(200).json({
            success: true,
            items: rows || [],
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error?.message || "Failed to load menu from database",
        });
    }
};

export const menuNotImplemented = async (req, res) => {
    return res.status(501).json({
        message:
            "Menu module endpoints are not implemented in this backend snapshot.",
    });
};
