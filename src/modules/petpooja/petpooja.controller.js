import { getTestMenu } from "./petpooja.menu.service.js";
import { sendOrderToPetpooja } from "./petpooja.order.service.js";
import { toHttpErrorPayload } from "./petpooja.utils.js";


export const menu = async (req, res) => {
    try {

        const data = await getTestMenu();

        return res.status(200).json(data);

    } catch (error) {

        console.error("Menu fetch error:", error.message);

        return res.status(500).json({
            message: "Menu fetch failed",
            error: error.message
        });

    }
};


// export const createOrder = async (req, res) => {

//     // console.log("Incoming request body:", req.body);


//     try {

//         const payload = req.body;

//         const result = await sendOrderToPetpooja(payload);

//         return res.status(200).json(result);

//     } catch (error) {

//         const { statusCode, body } = toHttpErrorPayload(error);

//         return res.status(statusCode).json(body);

//     }

// };

export const createOrder = async (req, res) => {

    try {

        const payload = req.body;

        const result = await sendOrderToPetpooja(payload);

        return res.status(200).json({
            success: true,
            petpooja: result
        });

    } catch (error) {

        const { statusCode, body } = toHttpErrorPayload(error);

        return res.status(statusCode).json(body);

    }

};

export const orderCallback = async (req, res) => {
    console.log("Petpooja order callback received:", req.body);
    return res.status(200).json({ status: "received" });
};


export const storeStatus = async (req, res) => {
    res.json({
        status: "1",
        message: "Store is open"
    });
};