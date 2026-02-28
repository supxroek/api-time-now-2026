const express = require("express");
const controller = require("./auth.controller");
const { protect } = require("../../../middleware/auth.middleware");

const router = express.Router();

// Endpoint: POST /api/v2/auth/login
router.post("/login", controller.login);

// Endpoint: POST /api/v2/auth/refresh-token
router.post("/refresh-token", controller.refreshToken);

// Endpoint: POST /api/v2/auth/logout
router.post("/logout", controller.logout);

// Endpoint: GET /api/v2/auth/me
router.get("/me", protect, controller.me);

module.exports = router;
