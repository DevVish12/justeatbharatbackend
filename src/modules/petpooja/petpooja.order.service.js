import petpoojaConfig from "../../config/petpooja.js";
import { PETPOOJA_SAVE_ORDER_ENDPOINT } from "./petpooja.constants.js";
import {
    assertPetpoojaConfigured,
    petpoojaOrderClient
} from "./petpooja.utils.js";

const badRequest = (message, details) => {
    const error = new Error(message);
    error.statusCode = 400;
    if (details) error.details = details;
    return error;
};

const validateSaveOrderPayload = (payload) => {
    if (!payload || typeof payload !== "object") {
        throw badRequest("Invalid request body", {
            expected: "JSON object",
        });
    }

    const missing = [];
    const requiredFields = [
        "orderID",
        "name",
        "phone",
        "address",
        "order_type",
        "payment_type",
        "total",
        "tax_total",
        "created_on",
        "order_items",
    ];

    for (const field of requiredFields) {
        if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
            missing.push(field);
        }
    }

    if (!Array.isArray(payload.order_items) || payload.order_items.length === 0) {
        missing.push("order_items[]");
    }

    if (Array.isArray(payload.order_items)) {
        const itemMissing = new Set();
        for (const item of payload.order_items) {
            if (!item || typeof item !== "object") {
                itemMissing.add("order_items[].{id,name,price,quantity}");
                continue;
            }
            if (!item.id) itemMissing.add("order_items[].id");
            if (!item.name) itemMissing.add("order_items[].name");
            if (item.price === undefined || item.price === null || item.price === "") {
                itemMissing.add("order_items[].price");
            }
            if (item.quantity === undefined || item.quantity === null || item.quantity === "") {
                itemMissing.add("order_items[].quantity");
            }
        }
        missing.push(...itemMissing);
    }

    if (missing.length > 0) {
        throw badRequest("Missing/invalid fields for Petpooja save_order", {
            missing: [...new Set(missing)],
        });
    }
};


export const sendOrderToPetpooja = async (payload) => {

    assertPetpoojaConfigured();

    validateSaveOrderPayload(payload);

    // 🔹 Auto fill required fields if missing
    const now = new Date();

    const preorderDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const preorderTime = now.toTimeString().slice(0, 8); // HH:MM:SS

    payload.preorder_date = payload.preorder_date || preorderDate;
    payload.preorder_time = payload.preorder_time || preorderTime;
    payload.advanced_order = payload.advanced_order || "N";

    payload.dc_tax_percentage = payload.dc_tax_percentage || "0";
    payload.pc_tax_percentage = payload.pc_tax_percentage || "0";

    payload.enable_delivery = payload.enable_delivery || "1";

    const orderPayload = {
        app_key: petpoojaConfig.appKey,
        app_secret: petpoojaConfig.appSecret,
        access_token: petpoojaConfig.accessToken,

        orderinfo: {
            OrderInfo: {

                Restaurant: {
                    details: {
                        restID: petpoojaConfig.restId
                    }
                },

                Customer: {
                    details: {
                        name: payload.name,
                        phone: payload.phone,
                        address: payload.address
                    }
                },

                Order: {
                    details: {
                        orderID: payload.orderID,
                        preorder_date: payload.preorder_date,
                        preorder_time: payload.preorder_time,
                        advanced_order: payload.advanced_order,
                        order_type: payload.order_type,
                        payment_type: payload.payment_type,
                        total: payload.total,
                        tax_total: payload.tax_total,
                        created_on: payload.created_on,
                        dc_tax_percentage: payload.dc_tax_percentage,
                        pc_tax_percentage: payload.pc_tax_percentage,
                        enable_delivery: payload.enable_delivery,
                        callback_url: petpoojaConfig.callbackUrl
                    }
                },

                OrderItem: {
                    details: payload.order_items.map(item => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        final_price: item.final_price || item.price,
                        quantity: item.quantity,
                        gst_liability: item.gst_liability || "restaurant",
                        tax_inclusive: true,
                        item_tax: [],
                        variation_name: "",
                        variation_id: "",
                        AddonItem: { details: [] }
                    }))
                },

                Tax: {
                    details: payload.tax_details || []
                }

            },

            device_type: "Web"
        }
    };

    // if (!orderPayload.restID) {
    //     throw badRequest("Missing restID (PETPOOJA_REST_ID)");
    // }

    // 🔴 YAHAN ADD KARNA HAI
    // console.log("FINAL ORDER PAYLOAD:", JSON.stringify(orderPayload, null, 2));

    const response = await petpoojaOrderClient.post(
        PETPOOJA_SAVE_ORDER_ENDPOINT,
        orderPayload
    );

    return response.data;

};