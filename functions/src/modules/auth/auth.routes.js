const express = require("express");
const authController = require("./auth.controller");
const router = express.Router();

// Auth Routes
router
  // Endpoint: /api/auth/register - สำหรับสมัครสมชิกใหม่ (ทดสอบ)
  .post("/register", authController.register)
  // Endpoint: /api/auth/login - สำหรับเข้าสู่ระบบ
  .post("/login", authController.login)
  // Endpoint: /api/auth/logout - สำหรับออกจากระบบ
  .post("/logout", authController.logout)
  // Endpoint: /api/auth/refresh-token - สำหรับขอ Access Token ใหม่
  .post("/refresh-token", authController.refreshToken)
  // Endpoint: /api/auth/forgot-password - สำหรับขอรีเซ็ตรหัสผ่าน
  .post("/forgot-password", authController.forgotPassword);

module.exports = router;
