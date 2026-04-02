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

// Endpoint: POST /api/v2/auth/forgot-password
router.post("/forgot-password", controller.forgotPassword);

// Endpoint: POST /api/v2/auth/reset-password
router.post("/reset-password", controller.resetPassword);

// Endpoint: GET /api/v2/auth/reset-password/validate
router.get("/reset-password/validate", controller.validateResetPasswordLink);

module.exports = router;
