import pool from "../../config/db.js";

export const createOrdersTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id VARCHAR(64) NOT NULL,
            user_name VARCHAR(120) NOT NULL,
            phone VARCHAR(30) NOT NULL,
            order_type VARCHAR(20) NOT NULL,
            table_no VARCHAR(20) DEFAULT NULL,
            items_json LONGTEXT NOT NULL,
            subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
            discount DECIMAL(10,2) NOT NULL DEFAULT 0,
            tax DECIMAL(10,2) NOT NULL DEFAULT 0,
            total DECIMAL(10,2) NOT NULL DEFAULT 0,
            payment_method ENUM('ONLINE','OFFLINE') NOT NULL,
            payment_status ENUM('PAID','PENDING') NOT NULL DEFAULT 'PENDING',
            order_status ENUM('PLACED','PREPARING','COMPLETED') NOT NULL DEFAULT 'PLACED',
            special_instructions TEXT,
            razorpay_order_id VARCHAR(100) DEFAULT NULL,
            razorpay_payment_id VARCHAR(100) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_order_id (order_id),
            KEY idx_created_at (created_at),
            KEY idx_payment_status (payment_status),
            KEY idx_order_status (order_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
};

export const createOrder = async (order) => {
    const {
        orderId,
        userName,
        phone,
        orderType,
        tableNo,
        itemsJson,
        subtotal,
        discount,
        tax,
        total,
        paymentMethod,
        paymentStatus,
        orderStatus,
        specialInstructions,
        razorpayOrderId,
    } = order;

    const [result] = await pool.query(
        `
        INSERT INTO orders (
            order_id, user_name, phone, order_type, table_no,
            items_json, subtotal, discount, tax, total,
            payment_method, payment_status, order_status,
            special_instructions, razorpay_order_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            orderId,
            userName,
            phone,
            orderType,
            tableNo || null,
            itemsJson,
            subtotal,
            discount,
            tax,
            total,
            paymentMethod,
            paymentStatus,
            orderStatus,
            specialInstructions || "",
            razorpayOrderId || null,
        ]
    );

    const insertedId = result.insertId;
    return getOrderByDbId(insertedId);
};

export const listOrders = async ({ limit = 200 } = {}) => {
    const lim = Number(limit);
    const safeLimit = Number.isFinite(lim) ? Math.min(Math.max(lim, 1), 500) : 200;
    const [rows] = await pool.query(
        `SELECT * FROM orders ORDER BY created_at DESC LIMIT ?`,
        [safeLimit]
    );
    return rows;
};

export const listOrdersByPhone = async ({ phone, limit = 200 } = {}) => {
    const normalizedPhone = String(phone || "").trim();
    if (!normalizedPhone) {
        return [];
    }

    const lim = Number(limit);
    const safeLimit = Number.isFinite(lim) ? Math.min(Math.max(lim, 1), 200) : 200;
    const [rows] = await pool.query(
        `
            SELECT *
            FROM orders
            WHERE phone = ? OR phone LIKE CONCAT('%', ?)
            ORDER BY created_at DESC
            LIMIT ?
        `,
        [normalizedPhone, normalizedPhone, safeLimit]
    );
    return rows;
};

export const getOrderByDbId = async (id) => {
    const [rows] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [id]);
    return rows[0] || null;
};

export const getOrderByOrderId = async (orderId) => {
    const [rows] = await pool.query(`SELECT * FROM orders WHERE order_id = ?`, [orderId]);
    return rows[0] || null;
};

export const getOrderByRazorpayOrderId = async (razorpayOrderId) => {
    const [rows] = await pool.query(
        `SELECT * FROM orders WHERE razorpay_order_id = ?`,
        [razorpayOrderId]
    );
    return rows[0] || null;
};

export const updateOrderStatus = async ({ id, orderId, status }) => {
    if (id) {
        await pool.query(`UPDATE orders SET order_status = ? WHERE id = ?`, [status, id]);
        return getOrderByDbId(id);
    }

    await pool.query(`UPDATE orders SET order_status = ? WHERE order_id = ?`, [status, orderId]);
    return getOrderByOrderId(orderId);
};

export const markPaymentPaid = async ({ orderId, razorpayOrderId, razorpayPaymentId }) => {
    if (orderId) {
        await pool.query(
            `UPDATE orders SET payment_status = 'PAID', razorpay_payment_id = ? WHERE order_id = ?`,
            [razorpayPaymentId || null, orderId]
        );
        return getOrderByOrderId(orderId);
    }

    await pool.query(
        `UPDATE orders SET payment_status = 'PAID', razorpay_payment_id = ? WHERE razorpay_order_id = ?`,
        [razorpayPaymentId || null, razorpayOrderId]
    );
    return getOrderByRazorpayOrderId(razorpayOrderId);
};
