import app from "./app.js";
import { checkDatabaseConnection } from "./config/db.js";
import env from "./config/env.js";
import {
    createAdminTableIfNotExists,
    createDishImagesTableIfNotExists,
} from "./modules/admin/admin.model.js";
import { createUsersTable } from "./modules/auth/user.model.js";
import { createCategoryTable } from "./modules/category/category.model.js";
import { createContactTable } from "./modules/contact/contact.model.js";
import { createHeroTable } from "./modules/hero/hero.model.js";
import { createJobApplicationsTable } from "./modules/jobs/jobs.model.js";
import { createCategoryTable as createMenuCategoryTable } from "./modules/menu/menu.category.model.js";
import { createMenuTable } from "./modules/menu/menu.model.js";
import { startPetpoojaMenuAutoSync } from "./modules/petpooja/petpooja.sync.service.js";
import { createStoreSettingsTableIfNotExists } from "./modules/store/store.model.js";

const startServer = async () => {
    try {
        await checkDatabaseConnection();
        await createAdminTableIfNotExists();
        await createDishImagesTableIfNotExists();
        await createUsersTable();
        await createHeroTable();
        await createCategoryTable();
        await createContactTable();
        await createMenuTable();
        await createMenuCategoryTable();
        await createJobApplicationsTable();
        await createStoreSettingsTableIfNotExists();

        // Start Petpooja menu auto sync + Redis cache.
        startPetpoojaMenuAutoSync();

        // Register background Petpooja menu sync (hourly).
        await import("./modules/jobs/petpoojaMenuSync.job.js");

        const server = app.listen(env.PORT, () => {
            console.log(`Backend running on http://localhost:${env.PORT}`);
        });

        server.on("error", (error) => {
            if (error?.code === "EADDRINUSE") {
                console.error(
                    `Port ${env.PORT} is already in use. Stop the other process or change PORT in backend .env.`
                );
            } else {
                console.error("Failed to start backend:", error?.message || error);
            }
            process.exit(1);
        });
    } catch (error) {
        console.error("Failed to start backend:", error.message);
        process.exit(1);
    }
};

startServer();
