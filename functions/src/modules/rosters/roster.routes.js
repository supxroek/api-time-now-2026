const express = require("express");
const rosterController = require("./roster.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// Roster Routes
router
  // Endpoint: /api/rosters - จัดการตารางเวร
  .route("/")
  // Endpoint: /api/rosters - ดึงรายการตารางเวร (Filter: date range, employee)
  .get(restrictTo("super_admin", "admin", "manager"), rosterController.getAll)
  // Endpoint: /api/rosters - สร้างตารางเวรใหม่
  .post(restrictTo("super_admin", "admin"), rosterController.create);

router
  // Endpoint: /api/rosters/:id - จัดการตารางเวรรายรายการ
  .route("/:id")
  // Endpoint: /api/rosters/:id - ดึงข้อมูลตารางเวร
  .get(restrictTo("super_admin", "admin", "manager"), rosterController.getOne)
  // Endpoint: /api/rosters/:id - แก้ไขตารางเวร
  .patch(restrictTo("super_admin", "admin"), rosterController.update)
  // Endpoint: /api/rosters/:id - ลบตารางเวร
  .delete(restrictTo("super_admin", "admin"), rosterController.delete);

module.exports = router;
