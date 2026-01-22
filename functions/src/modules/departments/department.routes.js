const express = require("express");
const departmentController = require("./department.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// Department Routes
router
  // Endpoint: /api/departments - จัดการแผนก
  .route("/")
  // Endpoint: /api/departments - ดึงรายชื่อแผนกทั้งหมด
  .get(
    restrictTo("super_admin", "admin", "manager"),
    departmentController.getAll,
  )
  // Endpoint: /api/departments - สร้างแผนกใหม่
  .post(restrictTo("super_admin", "admin"), departmentController.create);

router
  // Endpoint: /api/departments/:id - จัดการแผนกรายบุคคล
  .route("/:id")
  // Endpoint: /api/departments/:id - ดึงข้อมูลแผนกรายบุคคล
  .get(
    restrictTo("super_admin", "admin", "manager"),
    departmentController.getOne,
  )
  // Endpoint: /api/departments/:id - อัปเดตข้อมูลแผนกรายบุคคล
  .patch(restrictTo("super_admin", "admin"), departmentController.update)
  // Endpoint: /api/departments/:id - ลบแผนกรายบุคคล
  .delete(restrictTo("super_admin", "admin"), departmentController.delete);

module.exports = router;
