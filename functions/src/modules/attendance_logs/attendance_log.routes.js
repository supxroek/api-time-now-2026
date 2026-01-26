const express = require("express");
const controller = require("./attendance_log.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// Attendance Log Routes
router
  // Endpoint: /api/attendance-logs - จัดการบันทึกการเข้าออกงาน
  .route("/")
  // Endpoint: /api/attendance-logs - ดึงบันทึกการเข้าออกงานทั้งหมด
  .get(restrictTo("super_admin", "admin", "manager"), controller.getAll);

module.exports = router;
