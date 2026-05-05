import axios from "axios";
import petpoojaConfig from "../../config/petpooja.js";
import { PETPOOJA_SAVE_ORDER_ENDPOINT } from "./petpooja.constants.js";
import {
    assertPetpoojaConfigured,
    petpoojaOrderClient
} from "./petpooja.utils.js";


// ================= VALIDATION =================
const badRequest = (message, details) => {
    const error = new Error(message);
    error.statusCode = 400;
    if (details) error.details = details;
    return error;
};

const validateSaveOrderPayload = (payload) => {
    if (!payload || typeof payload !== "object") {
        throw badRequest("Invalid request body");
    }

    const required = [
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

    const missing = required.filter(f => !payload[f]);

    if (missing.length) {
        throw badRequest("Missing fields", { missing });
    }
};


// ================= SEND ORDER =================
export const sendOrderToPetpooja = async (payload) => {

    assertPetpoojaConfigured();
    validateSaveOrderPayload(payload);

    const now = new Date();

    const finalPayload = {
        ...payload,
        preorder_date: payload.preorder_date || now.toISOString().slice(0, 10),
        preorder_time: payload.preorder_time || now.toTimeString().slice(0, 8),
        advanced_order: payload.advanced_order || "N",
        dc_tax_percentage: payload.dc_tax_percentage || "0",
        pc_tax_percentage: payload.pc_tax_percentage || "0",
        enable_delivery: payload.enable_delivery || "1",
    };

    const orderPayload = {

        // ❗ REMOVE FROM BODY (IMPORTANT)
        // app_key
        // app_secret
        // access_token

        orderinfo: {
            OrderInfo: {

                Restaurant: {
                    details: {
                        restID: petpoojaConfig.restId
                    }
                },

                Customer: {
                    details: {
                        name: finalPayload.name,
                        phone: finalPayload.phone,
                        address: finalPayload.address
                    }
                },

                Order: {
                    details: {
                        orderID: finalPayload.orderID,
                        preorder_date: finalPayload.preorder_date,
                        preorder_time: finalPayload.preorder_time,
                        advanced_order: finalPayload.advanced_order,
                        order_type: finalPayload.order_type,
                        payment_type: finalPayload.payment_type,
                        total: String(finalPayload.total),
                        tax_total: String(finalPayload.tax_total),
                        created_on: finalPayload.created_on,
                        dc_tax_percentage: finalPayload.dc_tax_percentage,
                        pc_tax_percentage: finalPayload.pc_tax_percentage,
                        enable_delivery: finalPayload.enable_delivery,

                        min_prep_time: finalPayload.min_prep_time || 20,

                        collect_cash:
                            finalPayload.payment_type === "COD"
                                ? String(finalPayload.total)
                                : "0",

                        description: finalPayload.description || "",
                        callback_url: petpoojaConfig.callbackUrl
                    }
                },

                OrderItem: {
                    details: finalPayload.order_items.map(item => ({
                        id: item.id,
                        name: item.name,
                        price: String(item.price),
                        final_price: String(item.final_price || item.price),
                        quantity: String(item.quantity),
                        gst_liability: "restaurant",
                        tax_inclusive: true,
                        item_tax: [],
                        variation_name: "",
                        variation_id: "",
                        AddonItem: { details: [] }
                    }))
                },

                Tax: {
                    details: finalPayload.tax_details || []
                }

            },

            device_type: "Web"
        }
    };

    console.log("FINAL ORDER PAYLOAD", orderPayload);

    const response = await petpoojaOrderClient.post(
        PETPOOJA_SAVE_ORDER_ENDPOINT,
        orderPayload
    );

    return response.data;
};


// ================= CANCEL ORDER =================
export const cancelPetpoojaOrder = async (data) => {
    try {
        const response = await axios.post(
            `${petpoojaConfig.orderBaseUrl}/update_order_status`, // ✅ FIXED
            {
                app_key: petpoojaConfig.appKey,
                app_secret: petpoojaConfig.appSecret,
                access_token: petpoojaConfig.accessToken,
                restID: petpoojaConfig.restId,
                clientorderID: data.clientorderID,
                cancelReason: data.reason,
                status: "-1"
            }
        );

        return response.data;

    } catch (error) {
        console.error("Cancel error:", error.response?.data || error.message);
        throw error;
    }
};