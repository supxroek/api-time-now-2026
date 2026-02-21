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
  // Endpoint: /api/attendance-logs - บันทึกการเข้าออกงาน
  .post(restrictTo("super_admin", "admin", "manager"), controller.create)
  // Endpoint: /api/attendance-logs - ดึงบันทึกการเข้าออกงานทั้งหมด
  .get(restrictTo("super_admin", "admin", "manager"), controller.getAll);

router
  .route("/summary")
  .get(
    restrictTo("super_admin", "admin", "manager"),
    controller.getDailySummary,
  );

router
  .route("/employee/:employeeId/history")
  .get(restrictTo("super_admin", "admin", "manager"), controller.getHistory);

module.exports = router;
