import { syncPetpoojaMenu } from "../petpooja/petpooja.sync.service.js";

export const syncPetpoojaMenuController = async (req, res) => {
    try {
        await syncPetpoojaMenu();
        return res.status(200).json({
            success: true,
            message: "Petpooja menu synced successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error?.message || "Petpooja menu sync failed",
        });
    }
};
