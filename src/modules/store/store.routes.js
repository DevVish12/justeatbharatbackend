import express from "express";
import {
    getStoreStatusController,
    updateStoreStatusController,
} from "./store.controller.js";
import { createStoreSettingsTableIfNotExists } from "./store.model.js";

const router = express.Router();

await createStoreSettingsTableIfNotExists();

router.get("/store/status", getStoreStatusController);
router.post("/store/status", updateStoreStatusController);

export default router;
