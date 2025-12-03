/**
 * /src/modules/companies/company.routes.js
 *
 * Company Routes
 * เส้นทาง API สำหรับการจัดการข้อมูลบริษัท
 */

const express = require("express");
const router = express.Router();

// import controllers and middleware
const companyController = require("./company.controller");
const { authenticate } = require("../../middleware/auth.middleware");
const {
  validate,
  companySchemas,
} = require("../../middleware/validate.middleware");

// กำหนดเส้นทาง API ที่นี้
router
  .get(
    "/profile",
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(companySchemas.getCompanies, "query"),
    companyController.getCompanies // ดึงข้อมูลบริษัทของผู้ใช้
  )
  .patch(
    "/profile",
    authenticate, // ต้องผ่านการยืนยันตัวตน
    validate(companySchemas.updateCompany, "body"),
    companyController.updateCompany // อัปเดตข้อมูลบริษัทของผู้ใช้
  );

module.exports = router;
