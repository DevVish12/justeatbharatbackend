import pool from "../../config/db.js";

const COUPONS_TABLE = "coupons";
const COUPON_USAGE_TABLE = "coupon_usage";

export const createCouponTables = async () => {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${COUPONS_TABLE} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(60) NOT NULL,
            title VARCHAR(140) NULL,
            description TEXT NULL,
            discount_type ENUM('flat','percent','free_item','bogo') NOT NULL,
            discount_value DECIMAL(10,2) NULL,
            min_order DECIMAL(10,2) NULL,
            dish_id VARCHAR(60) NULL,
            free_item_id VARCHAR(60) NULL,
            max_discount DECIMAL(10,2) NULL,
            usage_limit INT NULL,
            per_user_limit INT NULL,
            used_count INT NOT NULL DEFAULT 0,
            expiry_date DATETIME NULL,
            new_user_only TINYINT(1) NOT NULL DEFAULT 0,
            status ENUM('active','inactive') NOT NULL DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_coupon_code (code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${COUPON_USAGE_TABLE} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            coupon_id INT NOT NULL,
            user_id VARCHAR(120) NOT NULL,
            order_id VARCHAR(120) NULL,
            used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_coupon_usage_coupon_id (coupon_id),
            INDEX idx_coupon_usage_user_id (user_id),
            CONSTRAINT fk_coupon_usage_coupon
                FOREIGN KEY (coupon_id) REFERENCES ${COUPONS_TABLE}(id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
};

const normalizeCouponRow = (row) => {
    if (!row) return null;

    return {
        id: Number(row.id),
        code: row.code,
        title: row.title || "",
        description: row.description || "",
        discountType: row.discountType,
        discountValue: row.discountValue !== null ? Number(row.discountValue) : null,
        minOrder: row.minOrder !== null ? Number(row.minOrder) : null,
        dishId: row.dishId || "",
        freeItemId: row.freeItemId || "",
        maxDiscount: row.maxDiscount !== null ? Number(row.maxDiscount) : null,
        usageLimit: row.usageLimit !== null ? Number(row.usageLimit) : null,
        perUserLimit: row.perUserLimit !== null ? Number(row.perUserLimit) : null,
        usedCount: Number(row.usedCount || 0),
        expiryDate: row.expiryDate,
        newUserOnly: Boolean(row.newUserOnly),
        status: row.status,
        createdAt: row.createdAt,
    };
};

const couponSelectSql = `
    SELECT
        id,
        code,
        title,
        description,
        discount_type AS discountType,
        discount_value AS discountValue,
        min_order AS minOrder,
        dish_id AS dishId,
        free_item_id AS freeItemId,
        max_discount AS maxDiscount,
        usage_limit AS usageLimit,
        per_user_limit AS perUserLimit,
        used_count AS usedCount,
        expiry_date AS expiryDate,
        new_user_only AS newUserOnly,
        status,
        created_at AS createdAt
    FROM ${COUPONS_TABLE}
`;

export const getCouponById = async (id) => {
    const [rows] = await pool.execute(
        `${couponSelectSql} WHERE id = ? LIMIT 1`,
        [id]
    );
    return normalizeCouponRow(rows[0]);
};

export const getCouponByCode = async (code) => {
    const [rows] = await pool.execute(
        `${couponSelectSql} WHERE UPPER(code) = UPPER(?) LIMIT 1`,
        [code]
    );
    return normalizeCouponRow(rows[0]);
};

export const getAllCoupons = async ({ includeInactive = false } = {}) => {
    const where = includeInactive
        ? ""
        : "WHERE status = 'active' AND (expiry_date IS NULL OR expiry_date > NOW())";

    const [rows] = await pool.execute(
        `${couponSelectSql} ${where} ORDER BY id DESC`
    );

    return rows.map(normalizeCouponRow);
};

export const createCoupon = async (data) => {
    const {
        code,
        title,
        description,
        discountType,
        discountValue,
        minOrder,
        dishId,
        freeItemId,
        maxDiscount,
        usageLimit,
        perUserLimit,
        expiryDate,
        newUserOnly,
        status,
    } = data;

    const [result] = await pool.execute(
        `
            INSERT INTO ${COUPONS_TABLE}
                (code, title, description, discount_type, discount_value, min_order, dish_id, free_item_id, max_discount, usage_limit, per_user_limit, expiry_date, new_user_only, status)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            code,
            title || null,
            description || null,
            discountType,
            discountValue ?? null,
            minOrder ?? null,
            dishId || null,
            freeItemId || null,
            maxDiscount ?? null,
            usageLimit ?? null,
            perUserLimit ?? null,
            expiryDate ?? null,
            newUserOnly ? 1 : 0,
            status || "active",
        ]
    );

    return getCouponById(result.insertId);
};

export const updateCouponById = async (id, patch) => {
    const existing = await getCouponById(id);
    if (!existing) return null;

    const next = {
        ...existing,
        ...patch,
    };

    await pool.execute(
        `
            UPDATE ${COUPONS_TABLE}
            SET
                code = ?,
                title = ?,
                description = ?,
                discount_type = ?,
                discount_value = ?,
                min_order = ?,
                dish_id = ?,
                free_item_id = ?,
                max_discount = ?,
                usage_limit = ?,
                per_user_limit = ?,
                expiry_date = ?,
                new_user_only = ?,
                status = ?
            WHERE id = ?
        `,
        [
            next.code,
            next.title || null,
            next.description || null,
            next.discountType,
            next.discountValue ?? null,
            next.minOrder ?? null,
            next.dishId || null,
            next.freeItemId || null,
            next.maxDiscount ?? null,
            next.usageLimit ?? null,
            next.perUserLimit ?? null,
            next.expiryDate ?? null,
            next.newUserOnly ? 1 : 0,
            next.status || "active",
            id,
        ]
    );

    return getCouponById(id);
};

export const deleteCouponById = async (id) => {
    const existing = await getCouponById(id);
    if (!existing) return null;

    await pool.execute(`DELETE FROM ${COUPONS_TABLE} WHERE id = ?`, [id]);
    return existing;
};

export const countCouponUsage = async (couponId) => {
    const [rows] = await pool.execute(
        `SELECT COUNT(*) AS cnt FROM ${COUPON_USAGE_TABLE} WHERE coupon_id = ?`,
        [couponId]
    );
    return Number(rows?.[0]?.cnt || 0);
};

export const countCouponUsageByUser = async (couponId, userId) => {
    const [rows] = await pool.execute(
        `SELECT COUNT(*) AS cnt FROM ${COUPON_USAGE_TABLE} WHERE coupon_id = ? AND user_id = ?`,
        [couponId, userId]
    );
    return Number(rows?.[0]?.cnt || 0);
};

export const countAnyCouponUsageByUser = async (userId) => {
    const [rows] = await pool.execute(
        `SELECT COUNT(*) AS cnt FROM ${COUPON_USAGE_TABLE} WHERE user_id = ?`,
        [userId]
    );
    return Number(rows?.[0]?.cnt || 0);
};

export const recordCouponUsage = async ({ couponId, userId, orderId }) => {
    await pool.execute(
        `
            INSERT INTO ${COUPON_USAGE_TABLE} (coupon_id, user_id, order_id)
            VALUES (?, ?, ?)
        `,
        [couponId, userId, orderId || null]
    );
};
