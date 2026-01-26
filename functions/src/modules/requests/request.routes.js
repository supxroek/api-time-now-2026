const express = require("express");
const controller = require("./request.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// Request History Routes
router
  // Endpoint: /api/requests - ดึงประวัติคำขอทั้งหมด
  .route("/")
  // Endpoint: /api/requests - ดึงประวัติคำขอทั้งหมด
  .get(restrictTo("super_admin", "admin", "manager"), controller.getHistory);

module.exports = router;
