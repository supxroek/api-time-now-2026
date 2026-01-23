const express = require("express");
const shiftController = require("./shift.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// Shift Routes
router
  // Endpoint: /api/shifts - จัดการกะการทำงาน
  .route("/")
  // Endpoint: /api/shifts - ดึงรายชื่อกะการทำงานทั้งหมด
  .get(restrictTo("super_admin", "admin", "manager"), shiftController.getAll)
  // Endpoint: /api/shifts - สร้างกะการทำงานใหม่
  .post(restrictTo("super_admin", "admin"), shiftController.create);

router
  // Endpoint: /api/shifts/:id - จัดการกะการทำงานรายบุคคล
  .route("/:id")
  // Endpoint: /api/shifts/:id - ดึงข้อมูลกะการทำงานรายบุคคล
  .get(restrictTo("super_admin", "admin", "manager"), shiftController.getOne)
  // Endpoint: /api/shifts/:id - อัปเดตข้อมูลกะการทำงานรายบุคคล
  .patch(restrictTo("super_admin", "admin"), shiftController.update)
  // Endpoint: /api/shifts/:id - ลบกะการทำงานรายบุคคล
  .delete(restrictTo("super_admin", "admin"), shiftController.delete);

module.exports = router;
