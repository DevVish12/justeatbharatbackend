
import { pushMenu } from "../petpooja/petpooja.controller.js";

export const syncPetpoojaMenuController = async (req, res) => {
    try {
        // If Petpooja is configured to hit this endpoint by mistake,
        // forward the payload to the real PUSH menu controller.
        const maybePushPayload =
            Array.isArray(req.body?.restaurants) ||
            Array.isArray(req.body?.items) ||
            Array.isArray(req.body?.categories);

        if (maybePushPayload) {
            console.log(
                "⚠️ Petpooja PUSH payload received on admin sync route; forwarding to pushMenu"
            );
            return pushMenu(req, res);
        }

        console.log("⚠️ Manual sync disabled (PUSH mode)");

        return res.status(200).json({
            success: true,
            message: "Manual sync disabled (using push menu)",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error?.message || "Sync failed",
        });
    }
};