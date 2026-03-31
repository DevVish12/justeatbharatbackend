import express from "express";
import { categoryNotImplemented } from "./category.controller.js";

const router = express.Router();

// Placeholder routes to keep app wiring intact.
router.all("/categories", categoryNotImplemented);

export default router;
