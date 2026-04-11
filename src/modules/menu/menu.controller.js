import pool from "../../config/db.js";
import { createCategoryTable } from "./menu.category.model.js";

export const getMenuFromDb = async (req, res) => {
    try {
        await createCategoryTable();
        const [rows] = await pool.execute(
            `
            SELECT
                m.*,
                c.categoryname
            FROM menu_items m
            LEFT JOIN menu_categories c
                ON m.item_categoryid = c.categoryid
            ORDER BY m.updated_at DESC
            `
        );

        const categoriesById = new Map();
        for (const row of rows || []) {
            const categoryid = String(row?.item_categoryid ?? "").trim();
            if (!categoryid) continue;

            const categoryname = row?.categoryname ?? "";
            if (!categoriesById.has(categoryid)) {
                categoriesById.set(categoryid, {
                    categoryid,
                    categoryname,
                });
            }
        }

        return res.status(200).json({
            success: true,
            categories: Array.from(categoriesById.values()),
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
