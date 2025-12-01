/**
 * /api/routes/department.routes.js
 *
 * Department Routes
 * เส้นทาง API สำหรับจัดการแผนก
 */

const express = require("express");
const router = express.Router();

// import controllers and middleware
const departmentController = require("../controllers/department.controller");
const { mockAuth, authorize } = require("../middleware/auth.middleware");
const { validate, departmentSchemas } = require("../middleware/validate.middleware");

// ใช้ mockAuth สำหรับทดสอบ (เปลี่ยนเป็น authenticate เมื่อมีระบบ login)
router.use(mockAuth);

// กำหนดเส้นทาง API ที่นี้

// ทดสอบ
router.get("/test", authorize("department.view"), departmentController.test);

module.exports = router;
