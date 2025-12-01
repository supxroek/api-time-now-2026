/**
 * /api/routes/company.routes.js
 *
 * Company Routes
 * เส้นทาง API สำหรับจัดการข้อมูลบริษัท
 */

const express = require("express");
const router = express.Router();

// import controllers and middleware
const companyController = require("../controllers/company.controller");
const { mockAuth, authorize } = require("../middleware/auth.middleware");
const {
  validate,
  companySchemas,
} = require("../middleware/validate.middleware");

// ใช้ mockAuth สำหรับทดสอบ (เปลี่ยนเป็น authenticate เมื่อมีระบบ login)
router.use(mockAuth);

// กำหนดเส้นทาง API ที่นี้
// ตัวอย่าง: ดึงข้อมูลโปรไฟล์บริษัท
router.get(
  "/",
  authorize("admin", "user"),
  companyController.getExample
);

module.exports = router;
