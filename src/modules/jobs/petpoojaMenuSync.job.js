// import cron from "node-cron";
// import { syncPetpoojaMenu } from "../petpooja/petpooja.sync.service.js";

// let started = false;

// export const startPetpoojaMenuSyncJob = () => {
//     if (started) return;
//     started = true;

//     // Every 1 hour.
//     cron.schedule(
//         "0 * * * *",
//         async () => {
//             try {
//                 const result = await syncPetpoojaMenu();
//                 console.log(
//                     `[petpoojaMenuSync.job] synced: upserted=${result.upserted} items (seen=${result.itemCount})`
//                 );
//             } catch (error) {
//                 console.error(
//                     "[petpoojaMenuSync.job] sync failed:",
//                     error?.message || error
//                 );
//             }
//         },
//         { scheduled: true }
//     );

//     console.log("[petpoojaMenuSync.job] scheduled: 0 * * * *");
// };

// // Auto-start when imported.
// startPetpoojaMenuSyncJob();


// 🚫 DISABLED: Petpooja auto sync job
// Reason: LIVE integration uses PUSH MENU only (no fetch/sync required)

let started = false;

export const startPetpoojaMenuSyncJob = () => {
    if (started) return;
    started = true;

    console.log("⚠️ Petpooja auto sync DISABLED (PUSH mode active)");
};

// Auto-start (safe – does nothing)
startPetpoojaMenuSyncJob();