// import { syncPetpoojaMenu } from "../petpooja/petpooja.sync.service.js";

// export const syncPetpoojaMenuController = async (req, res) => {
//     try {
//         await syncPetpoojaMenu();
//         return res.status(200).json({
//             success: true,
//             message: "Petpooja menu synced successfully",
//         });
//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: error?.message || "Petpooja menu sync failed",
//         });
//     }
// };

// ✅ PUSH MODE - NO MANUAL SYNC

export const syncPetpoojaMenuController = async (req, res) => {
    try {
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