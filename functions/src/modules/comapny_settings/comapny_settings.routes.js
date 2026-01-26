const express = require("express");
const CompanyModulesController = require("./comapny_settings.controller");
const { protect, restrictTo } = require("../../middleware/auth.middleware");

const router = express.Router();

// ป้องกันทุก Route ด้วย JWT Auth
router.use(protect);

// Company Modules Routes

/**
 * หมายเหตุ:
 * ลูกค้าอาจมีโมดูลบริษัทที่แตกต่างกันไป หรือไม่มีโมดูลบริษัทเลยก็ได้
 * ลูกค้าสามารถดึงรายการโมดูลบริษัทที่มีอยู่ได้ และอัปเดตสถานะการใช้งานโมดูลบริษัทได้ (เฉพาะส่วนของ Config เท่านั้น)
 * ไม่สามารถเพิ่ม, ลบ หรือเปิด-ปิดโมดูลเองได้ (สงวนสิทธิ์เฉพาะผู้ให้บริการเท่านั้น)
 */
router
  // Endpoint: /api/company-settings - จัดการโมดูลบริษัท
  .route("/")
  // Endpoint: /api/company-settings - ดึงรายชื่อโมดูลบริษัททั้งหมด
  .get(restrictTo("super_admin", "admin"), CompanyModulesController.getAll);

router
  // Endpoint: /api/company-settings/:id - จัดการโมดูลบริษัทรายบุคคล
  .route("/:id")
  // Endpoint: /api/company-settings/:id - ดึงข้อมูลโมดูลบริษัทรายบุคคล
  .get(restrictTo("super_admin", "admin"), CompanyModulesController.getOne)
  // Endpoint: /api/company-settings/:id - อัปเดตข้อมูลโมดูลบริษัทรายบุคคล
  .patch(restrictTo("super_admin", "admin"), CompanyModulesController.update);

module.exports = router;
