const express = require("express");
const branchController = require("./branch.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// Branch Routes
router
  // Endpoint: /api/branches - จัดการสาขา
  .route("/")
  // Endpoint: /api/branches - ดึงรายชื่อสาขาทั้งหมด
  .get(restrictTo("super_admin", "admin", "manager"), branchController.getAll)
  // Endpoint: /api/branches - สร้างสาขาใหม่
  .post(restrictTo("super_admin", "admin"), branchController.create);

router
  // Endpoint: /api/branches/:id - จัดการสาขารายบุคคล
  .route("/:id")
  // Endpoint: /api/branches/:id - ดึงข้อมูลสาขารายบุคคล
  .get(restrictTo("super_admin", "admin", "manager"), branchController.getOne)
  // Endpoint: /api/branches/:id - อัปเดตข้อมูลสาขารายบุคคล
  .patch(restrictTo("super_admin", "admin"), branchController.update)
  // Endpoint: /api/branches/:id - ลบสาขารายบุคคล
  .delete(restrictTo("super_admin", "admin"), branchController.delete);

module.exports = router;
