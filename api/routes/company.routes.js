/**
 * /api/routes/company.routes.js
 *
 * Company Routes
 * เส้นทาง API สำหรับจัดการข้อมูลบริษัท
 */

const express = require("express");
const router = express.Router();

const companyController = require("../controllers/company.controller");
const { mockAuth, authorize } = require("../middleware/auth.middleware");
const {
  validate,
  companySchemas,
} = require("../middleware/validate.middleware");

// ใช้ mockAuth สำหรับทดสอบ (เปลี่ยนเป็น authenticate เมื่อมีระบบ login)
router.use(mockAuth);

/**
 * @route   GET /api/company/profile
 * @desc    ดึงข้อมูล Profile ของบริษัท
 * @access  Private (HR/Admin)
 */
router.get("/profile", companyController.getProfile);

/**
 * @route   PUT /api/company/profile
 * @desc    แก้ไขข้อมูล Profile ของบริษัท
 * @access  Private (HR/Admin)
 */
router.put(
  "/profile",
  validate(companySchemas.updateProfile),
  companyController.updateProfile
);

/**
 * @route   GET /api/company/subscription
 * @desc    ดึงสถานะ Subscription
 * @access  Private (Admin)
 */
router.get("/subscription", companyController.getSubscription);

module.exports = router;
