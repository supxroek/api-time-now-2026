const express = require("express");
const employeeController = require("./employee.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// Employee Routes
router
  // Endpoint: /api/employees - จัดการพนักงาน
  .route("/")
  // Endpoint: /api/employees - ดึงรายชื่อพนักงานทั้งหมด
  .get(restrictTo("super_admin", "admin", "manager"), employeeController.getAll)
  // Endpoint: /api/employees - สร้างพนักงานใหม่
  .post(restrictTo("super_admin", "admin"), employeeController.create);

router
  // Endpoint: /api/employees/:id - จัดการพนักงานรายบุคคล
  .route("/:id")
  // Endpoint: /api/employees/:id - ดึงข้อมูลพนักงานรายบุคคล
  .get(restrictTo("super_admin", "admin", "manager"), employeeController.getOne)
  // Endpoint: /api/employees/:id - อัปเดตข้อมูลพนักงานรายบุคคล
  .patch(restrictTo("super_admin", "admin"), employeeController.update)
  // Endpoint: /api/employees/:id - ลบพนักงานรายบุคคล
  .delete(restrictTo("super_admin", "admin"), employeeController.delete);

module.exports = router;
