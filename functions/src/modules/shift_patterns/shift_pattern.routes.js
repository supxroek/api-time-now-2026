const express = require("express");
const shiftPatternController = require("./shift_pattern.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// Shift Pattern Routes
router
  // Endpoint: /api/shift-patterns - จัดการรูปแบบกะการทำงาน
  .route("/")
  // Endpoint: /api/shift-patterns - ดึงรายชื่อรูปแบบกะการทำงาน
  .get(
    restrictTo("super_admin", "admin", "manager"),
    shiftPatternController.getAll,
  )
  // Endpoint: /api/shift-patterns - สร้างรูปแบบกะการทำงาน
  .post(restrictTo("super_admin", "admin"), shiftPatternController.create);

router
  // Endpoint: /api/shift-patterns/:id - จัดการรูปแบบกะการทำงานรายบุคคล
  .route("/:id")
  // Endpoint: /api/shift-patterns/:id - ดึงข้อมูลรูปแบบกะตาม ID
  .get(
    restrictTo("super_admin", "admin", "manager"),
    shiftPatternController.getOne,
  )
  // Endpoint: /api/shift-patterns/:id - อัปเดตข้อมูลรูปแบบกะ
  .patch(restrictTo("super_admin", "admin"), shiftPatternController.update)
  // Endpoint: /api/shift-patterns/:id - ลบรูปแบบกะ
  .delete(restrictTo("super_admin", "admin"), shiftPatternController.delete);

module.exports = router;
