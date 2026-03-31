import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import env from "./config/env.js";
import { initFirebaseAdmin } from "./config/firebaseAdmin.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import adminImageRoutes from "./modules/admin/admin.image.routes.js";
import adminPetpoojaSyncRoutes from "./modules/admin/admin.petpoojaSync.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import categoryRoutes from "./modules/category/category.routes.js";
import contactRoutes from "./modules/contact/contact.routes.js";
import couponRoutes from "./modules/coupon/coupon.routes.js";
import heroRoutes from "./modules/hero/hero.routes.js";
import jobsRoutes from "./modules/jobs/jobs.routes.js";
import menuRoutes from "./modules/menu/menu.routes.js";
import orderRoutes from "./modules/order/order.routes.js";
import petpoojaRoutes from "./modules/petpooja/petpooja.routes.js";
import reservationRoutes from "./modules/reservation/reservation.routes.js";
import storeRoutes from "./modules/store/store.routes.js";
import tableRoutes from "./modules/table/table.routes.js";

const app = express();

app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
    })
);
app.use(
    cors({
        origin: env.CORS_ORIGIN,
        credentials: true,
    })
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
// VERY IMPORTANT
app.use(express.urlencoded({ extended: true }));
app.use(
    "/uploads",
    express.static("uploads", {
        maxAge: "30d",
        etag: true,
        lastModified: true,
    })
);

app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

app.get("/api/test-firebase", async (req, res) => {
    try {
        await initFirebaseAdmin();
        return res
            .status(200)
            .json({ success: true, message: "Firebase Admin Working" });
    } catch (error) {
        console.error(
            "Firebase Admin test failed:",
            error?.message || String(error)
        );
        return res.status(500).json({
            success: false,
            message: "Firebase Admin failed to initialize",
        });
    }
});

app.use(`/api/${env.ADMIN_API_PREFIX}`, adminRoutes);
app.use("/api", adminImageRoutes);
app.use("/api", adminPetpoojaSyncRoutes);
app.use("/api", authRoutes);
app.use("/api", heroRoutes);
app.use("/api", categoryRoutes);
app.use("/api", contactRoutes);
app.use("/api", menuRoutes);
app.use("/api", jobsRoutes);
app.use("/api", tableRoutes);
app.use("/api", couponRoutes);
app.use("/api", orderRoutes);
app.use("/api", reservationRoutes);
app.use("/api/petpooja", petpoojaRoutes);
app.use("/api", storeRoutes);

app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

app.use(errorMiddleware);

export default app;
