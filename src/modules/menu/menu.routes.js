import express from "express";
import { getMenuFromDb, menuNotImplemented } from "./menu.controller.js";

const router = express.Router();

// Optional DB-backed menu endpoint.
router.get("/menu", getMenuFromDb);

// Keep other methods explicitly unimplemented.
router.all("/menu", menuNotImplemented);

export default router;
