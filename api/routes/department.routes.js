/**
 * /api/routes/department.routes.js
 *
 * Department Routes
 * เส้นทาง API สำหรับจัดการแผนก
 */

const express = require("express");
const router = express.Router();

const departmentController = require("../controllers/department.controller");
const { mockAuth, authorize } = require("../middleware/auth.middleware");
const {
  validate,
  departmentSchemas,
} = require("../middleware/validate.middleware");

// ใช้ mockAuth สำหรับทดสอบ (เปลี่ยนเป็น authenticate เมื่อมีระบบ login)
router.use(mockAuth);

/**
 * @route   GET /api/departments
 * @desc    ดึงรายชื่อแผนกทั้งหมดพร้อมจำนวนพนักงาน
 * @access  Private (HR/Admin)
 */
router.get("/", departmentController.getAll);

/**
 * @route   GET /api/departments/:id
 * @desc    ดึงข้อมูลแผนกตาม ID
 * @access  Private (HR/Admin)
 */
router.get(
  "/:id",
  validate(departmentSchemas.idParam, "params"),
  departmentController.getById
);

/**
 * @route   POST /api/departments
 * @desc    สร้างแผนกใหม่
 * @access  Private (HR/Admin)
 */
router.post(
  "/",
  validate(departmentSchemas.create),
  departmentController.create
);

/**
 * @route   PUT /api/departments/:id
 * @desc    แก้ไขแผนก
 * @access  Private (HR/Admin)
 */
router.put(
  "/:id",
  validate(departmentSchemas.idParam, "params"),
  validate(departmentSchemas.update),
  departmentController.update
);

/**
 * @route   DELETE /api/departments/:id
 * @desc    ลบแผนก
 * @access  Private (Admin)
 * @query   force=true - บังคับลบแม้มีพนักงาน
 * @query   transferTo=<id> - ย้ายพนักงานไปแผนกอื่นก่อนลบ
 */
router.delete(
  "/:id",
  validate(departmentSchemas.idParam, "params"),
  departmentController.delete
);

module.exports = router;
