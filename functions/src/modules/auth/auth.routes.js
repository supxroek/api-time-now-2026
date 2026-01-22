/**
 * /src/modules/auth/auth.routes.js
 *
 * Auth Routes
 * เส้นทาง API สำหรับการตรวจสอบสิทธิ์ผู้ใช้
 */

const express = require("express");
const router = express.Router();

// import controllers and middleware
const authController = require("./auth.controller");
const {
  validate,
  authSchemas,
} = require("../../middleware/validate.middleware");

// กำหนดเส้นทาง API ที่นี้
router
  .post("/login", validate(authSchemas.login, "body"), authController.login)
  .post(
    "/register",
    validate(authSchemas.register, "body"),
    authController.register
  )
  .post(
    "/refresh-token",
    validate(authSchemas.refreshToken, "body"),
    authController.refreshToken
  );

// Logout / revoke refresh tokens
router.post("/logout", authController.logout);

module.exports = router;
