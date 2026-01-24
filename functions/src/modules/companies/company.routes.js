const express = require("express");
const companyController = require("./company.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// Company Routes
router
  // Endpoint: /api/companies/profile - จัดการโปรไฟล์บริษัท
  .route("/profile")
  // Endpoint: /api/companies/profile - ดึงข้อมูลโปรไฟล์บริษัท
  .get(
    restrictTo("super_admin", "admin", "manager"),
    companyController.getProfile,
  )
  // Endpoint: /api/companies/profile - อัปเดตข้อมูลโปรไฟล์บริษัท
  .patch(restrictTo("super_admin", "admin"), companyController.updateProfile);

module.exports = router;
